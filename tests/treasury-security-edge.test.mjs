import test from "node:test";
import assert from "node:assert";
import { evaluatePolicies, validateExecution } from "../cli/lib/treasury/policy-engine.js";
import { markCycleProcessed, isDuplicateCycle } from "../cli/lib/treasury/safety.js";
import { resolve } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

test("Security - Drain Attack Prevention (Negative Amounts)", (t) => {
  const result = validateExecution({
    chain: "ethereum",
    amountUsd: -5000,
    allowedChains: ["ethereum"],
    spendCapUsd: 10000
  });
  
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reasons[0].includes("Invalid execution amount"), true);
});

test("Security - Poisoned Payload Attacks (NaN, Infinity, Strings)", (t) => {
  const cases = ["1000", NaN, Infinity, -Infinity, null, undefined, 0];
  
  for (const amt of cases) {
    const r = validateExecution({
      chain: "ethereum",
      amountUsd: amt,
      allowedChains: ["ethereum"],
      spendCapUsd: 500
    });
    assert.strictEqual(r.allowed, false, `Failed to block poisoned amount: ${amt}`);
  }
});

test("Security - Idempotency Replay Attack", (t) => {
  const maliciousCycleId = "replay-attack-hash-999";
  
  // First attempt should work
  assert.strictEqual(isDuplicateCycle(maliciousCycleId), false);
  markCycleProcessed(maliciousCycleId);
  
  // Second attempt (replay) MUST be blocked
  assert.strictEqual(isDuplicateCycle(maliciousCycleId), true);
  
  // Third attempt MUST be blocked
  assert.strictEqual(isDuplicateCycle(maliciousCycleId), true);

  // Clean up
  const path = resolve(process.env.HOME || process.env.USERPROFILE, ".zerion", "treasury-idempotency.json");
  if (existsSync(path)) unlinkSync(path);
});

test("Edge Case - evaluatePolicies handles array poisoning", (t) => {
  // Pass a string instead of an array for positions
  const stringPositions = evaluatePolicies({
    positions: "this-is-not-an-array",
    totalValue: 1000,
    policies: []
  });
  assert.strictEqual(stringPositions.passed, false);
  assert.strictEqual(stringPositions.breaches[0].reason.includes("fail-closed"), true);

  // Pass deeply malformed objects missing core Zerion SDK fields
  const malformedPositions = evaluatePolicies({
    positions: [
      { relationships: null, attributes: undefined },
      { randomField: "hack" }
    ],
    totalValue: 1000,
    policies: [
      {
        type: "concentration_limit",
        asset: "eth",
        maxPercent: 10
      }
    ]
  });
  // Should compute gracefully and not crash, finding 0 value for ETH
  assert.strictEqual(malformedPositions.passed, true); // No value = no concentration breach
});

test("Security - Strict Chain Enforcement", (t) => {
  const result = validateExecution({
    chain: "unauthorized_chain",
    amountUsd: 100,
    allowedChains: ["ethereum", "polygon"],
    spendCapUsd: 500
  });

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reasons[0].includes("unauthorized_chain"), true);
});
