/**
 * Offer Router — selects the best valid swap offer from Zerion.
 *
 * When a policy breach triggers a rebalance:
 *   1. Calculate rebalance amount from breach data
 *   2. Fetch swap offers from Zerion API (quote + ready-to-sign tx in one call)
 *   3. Filter offers by: preconditions, valid tx, safety constraints
 *   4. Rank by output amount (best execution)
 *   5. Enforce slippage + spend cap from policy
 *   6. Return best valid offer or refuse
 *
 * Does NOT build custom quotes. Uses Zerion API transaction objects as-is.
 * The 0.8% Zerion fee is already included in the quoted amounts.
 */

import * as api from "../api/client.js";
import { validateExecution } from "./policy-engine.js";
import { logAuditEvent } from "./audit-log.js";

/**
 * Fetch and select the best swap offer for a rebalance action.
 *
 * @param {object} params
 * @param {object} params.breach       - breach object from policy engine
 * @param {string} params.walletAddress - wallet address for the swap
 * @param {object} params.config       - treasury config
 * @param {object} params.ctx          - audit context { cycleId, idempotencyKey }
 * @returns {object|null} best offer or null if none valid
 */
export async function selectBestOffer({ breach, walletAddress, config, ctx }) {
  const { rebalance } = breach;
  if (!rebalance) {
    logAuditEvent("offer_skipped", { reason: "no rebalance action in breach" }, ctx);
    return null;
  }

  // Validate execution is within policy bounds before even fetching
  const precheck = validateExecution({
    chain: rebalance.sourceChain,
    amountUsd: rebalance.sellAmountUsd,
    allowedChains: config.allowedChains,
    spendCapUsd: config.spendCapUsd,
    expiresAt: config.expiresAt,
  });

  if (!precheck.allowed) {
    logAuditEvent("offer_blocked", {
      reasons: precheck.reasons,
      breach: breach.policy,
    }, ctx);
    return { blocked: true, reasons: precheck.reasons };
  }

  // Build swap offer request params
  // We need to estimate the token amount from USD value
  // First, get the positions to find the asset's current price
  const params = {
    "input[from]": walletAddress,
    "input[chain_id]": rebalance.sourceChain,
    "input[fungible_id]": rebalance.sellAsset,
    "output[chain_id]": rebalance.buyChain || rebalance.sourceChain,
    "output[fungible_id]": rebalance.buyAsset,
    slippage_percent: config.slippagePercent || 2,
    sort: "amount",
  };

  // Calculate input token amount from the USD sell target.
  // Priority — avoids extra API calls which can hit 429 rate limits:
  //   1. breach.priceUsd      — price embedded by policy-engine from position data (fastest)
  //   2. assetValue/quantity  — derived price from position totals (no API call)
  //   3. getFungible()        — last-resort API call if no position price available
  const decimals = breach.decimals ?? 18;

  if (breach.priceUsd && breach.priceUsd > 0) {
    // Fast path: policy-engine already extracted price from fetched positions
    const tokenAmount = rebalance.sellAmountUsd / breach.priceUsd;
    const rawAmount = BigInt(Math.floor(tokenAmount * Math.pow(10, decimals)));
    params["input[amount]"] = rawAmount.toString();
  } else if (breach.quantityFloat > 0 && breach.assetValue > 0) {
    // Derived path: compute price from USD value / token quantity
    const derivedPrice = breach.assetValue / breach.quantityFloat;
    const tokenAmount = rebalance.sellAmountUsd / derivedPrice;
    const rawAmount = BigInt(Math.floor(tokenAmount * Math.pow(10, decimals)));
    params["input[amount]"] = rawAmount.toString();
  } else {
    // Fallback: call getFungible — may 429 under rate limits
    try {
      const fungible = await api.getFungible(rebalance.sellAsset);
      const price = fungible?.data?.attributes?.market_data?.price;
      if (price && price > 0) {
        const tokenAmount = rebalance.sellAmountUsd / price;
        const fallbackDecimals =
          fungible?.data?.attributes?.implementations?.[0]?.decimals || 18;
        const rawAmount = BigInt(Math.floor(tokenAmount * Math.pow(10, fallbackDecimals)));
        params["input[amount]"] = rawAmount.toString();
      }
    } catch (err) {
      logAuditEvent("offer_warning", {
        message: "Could not determine token amount from price",
        error: err.message,
      }, ctx);
    }
  }

  // If we still couldn't calculate amount, we cannot proceed
  if (!params["input[amount]"]) {
    logAuditEvent("offer_failed", {
      reason: "Could not calculate input amount for swap",
    }, ctx);
    return null;
  }

  // Fetch offers from Zerion
  let response;
  try {
    response = await api.getSwapOffers(params);
  } catch (err) {
    logAuditEvent("offer_fetch_error", { error: err.message }, ctx);
    return null;
  }

  const offers = response?.data || [];
  logAuditEvent("offer_fetched", { count: offers.length, params }, ctx);

  if (offers.length === 0) {
    logAuditEvent("offer_none", { reason: "Zerion returned no offers" }, ctx);
    return null;
  }

  // Filter offers
  const validOffers = offers.filter((offer) => {
    const attrs = offer.attributes || {};

    // Must have a ready-to-sign transaction
    if (!attrs.transaction) return false;

    // Must have enough balance
    if (attrs.preconditions_met?.enough_balance === false) return false;

    // Must have a valid output quantity
    if (!attrs.estimation?.output_quantity?.float) return false;

    return true;
  });

  if (validOffers.length === 0) {
    logAuditEvent("offer_none_valid", {
      reason: "All offers failed safety/precondition filters",
      totalFetched: offers.length,
    }, ctx);
    return null;
  }

  // Rank by output amount (highest is best execution)
  validOffers.sort((a, b) => {
    const aOut = a.attributes?.estimation?.output_quantity?.float || 0;
    const bOut = b.attributes?.estimation?.output_quantity?.float || 0;
    return bOut - aOut;
  });

  const best = validOffers[0];
  const attrs = best.attributes;

  const result = {
    offerId: best.id,
    liquiditySource: attrs.liquidity_source?.name || attrs.liquidity_source?.id,
    estimatedOutput: attrs.estimation?.output_quantity?.float,
    outputMin: attrs.output_quantity_min?.float,
    inputAmount: attrs.estimation?.input_quantity?.float,
    gas: attrs.estimation?.gas,
    fee: {
      protocolPercent: attrs.fee?.protocol?.percent,
      protocolAmount: attrs.fee?.protocol?.quantity?.float,
    },
    slippageType: attrs.slippage_type,
    preconditions: attrs.preconditions_met,
    spender: attrs.asset_spender,
    transaction: attrs.transaction,
    sourceChain: rebalance.sourceChain,
    destChain: rebalance.buyChain || rebalance.sourceChain,
    sellAsset: rebalance.sellAsset,
    buyAsset: rebalance.buyAsset,
    routeHash: best.id,
  };

  logAuditEvent("offer_selected", {
    offerId: result.offerId,
    source: result.liquiditySource,
    estimatedOutput: result.estimatedOutput,
    gas: result.gas,
    routeHash: result.routeHash,
  }, ctx);

  return result;
}
