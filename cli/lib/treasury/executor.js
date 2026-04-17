/**
 * Treasury Executor — orchestrates the full rebalance lifecycle.
 *
 * Flow:
 *   1. Fetch wallet-set portfolio + positions from Zerion
 *   2. Evaluate policies (deterministic, pure)
 *   3. If breach: select best swap offer via offer-router
 *   4. Sign transaction using existing CLI signing pipeline
 *   5. Broadcast using existing CLI broadcast pipeline
 *   6. Record full audit trail
 *
 * Reuses: cli/lib/trading/transaction.js (signSwapTransaction, broadcastAndWait, approveErc20)
 * Does NOT rebuild transaction handling.
 */

import * as api from "../api/client.js";
import { evaluatePolicies, validateExecution } from "./policy-engine.js";
import { selectBestOffer } from "./offer-router.js";
import { logAuditEvent } from "./audit-log.js";
import {
  isKillSwitchActive,
  generateCycleId,
  isDuplicateCycle,
  markCycleProcessed,
  retryWithBackoff,
  withTimeout,
} from "./safety.js";
import { loadTreasuryConfig, getWalletSetAddresses } from "./policy-config.js";
import { signSwapTransaction, broadcastAndWait, approveErc20 } from "../trading/transaction.js";
import { NATIVE_ASSET_ADDRESS } from "../util/constants.js";

const DATA_TIMEOUT_MS = 60_000; // 60s for data fetches (Zerion recommends ≤2 min)

/**
 * Run a single evaluation cycle (read-only — no execution).
 * @param {object} [options]
 * @param {string} [options.cycleId] - override cycle ID
 * @returns {object} { config, portfolio, positions, evaluation, cycleId }
 */
export async function runEvaluation(options = {}) {
  const cycleId = options.cycleId || generateCycleId();
  const ctx = { cycleId, idempotencyKey: cycleId };

  // Load config
  const config = loadTreasuryConfig();
  const addresses = getWalletSetAddresses(config);

  logAuditEvent("evaluation_started", { addresses, policies: config.policies.length }, ctx);

  // Fetch portfolio + positions with timeout + retry
  const [portfolioRes, positionsRes] = await Promise.all([
    retryWithBackoff(
      () => withTimeout(
        api.getWalletSetPortfolio(addresses),
        DATA_TIMEOUT_MS,
        "portfolio fetch"
      ),
      { maxRetries: 2, onRetry: (a, e) => logAuditEvent("retry", { target: "portfolio", attempt: a, error: e.message }, ctx) }
    ),
    retryWithBackoff(
      () => withTimeout(
        api.getWalletSetPositions(addresses),
        DATA_TIMEOUT_MS,
        "positions fetch"
      ),
      { maxRetries: 2, onRetry: (a, e) => logAuditEvent("retry", { target: "positions", attempt: a, error: e.message }, ctx) }
    ),
  ]);

  const totalValue = portfolioRes?.data?.attributes?.total?.positions || 0;
  const positions = positionsRes?.data || [];

  // Evaluate policies
  const evaluation = evaluatePolicies({
    positions,
    totalValue,
    policies: config.policies,
    allowedChains: config.allowedChains,
    spendCapUsd: config.spendCapUsd,
    expiresAt: config.expiresAt,
  });

  logAuditEvent("policy_evaluated", {
    passed: evaluation.passed,
    breachCount: evaluation.breaches.length,
    totalValue,
    positionCount: positions.length,
  }, ctx);

  if (evaluation.breaches.length > 0) {
    for (const breach of evaluation.breaches) {
      logAuditEvent("breach_detected", breach, ctx);
    }
  } else {
    logAuditEvent("breach_none", { message: "All policies passed" }, ctx);
  }

  return { config, portfolio: portfolioRes, positions: positionsRes, evaluation, cycleId };
}

/**
 * Run a full evaluate + execute cycle.
 * @param {object} [options]
 * @param {string} [options.walletName] - wallet name for signing
 * @param {string} [options.passphrase] - wallet passphrase
 * @param {boolean} [options.dryRun] - if true, skip actual execution
 * @returns {object} cycle result
 */
export async function runFullCycle(options = {}) {
  const cycleId = generateCycleId();
  const ctx = { cycleId, idempotencyKey: cycleId };

  // Kill switch check
  if (isKillSwitchActive()) {
    logAuditEvent("kill_switch_block", { message: "Kill switch is active" }, ctx);
    return { blocked: true, reason: "kill_switch_active", cycleId };
  }

  // Idempotency check
  if (isDuplicateCycle(cycleId)) {
    logAuditEvent("duplicate_cycle", { cycleId }, ctx);
    return { blocked: true, reason: "duplicate_cycle", cycleId };
  }

  // Mark cycle as in-progress
  markCycleProcessed(cycleId);

  // Phase 1: Evaluate
  let evalResult;
  try {
    evalResult = await runEvaluation({ cycleId });
  } catch (err) {
    logAuditEvent("evaluation_error", { error: err.message }, ctx);
    return { error: true, phase: "evaluation", message: err.message, cycleId };
  }

  const { config, evaluation } = evalResult;

  // If no breaches, we're done
  if (evaluation.passed) {
    return {
      cycleId,
      status: "clean",
      message: "All policies passed — no action needed",
      evaluation: evaluation.summary,
    };
  }

  // Phase 2: Select offers for rebalance breaches
  const rebalanceBreaches = evaluation.breaches.filter((b) => b.action === "rebalance");
  if (rebalanceBreaches.length === 0) {
    return {
      cycleId,
      status: "alert_only",
      message: "Breaches detected but none require rebalancing",
      breaches: evaluation.breaches,
      evaluation: evaluation.summary,
    };
  }

  // Kill switch check again before execution
  if (isKillSwitchActive()) {
    logAuditEvent("kill_switch_block", { phase: "pre_execution" }, ctx);
    return { blocked: true, reason: "kill_switch_active", cycleId };
  }

  const results = [];

  for (const breach of rebalanceBreaches) {
    const walletAddress = config.walletSet.evmAddress;

    // Phase 3: Get best offer
    let offer;
    try {
      offer = await selectBestOffer({ breach, walletAddress, config, ctx });
    } catch (err) {
      logAuditEvent("offer_error", { error: err.message, breach: breach.policy }, ctx);
      results.push({ breach: breach.policy, error: err.message, phase: "offer_selection" });
      continue;
    }

    if (!offer) {
      results.push({ breach: breach.policy, error: "No valid offer found", phase: "offer_selection" });
      continue;
    }

    if (offer.blocked) {
      results.push({ breach: breach.policy, blocked: true, reasons: offer.reasons });
      continue;
    }

    // Dry run: stop here
    if (options.dryRun) {
      logAuditEvent("dry_run", { offerId: offer.offerId, source: offer.liquiditySource }, ctx);
      results.push({
        breach: breach.policy,
        dryRun: true,
        offer: {
          id: offer.offerId,
          source: offer.liquiditySource,
          estimatedOutput: offer.estimatedOutput,
          gas: offer.gas,
        },
      });
      continue;
    }

    // Phase 4: Execute
    if (!options.walletName || !options.passphrase) {
      logAuditEvent("execution_blocked", { reason: "Missing wallet credentials" }, ctx);
      results.push({
        breach: breach.policy,
        error: "Wallet name and passphrase required for execution",
        phase: "execution",
        offer: { id: offer.offerId },
      });
      continue;
    }

    try {
      const txResult = await executeRebalance(offer, options.walletName, options.passphrase, ctx);
      results.push({
        breach: breach.policy,
        status: "executed",
        ...txResult,
      });
    } catch (err) {
      logAuditEvent("execution_error", { error: err.message, offerId: offer.offerId }, ctx);
      results.push({
        breach: breach.policy,
        error: err.message,
        phase: "execution",
        offerId: offer.offerId,
      });
    }
  }

  return {
    cycleId,
    status: "completed",
    evaluation: evaluation.summary,
    breaches: evaluation.breaches,
    results,
  };
}

/**
 * Execute a single rebalance transaction.
 * Reuses the existing CLI signing and broadcast pipeline.
 */
async function executeRebalance(offer, walletName, passphrase, ctx) {
  const tx = offer.transaction;
  if (!tx) {
    throw new Error("No transaction data in offer — cannot execute");
  }

  logAuditEvent("tx_signing", {
    offerId: offer.offerId,
    chain: offer.sourceChain,
    to: tx.to,
  }, ctx);

  // Handle ERC-20 approval if needed
  if (
    offer.preconditions?.enough_allowance === false &&
    offer.spender &&
    offer.sellAsset !== "eth"
  ) {
    logAuditEvent("approval_required", {
      spender: offer.spender,
      asset: offer.sellAsset,
    }, ctx);

    // We need the token address for approval — get from the tx
    // For now, skip auto-approval in v1; the user should pre-approve
    throw new Error(
      `ERC-20 approval needed for ${offer.sellAsset}. ` +
      `Spender: ${offer.spender}. Pre-approve manually or use an approved token.`
    );
  }

  // Sign the transaction
  const { signedTxHex, client } = await signSwapTransaction(
    tx,
    offer.sourceChain,
    walletName,
    passphrase
  );

  logAuditEvent("tx_signed", {
    offerId: offer.offerId,
    chain: offer.sourceChain,
  }, ctx);

  // Broadcast
  const result = await broadcastAndWait(client, signedTxHex, { timeout: 120 });

  logAuditEvent(
    result.status === "success" ? "tx_confirmed" : "tx_failed",
    {
      hash: result.hash,
      status: result.status,
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed,
      offerId: offer.offerId,
      routeHash: offer.routeHash,
      sellAsset: offer.sellAsset,
      buyAsset: offer.buyAsset,
      estimatedOutput: offer.estimatedOutput,
    },
    ctx
  );

  return {
    hash: result.hash,
    status: result.status,
    blockNumber: result.blockNumber,
    gasUsed: result.gasUsed,
    swap: {
      from: offer.sellAsset,
      to: offer.buyAsset,
      estimatedOutput: offer.estimatedOutput,
      source: offer.liquiditySource,
    },
  };
}
