# Policy-Bounded Autonomous Treasury Incident Responder

**Built for the Zerion Frontier Hackathon**

This project is a direct extension of the `zeriontech/zerion-ai` CLI repository. It adds an autonomous treasury guardian agent that monitors a wallet set, evaluates portfolio data against defined safety policies, and auto-executes rebalancing transactions onchain via the Zerion API when a policy is breached.

## Features

- **Autonomous Monitoring:** Polls the Zerion API for state and listens for real-time `tx-subscriptions` webhook triggers.
- **Fail-Closed Policy Engine:** Deterministic, non-AI policy evaluation. Enforces concentration limits, spend caps, chain-locks, and asset denylists. Uses chain-aware `fungible_id` matching.
- **Secure Webhooks:** Minimal Node.js `http` server that strictly adheres to the official Zerion webhook verification guide (RSA-SHA256, domain validation).
- **Safe Execution:** Selects the highest-output routes via the Zerion `/swap/offers/` endpoint. Enforces maximum slippage and uses the native unified CLI transaction signer (`signSwapTransaction` and `broadcastAndWait`).
- **Complete Audit Trail:** Append-only JSONL event log built for hackathon judge inspectability.
- **Safety Controls:** Idempotency deduplication, exponential backoff retries, robust timeout handling, and a strict local kill-switch.

## Installation & Setup

1. **Clone the repo and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your environment (`.env`):**
   ```bash
   export ZERION_API_KEY="zk_dev_..."
   export TREASURY_WALLET_PASSPHRASE="your_secret_passphrase"
   export TREASURY_POLICY_PATH="~/.zerion/treasury-policy.json"
   ```

3. **Initialize the treasury policy:**
   ```bash
   zerion treasury policies --init
   # This generates a template at ~/.zerion/treasury-policy.json
   ```

4. **Edit your policy:**
   Configure your monitored `evmAddress` and rules (e.g. `concentration_limit`). See the template for structure.

## Usage

**Start the autonomous agent loop:**
```bash
zerion treasury start
```

**View live agent status and activity:**
```bash
zerion treasury status
```

**Run a read-only evaluation:**
```bash
zerion treasury evaluate --verbose
```

**Manually trigger an execution cycle:**
```bash
zerion treasury trigger
```

**Emergency Stop:**
```bash
zerion treasury kill-switch on
# To resume: zerion treasury kill-switch off
```

## Architecture

This extension adds a new `treasury` command family to the existing `zerion` unified CLI router while preserving the repository's native patterns. 

- **Data Fetching:** Handled by extending `cli/lib/api/client.js` with `wallet-sets/portfolio` and `wallet-sets/positions`.
- **Policy Engine:** Located at `cli/lib/treasury/policy-engine.js`. It parses the USD-value state of the portfolio entirely synchronously.
- **Execution Pipeline:** Extends the codebase's existing `cli/lib/trading/` utilities to sign and broadcast. No custom execution logic was invented; we pass the `transaction` object exactly as supplied by the Zerion `/swap/offers/` API.

**Why no AI in the execution path?** 
For an institutional treasury responding to real-time exploits or drift, deterministic execution is critical. This agent guarantees that transactions hit the chain _only_ if mathematically supported by the Zerion API state and explicitly allowed by the operator's predefined parameters.
