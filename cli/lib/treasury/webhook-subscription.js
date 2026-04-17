/**
 * Webhook Subscription Manager
 *
 * Helps create, list, and delete Zerion transaction webhook subscriptions.
 * Works closely with the webhook-server to connect the treasury agent
 * to live onchain events.
 */

import * as api from "../api/client.js";
import { getApiKey } from "../config.js";
import { logAuditEvent } from "./audit-log.js";

/**
 * Setup a webhook subscription for the treasury wallet set.
 *
 * @param {object} config - Treasury config containing walletSet and webhookCallbackUrl
 * @returns {Promise<object>} The created subscription payload
 */
export async function setupWebhookSubscription(config) {
  if (!config.webhookCallbackUrl) {
    throw new Error("Cannot setup subscription: webhookCallbackUrl is not defined in treasury config.");
  }

  const addresses = [];
  if (config.walletSet.evmAddress) addresses.push(config.walletSet.evmAddress);
  if (config.walletSet.solanaAddress) addresses.push(config.walletSet.solanaAddress);

  if (addresses.length === 0) {
    throw new Error("Cannot setup subscription: no EVM or Solana address in treasury config.");
  }

  try {
    const payload = await api.createTxSubscription(
      config.webhookCallbackUrl,
      addresses,
      config.allowedChains || []
    );
    
    logAuditEvent("subscription_created", {
      callbackUrl: config.webhookCallbackUrl,
      addresses,
      chains: config.allowedChains,
      subscriptionId: payload.data?.id
    });
    
    return payload;
  } catch (err) {
    logAuditEvent("subscription_error", {
      error: err.message,
      action: "creation"
    });
    throw err;
  }
}

/**
 * Ensures a webhook subscription exists, recreating it if necessary.
 * Useful to run at startup.
 * 
 * @param {object} config 
 */
export async function ensureWebhookSubscription(config) {
  if (!config.webhookCallbackUrl) return null;
  
  // Basic Auth is required for subscriptions
  if (!getApiKey()) return null;

  try {
    const existing = await api.listTxSubscriptions();
    const subs = existing.data || [];
    
    // Check if we already have a matching subscription
    const match = subs.find(s => s.attributes?.callback_url === config.webhookCallbackUrl);
    
    if (match) {
      logAuditEvent("subscription_verified", { subscriptionId: match.id });
      return match;
    }
    
    // Create new if none matches
    return await setupWebhookSubscription(config);
  } catch (err) {
    // We don't want to crash the agent if fetching subscriptions fails
    // Print a warning and move on
    process.stderr.write(`[webhook] Warning: could not verify subscription (${err.message})\n`);
    return null;
  }
}

/**
 * List all active treasury subscriptions.
 */
export async function getActiveSubscriptions() {
  const result = await api.listTxSubscriptions();
  return result.data || [];
}

/**
 * Delete a webhook subscription.
 */
export async function removeSubscription(subscriptionId) {
  return await api.deleteTxSubscription(subscriptionId);
}
