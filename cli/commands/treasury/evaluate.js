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
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));

      const pass = data.evaluation.passed;
      const statusBanner = pass 
        ? "\x1b[42m\x1b[30m\x1b[1m SAFE \x1b[0m" 
        : "\x1b[41m\x1b[37m\x1b[1m BREACH \x1b[0m";
      
      let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` CYCLE ${data.cycleId.slice(0, 8).toUpperCase()}                             ${statusBanner}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      
      const valStr = ` Total Value: \x1b[1m$${(data.portfolio.totalValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\x1b[0m`;
      out += `\x1b[1m│\x1b[0m ${p(valStr, 56)} \x1b[1m│\x1b[0m\n`;
      
      const posStr = ` Positions:   ${data.positionCount}`;
      out += `\x1b[1m│\x1b[0m ${p(posStr, 56)} \x1b[1m│\x1b[0m\n`;

      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      
      if (pass) {
        out += `\x1b[1m│\x1b[0m ${p(`  \x1b[32m✓ All parameters within policy bounds.\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
      } else {
        out += `\x1b[1m│\x1b[0m ${p(`  \x1b[31m⚠ VIOLATIONS DETECTED\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
        for (const [i, b] of data.evaluation.breaches.entries()) {
          out += `\x1b[1m│\x1b[0m ${p(`  \x1b[31m■ [${b.policy.toUpperCase()}] ${b.reason}\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
          if (b.action === "rebalance") {
            out += `\x1b[1m│\x1b[0m ${p(`    ↳ Rebalance: SELL $${b.rebalance.sellAmountUsd.toLocaleString()} ${b.rebalance.sellAsset}`, 56)} \x1b[1m│\x1b[0m\n`;
          }
        }
      }
      
      if (data.positions) {
        out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
        out += `\x1b[1m│\x1b[0m ${p(`  TOP HOLDINGS`, 56)} \x1b[1m│\x1b[0m\n`;
        for (const p_ of data.positions.slice(0, 5)) {
          const rowText = ` - ${(p_.asset || "???").padEnd(10)}: $${parseFloat(p_.value).toLocaleString().padEnd(15)}`;
          out += `\x1b[1m│\x1b[0m ${p(rowText, 56)} \x1b[1m│\x1b[0m\n`;
        }
      }
      
      out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
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
