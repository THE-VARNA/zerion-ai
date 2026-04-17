/**
 * treasury trigger — manually trigger a full evaluate + execute cycle.
 *
 * Usage: zerion treasury trigger [--wallet <name>] [--dry-run]
 *
 * Runs the complete lifecycle: evaluate → select offer → execute.
 * Requires TREASURY_WALLET_PASSPHRASE env var for execution.
 */

import { runFullCycle } from "../../lib/treasury/executor.js";
import { print, printError } from "../../lib/util/output.js";
import { isKillSwitchActive } from "../../lib/treasury/safety.js";
import { getConfigValue } from "../../lib/config.js";

export default async function treasuryTrigger(args, flags) {
  if (isKillSwitchActive()) {
    print({
      status: "blocked",
      reason: "Kill switch is active. Deactivate with: zerion treasury kill-switch off",
    });
    return;
  }

  const dryRun = flags["dry-run"] || flags.dryRun || false;
  const walletName = flags.wallet || getConfigValue("defaultWallet");
  const passphrase = process.env.TREASURY_WALLET_PASSPHRASE || null;

  if (!dryRun && !passphrase) {
    printError("missing_passphrase",
      "TREASURY_WALLET_PASSPHRASE environment variable required for execution",
      { suggestion: "Set it with: export TREASURY_WALLET_PASSPHRASE='your-passphrase'" }
    );
    process.exit(1);
  }

  try {
    process.stderr.write(dryRun
      ? "[trigger] Running in DRY RUN mode — no transactions will be broadcast\n"
      : "[trigger] Running LIVE mode — transactions WILL be broadcast\n"
    );

    const result = await runFullCycle({
      walletName,
      passphrase,
      dryRun,
    });

    print(result);
  } catch (err) {
    printError(err.code || "trigger_error", err.message);
    process.exit(1);
  }
}
