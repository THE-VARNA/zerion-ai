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

const DEFAULT_POLICY_PATH = `${CONFIG_DIR}/treasury-policy.json`;

export default async function treasuryPolicies(args, flags) {
  // --init: generate sample policy file
  if (flags.init) {
    const path = getPolicyPath().replace(".json", "-template.json");
    if (existsSync(path)) {
      printError("config_exists", `Policy template already exists at ${path}`, {
        suggestion: "Delete it first or activate it with: mv ... policy.json",
      });
      process.exit(1);
    }
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(path, getSamplePolicyJson() + "\n", { mode: 0o600 });
    print({
      created: path,
      message: "Sample 'demo-default' policy created. You MUST activate it before use.",
      activationCommand: `mv ${path} ${path.replace('template.json', 'policy.json')}`,
      nextStep: "zerion treasury evaluate",
    }, (data) => {
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
      let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(" \x1b[42m\x1b[37m ❖ CONFIGURATION TEMPLATE CREATED \x1b[0m", 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Path:    ${data.created}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Action:  Activate with:`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`          ${data.activationCommand}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
      return out;
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
    print(output, (data) => {
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
      let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(" ❖ ACTIVE TREASURY POLICIES", 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Sources:  ${data.policyFile}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Wallet:   ${data.walletSet.evmAddress.slice(0, 10)}...`, 56)} \x1b[1m│\x1b[0m\n`;
      
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` ACTIVE RULES: ${data.policies.length}`, 56)} \x1b[1m│\x1b[0m\n`;
      for (const pol of data.policies) {
        const row = ` - [${pol.type.toUpperCase()}] on ${pol.asset.toUpperCase()}`;
        out += `\x1b[1m│\x1b[0m ${p(row, 56)} \x1b[1m│\x1b[0m\n`;
      }
      
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` GLOBAL CONSTRAINTS:`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` - Spend Cap:  $${data.constraints.spendCapUsd}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` - Slippage:   $${data.constraints.slippagePercent}%`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` - Poll Int:   ${data.monitoring.pollIntervalMs}ms`, 56)} \x1b[1m│\x1b[0m\n`;
      
      out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
      return out;
    });
  } catch (err) {
    printError(err.code || "config_error", err.message, {
      suggestion: "Create a policy: zerion treasury policies --init",
    });
    process.exit(1);
  }
}
