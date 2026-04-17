import test from "node:test";
import assert from "node:assert";
import { parseFlags } from "../cli/lib/util/flags.js";
import { isKillSwitchActive, activateKillSwitch, deactivateKillSwitch, markCycleProcessed, isDuplicateCycle } from "../cli/lib/treasury/safety.js";
import { resolve } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

test("Safety - Kill Switch", (t) => {
  deactivateKillSwitch(); // clean state
  assert.strictEqual(isKillSwitchActive(), false);

  activateKillSwitch("testing");
  assert.strictEqual(isKillSwitchActive(), true);

  deactivateKillSwitch();
  assert.strictEqual(isKillSwitchActive(), false);
});

test("Safety - Idempotency Ring Buffer", (t) => {
  const cycleId = "test-cycle-123";
  
  assert.strictEqual(isDuplicateCycle(cycleId), false);
  markCycleProcessed(cycleId);
  assert.strictEqual(isDuplicateCycle(cycleId), true);
  
  // Clean up
  const path = resolve(process.env.HOME || process.env.USERPROFILE, ".zerion", "treasury-idempotency.json");
  if (existsSync(path)) unlinkSync(path);
});
