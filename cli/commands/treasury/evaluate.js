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

    print(output);
  } catch (err) {
    printError(err.code || "evaluation_error", err.message, {
      suggestion: err.code === "missing_treasury_config"
        ? "Create a policy: zerion treasury policies --init"
        : undefined,
    });
    process.exit(1);
  }
}
