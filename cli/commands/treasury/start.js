/**
 * treasury start — start the autonomous monitoring loop.
 *
 * Usage: zerion treasury start [--dry-run] [--wallet <name>] [--webhook-only]
 *
 * Runs a polling loop at configured interval + optional webhook server.
 * Each cycle: fetch data → evaluate → if breach: select offer → execute.
 */

import { loadTreasuryConfig, getWalletSetAddresses } from "../../lib/treasury/policy-config.js";
import { runFullCycle } from "../../lib/treasury/executor.js";
import { startWebhookServer } from "../../lib/treasury/webhook-server.js";
import { isKillSwitchActive } from "../../lib/treasury/safety.js";
import { logAuditEvent, getAuditLogPath } from "../../lib/treasury/audit-log.js";
import { print, printError } from "../../lib/util/output.js";
import { getConfigValue } from "../../lib/config.js";

// Agent state (in-memory for this process)
let running = false;
let cycleCount = 0;
let lastEvaluation = null;
let webhookHandle = null;

export default async function treasuryStart(args, flags) {
  const dryRun = flags["dry-run"] || flags.dryRun || false;
  const walletName = flags.wallet || getConfigValue("defaultWallet");
  const passphrase = process.env.TREASURY_WALLET_PASSPHRASE || null;

  // Load and validate config
  let config;
  try {
    config = loadTreasuryConfig();
  } catch (err) {
    printError(err.code || "config_error", err.message);
    process.exit(1);
  }

  const addresses = getWalletSetAddresses(config);

  process.stderr.write("\n┌─────────────────────────────────────────────┐\n");
  process.stderr.write("│  Treasury Guardian — Autonomous Agent       │\n");
  process.stderr.write("├─────────────────────────────────────────────┤\n");
  process.stderr.write(`│  Wallet set: ${addresses[0]?.slice(0, 10)}...${addresses[0]?.slice(-6) || "N/A"}         │\n`);
  process.stderr.write(`│  Policies:   ${config.policies.length} active                       │\n`);
  process.stderr.write(`│  Spend cap:  $${config.spendCapUsd}                           │\n`);
  process.stderr.write(`│  Poll:       ${config.pollIntervalMs / 1000}s                            │\n`);
  process.stderr.write(`│  Dry run:    ${dryRun ? "YES" : "NO"}                             │\n`);
  process.stderr.write(`│  Audit log:  ${getAuditLogPath()}  │\n`);
  process.stderr.write("└─────────────────────────────────────────────┘\n\n");

  logAuditEvent("agent_started", {
    addresses,
    dryRun,
    pollIntervalMs: config.pollIntervalMs,
    policyCount: config.policies.length,
  });

  running = true;

  // Start webhook server if callback URL is configured
  if (config.webhookCallbackUrl || config.webhookPort) {
    try {
      webhookHandle = await startWebhookServer({
        port: config.webhookPort || 3456,
        onTrigger: async (payload) => {
          process.stderr.write("[webhook] Trigger received — running evaluation cycle\n");
          await runCycle(config, walletName, passphrase, dryRun);
        },
      });
      process.stderr.write(`[agent] Webhook server started on port ${config.webhookPort || 3456}\n`);
    } catch (err) {
      process.stderr.write(`[agent] Webhook server failed to start: ${err.message}\n`);
      process.stderr.write("[agent] Continuing with polling only\n");
    }
  }

  // Graceful shutdown
  const shutdown = async () => {
    process.stderr.write("\n[agent] Shutting down...\n");
    running = false;
    if (webhookHandle) await webhookHandle.close();
    logAuditEvent("agent_stopped", { cycleCount });
    process.stderr.write(`[agent] Stopped after ${cycleCount} cycles\n`);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Run first cycle immediately
  await runCycle(config, walletName, passphrase, dryRun);

  // Polling loop
  while (running) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (!running) break;
    await runCycle(config, walletName, passphrase, dryRun);
  }
}

async function runCycle(config, walletName, passphrase, dryRun) {
  cycleCount++;

  // Check kill switch at every cycle start
  if (isKillSwitchActive()) {
    process.stderr.write(`[cycle ${cycleCount}] Kill switch active — skipping\n`);
    logAuditEvent("kill_switch_block", { cycle: cycleCount });
    return;
  }

  process.stderr.write(`[cycle ${cycleCount}] Starting evaluation...\n`);

  try {
    const result = await runFullCycle({
      walletName,
      passphrase,
      dryRun,
    });

    lastEvaluation = result;

    if (result.blocked) {
      process.stderr.write(`[cycle ${cycleCount}] Blocked: ${result.reason}\n`);
    } else if (result.error) {
      process.stderr.write(`[cycle ${cycleCount}] Error in ${result.phase}: ${result.message}\n`);
    } else if (result.status === "clean") {
      process.stderr.write(`[cycle ${cycleCount}] Clean — no breaches\n`);
    } else {
      process.stderr.write(`[cycle ${cycleCount}] Completed — ${result.results?.length || 0} actions\n`);
      print(result);
    }
  } catch (err) {
    process.stderr.write(`[cycle ${cycleCount}] Error: ${err.message}\n`);
    logAuditEvent("cycle_error", { cycle: cycleCount, error: err.message });
  }
}
