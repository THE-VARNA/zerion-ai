/**
 * treasury evaluate — run a single evaluation cycle (read-only).
 *
 * Usage: zerion treasury evaluate [--verbose]
 *
 * Fetches live wallet-set data, evaluates all policies, reports results.
 * Does NOT execute any transactions.
 */

import { runEvaluation } from "../../lib/treasury/executor.js";
import { print, printError } from "../../lib/util/output.js";
import { isKillSwitchActive } from "../../lib/treasury/safety.js";

export default async function treasuryEvaluate(args, flags) {
  if (isKillSwitchActive()) {
    print({
      status: "blocked",
      reason: "Kill switch is active. Deactivate with: zerion treasury kill-switch off",
    });
    return;
  }

  try {
    const result = await runEvaluation();

    const output = {
      cycleId: result.cycleId,
      evaluation: result.evaluation,
      portfolio: {
        totalValue: result.portfolio?.data?.attributes?.total?.positions,
        distribution: result.portfolio?.data?.attributes?.positions_distribution_by_chain,
      },
      positionCount: result.positions?.data?.length || 0,
    };

    if (flags.verbose) {
      output.positions = (result.positions?.data || []).slice(0, 20).map((p) => ({
        asset: p.attributes?.fungible_info?.symbol,
        fungibleId: p.relationships?.fungible?.data?.id,
        chain: p.relationships?.chain?.data?.id,
        value: p.attributes?.value,
        quantity: p.attributes?.quantity?.float,
        price: p.attributes?.price,
      }));
    }

    print(output, (data) => {
      let out = `\n\x1b[1m=== TREASURY EVALUATION CYCLE: ${data.cycleId.slice(0, 8)} ===\x1b[0m\n\n`;
      out += `Total Portfolio Value: $${(data.portfolio.totalValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
      out += `Positions Evaluated:   ${data.positionCount}\n\n`;
      
      out += `\x1b[1mPolicy Results:\x1b[0m\n`;
      if (data.evaluation.passed) {
        out += `\x1b[32m [√] PASSED: All treasury parameters are within bounds.\x1b[0m\n`;
      } else {
        out += `\x1b[31m [X] FAILED: Treasury bounds breached!\x1b[0m\n\n`;
        for (const [i, b] of data.evaluation.breaches.entries()) {
          out += `  \x1b[31m${i + 1}. [${b.policy.toUpperCase()}] ${b.reason}\x1b[0m\n`;
          if (b.action === "rebalance") {
            out += `     -> Action: REBALANCE $${b.rebalance.sellAmountUsd.toLocaleString()} ${b.rebalance.sellAsset} => ${b.rebalance.buyAsset}\n`;
          } else {
            out += `     -> Action: ${b.action.toUpperCase()}\n`;
          }
        }
      }
      
      if (data.positions) {
        out += `\n\x1b[1mTop Evaluated Positions:\x1b[0m\n`;
        for (const p of data.positions.slice(0, 5)) {
          out += ` - ${(p.asset || "Unknown").padEnd(10)}: $${parseFloat(p.value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
        }
        if (data.positions.length > 5) out += ` - ... and ${data.positions.length - 5} more\n`;
      }
      
      return out;
    });
  } catch (err) {
    printError(err.code || "evaluation_error", err.message, {
      suggestion: err.code === "missing_treasury_config"
        ? "Create a policy: zerion treasury policies --init"
        : undefined,
    });
    process.exit(1);
  }
}
