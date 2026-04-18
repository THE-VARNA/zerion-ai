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
    }, (data) => {
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
      let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(" \x1b[41m\x1b[37m ❖ EXECUTION BLOCKED \x1b[0m", 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Status:   \x1b[31mARRESTED\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Reason:   Safety Kill-Switch is active.`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Action:   zerion treasury kill-switch off`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
      return out;
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

    print(result, (data) => {
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
      
      let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` ⚡ EXECUTION CYCLE: ${data.cycleId?.slice(0, 8).toUpperCase() || "MANUAL"}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      
      const status = data.status || "UNKNOWN";
      const statusColor = status === "executed" ? "\x1b[32m" : "\x1b[33m";
      out += `\x1b[1m│\x1b[0m ${p(` Status:   ${statusColor}${status.toUpperCase()}\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Mode:     ${dryRun ? "\x1b[33mDRY RUN\x1b[0m" : "\x1b[31mLIVE\x1b[0m"}`, 56)} \x1b[1m│\x1b[0m\n`;
      
      if (data.breaches > 0) {
        out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
        out += `\x1b[1m│\x1b[0m ${p(` \x1b[31m✖ DETECTED BREACHES: ${data.breaches}\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
      }

      if (data.executions && data.executions.length > 0) {
        out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
        out += `\x1b[1m│\x1b[0m ${p(` ACTIONS TAKEN:`, 56)} \x1b[1m│\x1b[0m\n`;
        for (const exec of data.executions) {
          const row = ` - \x1b[32m${exec.type.toUpperCase()}:\x1b[0m ${exec.asset}`;
          out += `\x1b[1m│\x1b[0m ${p(row, 56)} \x1b[1m│\x1b[0m\n`;
          if (exec.txHash) {
            out += `\x1b[1m│\x1b[0m ${p(`   ↳ Hash: ${exec.txHash.slice(0, 20)}...`, 56)} \x1b[1m│\x1b[0m\n`;
          }
        }
      } else if (data.status === "clean") {
        out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
        out += `\x1b[1m│\x1b[0m ${p(`  \x1b[32m✓ All policies pass. No action required.\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
      }

      out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
      return out;
    });
  } catch (err) {
    printError(err.code || "trigger_error", err.message);
    process.exit(1);
  }
}
