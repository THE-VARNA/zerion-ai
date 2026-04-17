# Policy-Bounded Autonomous Treasury Responder

**Built for the Zerion Frontier Hackathon**

This project extends the `zeriontech/zerion-ai` CLI, transforming it from a manual tool into an **Autonomous Treasury Guardian**. It monitors a multi-chain wallet-set, evaluates positions against a deterministic safety policy, and auto-executes rebalancing or stop-loss transactions onchain via the Zerion API.

## Quick Setup

*(Standard Zerion CLI setup applies. See the [official docs](https://github.com/zeriontech/zerion-ai) for auth details).*

```bash
npm install
export ZERION_API_KEY="zk_dev_..."
export TREASURY_WALLET_PASSPHRASE="your_secret_passphrase"
```

## The Policy System

This agent runs on **Fail-Closed Determinism**. There are no "god-mode" AI agents hallucinating trades. An AI acts as the *configuration copilot*, while the fast, zero-dependency Node daemon strictly handles math and API execution.

Initialize your policy file: `zerion treasury policies --init` (creates `~/.zerion/treasury-policy.json`).

### 1. Stop-Loss (Risk Liquidation)
Automatically exit a position if the market crashes below a trigger price.
```json
{
  "type": "stop_loss",
  "asset": "pepe",
  "triggerPriceUsd": 0.005,
  "sellTo": "usdc"
}
```

### 2. Concentration Limit (Auto-Rebalance)
Ensure no single asset exceeds your risk parameters.
```json
{
  "type": "concentration_limit",
  "asset": "eth",
  "maxPercent": 40,
  "rebalanceTarget": 30,
  "rebalanceTo": "usdc"
}
```

All policies are guarded by a **Safety Cage** in the JSON: `spendCapUsd` (e.g., max $500 per trade) and `allowedChains` (e.g., `["polygon", "base"]`).

## Hackathon Demo Flow

Want to see it work? Here is the exact path to demonstrate a real onchain transaction on a cheap L2 (like Polygon or Base).

1. **Configure the Threat**: Add a `stop_loss` for a token you hold (minimum $1 worth). Set the `triggerPriceUsd` *higher* than the current market price so the agent believes a crash is happening.
2. **Review the State**: 
   ```bash
   zerion treasury evaluate --pretty
   ```
   *Watch the high-contrast dashboard detect the "Crash" and formulate an exact `/swap/offers/` route.*
3. **Trigger Execution**:
   ```bash
   zerion treasury trigger
   ```
   *The agent will sign the ECDSA transaction locally and broadcast it.*
4. **View the Audit Log**:
   ```bash
   zerion treasury status
   ```
   *The dashboard will display the confirmed onchain Hash.*

### Autonomous Mode

To let the agent run continuously in the background (polling every 60s and listening to Zerion Webhooks):
```bash
zerion treasury start
```

*Emergency Kill-switch: `zerion treasury kill-switch on`*

## AI Copilot Integration (MCP & OpenClaw)

This agent exposes its architecture to GenAI! 
- We built the `treasury-guardian` OpenClaw skill (`skills/treasury-guardian/SKILL.md`).
- We exported `mcp/tools/treasury-status.json`, `evaluate.json`, and `policies.json`.

**Try it:** Open Claude or Cursor and type: *"Guardian, check if my treasury has any breaches. If not, update my policy to add a $1500 stop-loss for ETH."* The AI will natively read the state and rewrite your JSON policy file for you!
