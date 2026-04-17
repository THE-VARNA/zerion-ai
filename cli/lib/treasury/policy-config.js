/**
 * Treasury policy configuration — loads and validates policy from
 * ~/.zerion/treasury-policy.json or TREASURY_POLICY_PATH env var.
 *
 * Schema:
 * {
 *   walletSet: { evmAddress: string, solanaAddress?: string },
 *   policies: [{ type, ... }],
 *   allowedChains: string[],
 *   spendCapUsd: number,
 *   expiresAt: string (ISO-8601),
 *   slippagePercent: number,
 *   pollIntervalMs: number,
 *   webhookPort: number,
 *   webhookCallbackUrl?: string
 * }
 */

import { existsSync, readFileSync } from "node:fs";
import { CONFIG_DIR } from "../util/constants.js";

const DEFAULT_POLICY_PATH = `${CONFIG_DIR}/treasury-policy.json`;

const DEFAULTS = {
  walletSet: { evmAddress: null, solanaAddress: null },
  policies: [],
  allowedChains: ["ethereum", "base", "arbitrum", "optimism", "polygon"],
  spendCapUsd: 500,
  expiresAt: null,
  slippagePercent: 2,
  pollIntervalMs: 60000,
  webhookPort: 3456,
  webhookCallbackUrl: null,
};

/**
 * Load treasury policy config.
 * @returns {object} merged config with defaults
 * @throws {Error} if file missing or invalid
 */
export function loadTreasuryConfig() {
  const path = process.env.TREASURY_POLICY_PATH || DEFAULT_POLICY_PATH;

  if (!existsSync(path)) {
    const err = new Error(
      `Treasury policy not found at ${path}.\n` +
      `Create one with: zerion treasury policies --init\n` +
      `Or set TREASURY_POLICY_PATH to a custom location.`
    );
    err.code = "missing_treasury_config";
    throw err;
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    const err = new Error(`Invalid treasury policy JSON at ${path}: ${e.message}`);
    err.code = "invalid_treasury_config";
    throw err;
  }

  const config = { ...DEFAULTS, ...raw };

  // Validate required fields
  const errors = [];

  if (!config.walletSet?.evmAddress && !config.walletSet?.solanaAddress) {
    errors.push("walletSet must have at least one address (evmAddress or solanaAddress)");
  }

  if (!Array.isArray(config.policies) || config.policies.length === 0) {
    errors.push("At least one policy must be defined in 'policies' array");
  }

  for (const [i, p] of (config.policies || []).entries()) {
    if (!p.type) errors.push(`policies[${i}] missing 'type'`);
    if (p.type === "concentration_limit") {
      if (typeof p.maxPercent !== "number") errors.push(`policies[${i}] concentration_limit requires 'maxPercent' (number)`);
      if (!p.asset) errors.push(`policies[${i}] concentration_limit requires 'asset' (fungible_id or symbol)`);
    } else if (p.type === "stop_loss") {
      if (typeof p.triggerPriceUsd !== "number") errors.push(`policies[${i}] stop_loss requires 'triggerPriceUsd' (number)`);
      if (!p.asset) errors.push(`policies[${i}] stop_loss requires 'asset' (fungible_id or symbol)`);
    }
  }

  if (typeof config.spendCapUsd !== "number" || config.spendCapUsd <= 0) {
    errors.push("spendCapUsd must be a positive number");
  }

  if (config.expiresAt) {
    const exp = new Date(config.expiresAt);
    if (isNaN(exp.getTime())) errors.push("expiresAt must be a valid ISO-8601 date");
  }

  if (errors.length > 0) {
    const err = new Error(
      `Treasury policy validation failed:\n  - ${errors.join("\n  - ")}`
    );
    err.code = "invalid_treasury_config";
    throw err;
  }

  return config;
}

/**
 * Get the wallet-set addresses array for Zerion API calls.
 * @param {object} config - treasury config
 * @returns {string[]} addresses
 */
export function getWalletSetAddresses(config) {
  const addresses = [];
  if (config.walletSet.evmAddress) addresses.push(config.walletSet.evmAddress);
  if (config.walletSet.solanaAddress) addresses.push(config.walletSet.solanaAddress);
  return addresses;
}

/**
 * Get default policy path (for display).
 */
export function getPolicyPath() {
  return process.env.TREASURY_POLICY_PATH || DEFAULT_POLICY_PATH;
}

/**
 * Generate a sample policy file content.
 */
export function getSamplePolicyJson() {
  return JSON.stringify({
    walletSet: {
      evmAddress: "0xYOUR_EVM_ADDRESS_HERE",
      solanaAddress: null,
    },
    policies: [
      {
        type: "concentration_limit",
        maxPercent: 40,
        asset: "eth",
        rebalanceTarget: 30,
        rebalanceTo: "usdc",
        rebalanceToChain: "ethereum",
      },
      {
        type: "stop_loss",
        asset: "pepe",
        triggerPriceUsd: 0.005,
        sellTo: "usdc",
      },
    ],
    allowedChains: ["ethereum", "base", "arbitrum", "optimism", "polygon"],
    spendCapUsd: 500,
    expiresAt: "2026-12-31T23:59:59Z",
    slippagePercent: 2,
    pollIntervalMs: 60000,
    webhookPort: 3456,
    webhookCallbackUrl: null,
  }, null, 2);
}
