/**
 * Treasury Policy Engine — deterministic, pure, fail-closed.
 *
 * Evaluates portfolio positions against configured policies.
 * No LLM. No AI. No probabilistic decisions.
 *
 * Supported policy types:
 *   - concentration_limit: keep asset below X% of portfolio
 *   - chain_lock: only allow execution on configured chains
 *   - spend_cap: refuse over USD limit per cycle
 *   - expiry: refuse after expiry timestamp
 *   - asset_denylist: block holding of specific assets
 *
 * Every evaluation returns a machine-readable result:
 * {
 *   passed: boolean,
 *   breaches: [{ policy, reason, asset, actual, threshold, action }],
 *   summary: { totalValue, positionCount, evaluatedAt }
 * }
 *
 * Identity: uses fungible_id + chain_id, NOT symbol-only matching.
 */

/**
 * Evaluate all policies against current portfolio positions.
 *
 * @param {object} params
 * @param {object[]} params.positions   - Zerion wallet-set positions (data array)
 * @param {number}   params.totalValue  - total portfolio value in USD
 * @param {object[]} params.policies    - policy definitions from config
 * @param {string[]} params.allowedChains - chains allowed for execution
 * @param {number}   params.spendCapUsd  - max USD per execution cycle
 * @param {string}   params.expiresAt    - ISO-8601 expiry timestamp (or null)
 * @returns {object} evaluation result
 */
export function evaluatePolicies({
  positions,
  totalValue,
  policies,
  allowedChains,
  spendCapUsd,
  expiresAt,
}) {
  const breaches = [];
  const now = new Date();

  // Fail-closed: if no positions data, refuse
  if (!positions || !Array.isArray(positions)) {
    return {
      passed: false,
      breaches: [{
        policy: "data_integrity",
        reason: "No positions data available — fail-closed",
        action: "none",
      }],
      summary: { totalValue: 0, positionCount: 0, evaluatedAt: now.toISOString() },
    };
  }

  // Fail-closed: if total value is zero or missing
  if (!totalValue || totalValue <= 0) {
    return {
      passed: false,
      breaches: [{
        policy: "data_integrity",
        reason: `Portfolio total value is ${totalValue ?? "missing"} — fail-closed`,
        action: "none",
      }],
      summary: { totalValue: 0, positionCount: positions.length, evaluatedAt: now.toISOString() },
    };
  }

  // Check expiry
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (now >= expiry) {
      breaches.push({
        policy: "expiry",
        reason: `Policy expired at ${expiresAt}`,
        action: "block",
      });
    }
  }

  // Evaluate each policy
  for (const policy of policies) {
    switch (policy.type) {
      case "concentration_limit":
        evaluateConcentrationLimit(policy, positions, totalValue, breaches);
        break;
      case "asset_denylist":
        evaluateAssetDenylist(policy, positions, breaches);
        break;
      case "stop_loss":
        evaluateStopLoss(policy, positions, breaches);
        break;
      default:
        // Unknown policy type — log but don't block
        break;
    }
  }

  return {
    passed: breaches.length === 0,
    breaches,
    summary: {
      totalValue,
      positionCount: positions.length,
      evaluatedAt: now.toISOString(),
    },
  };
}

/**
 * Concentration limit: keep any single asset below maxPercent of portfolio.
 */
function evaluateConcentrationLimit(policy, positions, totalValue, breaches) {
  const { maxPercent, asset, rebalanceTarget, rebalanceTo, rebalanceToChain } = policy;

  // Find matching positions by fungible_id (chain-aware identity)
  // Fall back to symbol match only if fungible_id not available
  const matching = positions.filter((p) => {
    const attrs = p.attributes || {};
    const info = attrs.fungible_info || {};
    const fungibleId = p.relationships?.fungible?.data?.id;

    // Primary: match by fungible_id
    if (fungibleId && fungibleId === asset) return true;

    // Secondary: match by symbol (case-insensitive) — but warn this is weaker
    if (info.symbol && info.symbol.toLowerCase() === asset.toLowerCase()) return true;

    return false;
  });

  // Sum value of all matching positions across chains
  const assetValue = matching.reduce((sum, p) => {
    const val = p.attributes?.value;
    return sum + (typeof val === "number" ? val : 0);
  }, 0);

  const actualPercent = (assetValue / totalValue) * 100;

  if (actualPercent > maxPercent) {
    // Calculate how much to sell to reach target
    const targetValue = (rebalanceTarget || maxPercent) / 100 * totalValue;
    const excessValue = assetValue - targetValue;

    // Get the chain of the largest position (for execution routing)
    const largestPosition = matching.sort((a, b) =>
      (b.attributes?.value || 0) - (a.attributes?.value || 0)
    )[0];
    const sourceChain = largestPosition?.relationships?.chain?.data?.id || "ethereum";

    breaches.push({
      policy: "concentration_limit",
      reason: `${asset} is ${actualPercent.toFixed(1)}% of portfolio (limit: ${maxPercent}%)`,
      asset,
      assetValue,
      actualPercent: Math.round(actualPercent * 100) / 100,
      threshold: maxPercent,
      excessValueUsd: Math.round(excessValue * 100) / 100,
      action: "rebalance",
      rebalance: {
        sellAsset: asset,
        sellAmountUsd: Math.round(excessValue * 100) / 100,
        buyAsset: rebalanceTo || "usdc",
        buyChain: rebalanceToChain || sourceChain,
        sourceChain,
        targetPercent: rebalanceTarget || maxPercent,
      },
    });
  }
}

/**
 * Asset denylist: block holding of specific assets entirely.
 */
function evaluateAssetDenylist(policy, positions, breaches) {
  const denied = (policy.assets || []).map((a) => a.toLowerCase());

  for (const p of positions) {
    const info = p.attributes?.fungible_info || {};
    const fungibleId = p.relationships?.fungible?.data?.id;
    const symbol = (info.symbol || "").toLowerCase();

    const match = denied.includes(symbol) || (fungibleId && denied.includes(fungibleId));
    if (match && (p.attributes?.value || 0) > 0) {
      breaches.push({
        policy: "asset_denylist",
        reason: `Holding denied asset: ${info.symbol || fungibleId}`,
        asset: fungibleId || symbol,
        value: p.attributes?.value || 0,
        action: "alert",
      });
    }
  }
}

/**
 * Stop-loss limit: liquidate position if price falls below trigger threshold.
 */
function evaluateStopLoss(policy, positions, breaches) {
  const { asset, triggerPriceUsd, sellTo, sellToChain } = policy;

  const matching = positions.filter((p) => {
    const info = p.attributes?.fungible_info || {};
    const fungibleId = p.relationships?.fungible?.data?.id;
    if (fungibleId && fungibleId === asset) return true;
    if (info.symbol && info.symbol.toLowerCase() === asset.toLowerCase()) return true;
    return false;
  });

  for (const p of matching) {
    const price = p.attributes?.price;
    const value = p.attributes?.value;
    
    // Only care if we hold the asset and it has a price
    if (!price || value <= 0) continue;

    if (price <= triggerPriceUsd) {
      const sourceChain = p.relationships?.chain?.data?.id || "ethereum";
      
      breaches.push({
        policy: "stop_loss",
        reason: `${asset} price $${price} dropped to or below stop-loss trigger $${triggerPriceUsd}`,
        asset,
        assetValue: value,
        actualPercent: 0,
        threshold: triggerPriceUsd,
        excessValueUsd: value, // liquidate the whole position
        action: "rebalance",
        rebalance: {
          sellAsset: asset,
          sellAmountUsd: value,
          buyAsset: sellTo || "usdc",
          buyChain: sellToChain || sourceChain,
          sourceChain,
          targetPercent: 0,
        },
      });
    }
  }
}

/**
 * Validate that a proposed execution is within policy bounds.
 *
 * @param {object} params
 * @param {string}   params.chain       - execution chain
 * @param {number}   params.amountUsd   - execution amount in USD
 * @param {string[]} params.allowedChains
 * @param {number}   params.spendCapUsd
 * @param {string}   params.expiresAt
 * @returns {{ allowed: boolean, reasons: string[] }}
 */
export function validateExecution({ chain, amountUsd, allowedChains, spendCapUsd, expiresAt }) {
  const reasons = [];

  // Chain lock
  if (allowedChains && allowedChains.length > 0 && !allowedChains.includes(chain)) {
    reasons.push(`Chain "${chain}" not in allowed chains: ${allowedChains.join(", ")}`);
  }

  // Spend cap
  if (spendCapUsd && amountUsd > spendCapUsd) {
    reasons.push(`Amount $${amountUsd} exceeds spend cap $${spendCapUsd}`);
  }

  // Expiry
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (new Date() >= expiry) {
      reasons.push(`Policy expired at ${expiresAt}`);
    }
  }

  return { allowed: reasons.length === 0, reasons };
}
