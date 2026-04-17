/**
 * Audit log — append-only JSONL file for full lifecycle traceability.
 *
 * Every critical event is persisted:
 *   trigger_received, policy_evaluated, breach_detected, breach_none,
 *   offer_fetched, offer_selected, tx_signed, tx_broadcast, tx_confirmed,
 *   tx_failed, kill_switch_block, retry, error
 *
 * Each entry: { ts, cycle_id, idempotency_key, event, data }
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { CONFIG_DIR } from "../util/constants.js";

const AUDIT_PATH = `${CONFIG_DIR}/treasury-audit.jsonl`;

function ensureDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Append a single audit event.
 * @param {string} event - event type
 * @param {object} data  - event-specific payload
 * @param {object} ctx   - { cycleId, idempotencyKey }
 */
export function logAuditEvent(event, data = {}, ctx = {}) {
  ensureDir();
  const entry = {
    ts: new Date().toISOString(),
    cycle_id: ctx.cycleId || null,
    idempotency_key: ctx.idempotencyKey || null,
    event,
    data,
  };
  try {
    appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n", { mode: 0o600 });
  } catch (err) {
    // Audit failures should never crash the agent — print to stderr
    process.stderr.write(`[audit-log] write failed: ${err.message}\n`);
  }
}

/**
 * Read the last N audit entries.
 * @param {number} n - number of entries to return (default 50)
 * @returns {object[]}
 */
export function readAuditLog(n = 50) {
  if (!existsSync(AUDIT_PATH)) return [];
  try {
    const lines = readFileSync(AUDIT_PATH, "utf-8")
      .split("\n")
      .filter(Boolean);
    return lines.slice(-n).map((l) => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
  } catch {
    return [];
  }
}

/**
 * Get the audit log file path (for display).
 */
export function getAuditLogPath() {
  return AUDIT_PATH;
}
