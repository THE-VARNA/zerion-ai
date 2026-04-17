---
name: treasury-guardian
description: "Manage, evaluate, and monitor the autonomous treasury agent's policies and execution state. Supports status checks, dry-run evaluations, and policy readouts."
compatibility: "Requires zerion (`npx zerion` or `npm install -g zerion`)."
license: MIT
allowed-tools: Bash
metadata:
  openclaw:
    requires:
      bins:
        - zerion
    install:
      - kind: node
        package: "zerion"
        bins: [zerion]
    homepage: https://github.com/zeriontech/zerion-ai
---

# Treasury Guardian

Interact with the active Policy-Bounded Autonomous Treasury Incident Responder. This skill allows cognitive AI agents to read the deterministic parameters, evaluate the current treasury health, and examine audit trails.

## When to use

Use this skill when the user asks about:
- The current settings or parameters of their automated treasury agent.
- Whether the treasury is currently at risk or breaching policies.
- A summary of recent execution events or webhook triggers.
- Writing or adjusting a new risk parameter (e.g. stop-loss, concentration limit).

## Commands

### Check Agent Status

```bash
zerion treasury status
```

Returns a summary of the active `~/.zerion/treasury-audit.jsonl` data. Look here to see if the Kill Switch is active, when the last evaluation run occurred, and how many executions have succeeded.

### Evaluate Treasury State

```bash
zerion treasury evaluate [--verbose]
```

Performs a read-only dry-run using the live Zerion API. It compares current `wallet-sets` data against the `treasury-policy.json` to see if any breaches are actively occurring right now. Returns `passed: boolean` alongside any `breaches`.

### Read Active Policies

```bash
zerion treasury policies
```

Returns the fully parsed JSON of the current policy bounds and target configurations.

## Typical workflow for an AI Agent

1. User says: "Update my treasury to stop-loss PEPE at $0.01"
2. AI runs `zerion treasury policies` to understand the current configuration shape.
3. AI uses `bash` output redirection (or a file write tool) to update `~/.zerion/treasury-policy.json` with the new rule appended to the `policies` array.
4. AI runs `zerion treasury evaluate` to ensure the new file parses correctly and check if the new rule immediately causes a breach against live API state.
5. AI confirms success to the user.

## Note on Execution

This skill does **not** document the `zerion treasury trigger` or `zerion treasury start` execution tools intentionally, as executing transactions autonomously remains the sole responsibility of the locally-running daemon under human operational control. AI agents using OpenClaw should focus on **co-piloting** and **parameter adjustment**.
