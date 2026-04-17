/**
 * Safety controls — kill switch, idempotency, retry with backoff, timeouts.
 *
 * Kill switch: file-based at ~/.zerion/treasury-kill-switch.
 *   - If the file exists, all execution is blocked.
 *   - CLI commands: `treasury kill-switch on` / `treasury kill-switch off`
 *
 * Idempotency: UUID per evaluation cycle, stored in a ring buffer.
 *   - Deduplicates cycles that fire from both polling and webhooks.
 *
 * Retry: exponential backoff (1s → 2s → 4s), max 3 attempts.
 */

import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { CONFIG_DIR } from "../util/constants.js";

const KILL_SWITCH_PATH = `${CONFIG_DIR}/treasury-kill-switch`;
const IDEMPOTENCY_PATH = `${CONFIG_DIR}/treasury-idempotency.json`;
const MAX_IDEMPOTENCY_ENTRIES = 200;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// --- Kill Switch ---

export function isKillSwitchActive() {
  return existsSync(KILL_SWITCH_PATH);
}

export function activateKillSwitch(reason = "manual") {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(KILL_SWITCH_PATH, JSON.stringify({
    activatedAt: new Date().toISOString(),
    reason,
  }) + "\n", { mode: 0o600 });
}

export function deactivateKillSwitch() {
  if (existsSync(KILL_SWITCH_PATH)) {
    unlinkSync(KILL_SWITCH_PATH);
  }
}

export function getKillSwitchInfo() {
  if (!existsSync(KILL_SWITCH_PATH)) return null;
  try {
    return JSON.parse(readFileSync(KILL_SWITCH_PATH, "utf-8"));
  } catch {
    return { activatedAt: "unknown", reason: "file exists but unreadable" };
  }
}

// --- Idempotency ---

export function generateCycleId() {
  return randomUUID();
}

/**
 * Check if a cycle has already been processed.
 * @param {string} cycleId
 * @returns {boolean} true if already seen
 */
export function isDuplicateCycle(cycleId) {
  const seen = loadIdempotencyStore();
  return seen.includes(cycleId);
}

/**
 * Mark a cycle as processed.
 * @param {string} cycleId
 */
export function markCycleProcessed(cycleId) {
  const seen = loadIdempotencyStore();
  seen.push(cycleId);
  // Ring buffer: keep only last N entries
  while (seen.length > MAX_IDEMPOTENCY_ENTRIES) seen.shift();
  saveIdempotencyStore(seen);
}

function loadIdempotencyStore() {
  if (!existsSync(IDEMPOTENCY_PATH)) return [];
  try {
    return JSON.parse(readFileSync(IDEMPOTENCY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveIdempotencyStore(store) {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(IDEMPOTENCY_PATH, JSON.stringify(store), { mode: 0o600 });
}

// --- Retry with Backoff ---

/**
 * Retry an async function with exponential backoff.
 * @param {Function} fn - async function to retry
 * @param {object} options
 * @param {number} options.maxRetries - max attempts (default 3)
 * @param {number} options.baseMs - base delay in ms (default 1000)
 * @param {Function} options.onRetry - called with (attempt, error)
 * @returns {Promise<*>} result of fn
 */
export async function retryWithBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const baseMs = options.baseMs ?? BASE_BACKOFF_MS;
  const onRetry = options.onRetry || (() => {});

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delayMs = baseMs * Math.pow(2, attempt - 1);
        onRetry(attempt, err, delayMs);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

// --- Timeout Helper ---

/**
 * Wrap a promise with a timeout.
 * @param {Promise} promise
 * @param {number} ms - timeout in milliseconds
 * @param {string} label - description for timeout error
 * @returns {Promise}
 */
export function withTimeout(promise, ms, label = "operation") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}
