import test from "node:test";
import assert from "node:assert";
import { evaluatePolicies, validateExecution } from "../cli/lib/treasury/policy-engine.js";

test("evaluatePolicies - missing or invalid data (fail-closed)", (t) => {
  const noData = evaluatePolicies({
    positions: null,
    totalValue: 1000,
    policies: [],
  });
  assert.strictEqual(noData.passed, false);
  assert.strictEqual(noData.breaches[0].reason.includes("fail-closed"), true);

  const noValue = evaluatePolicies({
    positions: [],
    totalValue: 0,
    policies: [],
  });
  assert.strictEqual(noValue.passed, false);
  assert.strictEqual(noValue.breaches[0].reason.includes("fail-closed"), true);
});

test("evaluatePolicies - expiry", (t) => {
  const expired = evaluatePolicies({
    positions: [],
    totalValue: 1000,
    policies: [],
    expiresAt: "2020-01-01T00:00:00Z", // Past
  });
  assert.strictEqual(expired.passed, false);
  assert.strictEqual(expired.breaches[0].policy, "expiry");
});

test("evaluatePolicies - concentration limit breach", (t) => {
  const policies = [
    {
      type: "concentration_limit",
      asset: "eth_fungible_id", 
      maxPercent: 40,
      rebalanceTarget: 30,
      rebalanceTo: "usdc_fungible_id"
    }
  ];

  const positions = [
    {
      relationships: { fungible: { data: { id: "eth_fungible_id" } }, chain: { data: { id: "ethereum" } } },
      attributes: { value: 600, fungible_info: { symbol: "ETH" } } // 60%
    },
    {
      relationships: { fungible: { data: { id: "usdc_fungible_id" } } },
      attributes: { value: 400, fungible_info: { symbol: "USDC" } } // 40%
    }
  ];

  const result = evaluatePolicies({ positions, totalValue: 1000, policies });
  
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.breaches.length, 1);
  
  const b = result.breaches[0];
  assert.strictEqual(b.policy, "concentration_limit");
  assert.strictEqual(b.action, "rebalance");
  assert.strictEqual(b.actualPercent, 60);
  assert.strictEqual(b.rebalance.sellAsset, "eth_fungible_id");
  assert.strictEqual(b.rebalance.buyAsset, "usdc_fungible_id");
  assert.strictEqual(b.rebalance.sellAmountUsd, 300); // 600 - 30% of 1000 = 600 - 300 = 300
});

test("evaluatePolicies - asset denylist match", (t) => {
  const policies = [
    {
      type: "asset_denylist",
      assets: ["pepe_fungible_id"]
    }
  ];

  const positions = [
    {
      relationships: { fungible: { data: { id: "pepe_fungible_id" } } },
      attributes: { value: 100, fungible_info: { symbol: "PEPE" } }
    }
  ];

  const result = evaluatePolicies({ positions, totalValue: 1000, policies });
  
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.breaches[0].policy, "asset_denylist");
});

test("evaluatePolicies - stop loss", (t) => {
  const policies = [
    {
      type: "stop_loss",
      asset: "pepe",
      triggerPriceUsd: 0.10,
      sellTo: "usdc"
    }
  ];

  const positions = [
    {
      relationships: { fungible: { data: { id: "pepe" } }, chain: { data: { id: "ethereum" } } },
      attributes: { value: 50, price: 0.05, fungible_info: { symbol: "PEPE" } } 
    },
    {
      relationships: { fungible: { data: { id: "safe_asset" } } },
      attributes: { value: 100, price: 100 }
    }
  ];

  const result = evaluatePolicies({ positions, totalValue: 150, policies });
  
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.breaches.length, 1);
  assert.strictEqual(result.breaches[0].policy, "stop_loss");
  assert.strictEqual(result.breaches[0].action, "rebalance");
  assert.strictEqual(result.breaches[0].rebalance.sellAmountUsd, 50);
});

test("validateExecution - safety controls", (t) => {
  const valid = validateExecution({
    chain: "ethereum",
    amountUsd: 100,
    allowedChains: ["ethereum", "arbitrum"],
    spendCapUsd: 500
  });
  assert.strictEqual(valid.allowed, true);

  const chainBreach = validateExecution({
    chain: "solana",
    amountUsd: 100,
    allowedChains: ["ethereum"],
    spendCapUsd: 500
  });
  assert.strictEqual(chainBreach.allowed, false);
  assert.strictEqual(chainBreach.reasons[0].includes("solana"), true);

  const spendBreach = validateExecution({
    chain: "ethereum",
    amountUsd: 600,
    allowedChains: ["ethereum"],
    spendCapUsd: 500
  });
  assert.strictEqual(spendBreach.allowed, false);
});
