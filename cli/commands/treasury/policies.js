/**
 * treasury policies — display active treasury policies.
 *
 * Usage:
 *   zerion treasury policies          — show loaded policies
 *   zerion treasury policies --init   — generate sample policy file
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { loadTreasuryConfig, getPolicyPath, getSamplePolicyJson } from "../../lib/treasury/policy-config.js";
import { print, printError } from "../../lib/util/output.js";
import { CONFIG_DIR } from "../../lib/util/constants.js";

export default async function treasuryPolicies(args, flags) {
  // --init: generate sample policy file
  if (flags.init) {
    const path = getPolicyPath();
    if (existsSync(path)) {
      printError("config_exists", `Policy file already exists at ${path}`, {
        suggestion: "Delete it first or edit it manually.",
      });
      process.exit(1);
    }
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(path, getSamplePolicyJson() + "\n", { mode: 0o600 });
    print({
      created: path,
      message: "Sample treasury policy created. Edit the file to configure your wallet and policies.",
      nextStep: "zerion treasury evaluate",
    });
    return;
  }

  // Show loaded policies
  try {
    const config = loadTreasuryConfig();
    const output = {
      policyFile: getPolicyPath(),
      walletSet: config.walletSet,
      policies: config.policies.map((p, i) => ({
        index: i,
        type: p.type,
        ...p,
      })),
      constraints: {
        allowedChains: config.allowedChains,
        spendCapUsd: config.spendCapUsd,
        expiresAt: config.expiresAt || "never",
        slippagePercent: config.slippagePercent,
      },
      monitoring: {
        pollIntervalMs: config.pollIntervalMs,
        webhookPort: config.webhookPort,
        webhookCallbackUrl: config.webhookCallbackUrl || "not configured",
      },
    };
    print(output);
  } catch (err) {
    printError(err.code || "config_error", err.message, {
      suggestion: "Create a policy: zerion treasury policies --init",
    });
    process.exit(1);
  }
}
