# 🏛️ Policy-Bounded Autonomous Treasury Guardian (Zerion)

### *Institutional-Grade Autonomous Asset Management for the Zerion Frontier*

An autonomous agent engineered for **Bounded Autonomy**—leveraging AI for policy drafting while enforcing every action through a deterministic, fail-closed safety engine. Built exclusively for the **Zerion Frontier Hackathon**.

---

## 🏛️ The Architecture: Bounded Autonomy

Unlike "black-box" agents that handle keys directly, the Guardian separates **Strategic Drafting** from **Operational Execution**:

1.  **AI-Assisted Policy Drafting**: The agent can assist with proposing institutional-grade treasury policies based on risk profiles (via Zerion MCP / OpenClaw). These policies must be operator-reviewed before activation.
2.  **The Deterministic Engine**: Translates active policies into binary guardrails. If a trade is not explicitly allowed by the operator-bounded rules, the engine defaults to a fail-closed "BLOCK" state.
3.  **Secure Local Keystore**: Signs transactions using an encrypted local vault. This ensures the agent never handles raw private keys and operates with a zero-trust footprint.

---

## 🏆 The Judge's Path (Proof of Correctness)

The Guardian provides an authoritative **Judge Trace**, a single-screen proof of the system's internal state machine. This eliminates "demo theater" by providing an unambiguous verdict:

- ✅ **CLEAN → NO ACTION REQUIRED**: Treasury is compliant. No remediation needed.
- ⚡ **BREACH → EXECUTED**: A user-defined policy was exceeded; a remedial transaction was broadcast.
- 🟥 **BREACH → BLOCKED**: A policy was exceeded, but execution was arrested by the manual kill-switch or safety guardrail.

---

## 🚀 Quick Start (The "Grand Finale" Demo)

To see the system in a complete institutional end-to-end flow, run the automated benchmark script. It walks through policy initialization, safety-override proofing, and the final high-fidelity trace generation.

```bash
# Clone and install
git clone https://github.com/THE-VARNA/zerion-ai.git
cd zerion-ai
npm install
npm link  # Global command registration

# Run the definitive demo
./demo.sh
```

---

## 🛡️ Key Highlights & Guardrails

- **Chain-Aware Identity**: Fully integrates with Zerion's unique `fungible_id` system to uniquely identify assets across **60+ EVM chains and Solana**.
- **User-Defined Threshold Monitoring**: Price or concentration policies trigger a rebalance cycle when the portfolio drifts beyond a threshold.
- **Focus-Mode Reporting**: The Judge Trace automatically filters for the **Top 5 positions by value**, ensuring high-signal decision making.
- **Fail-Closed Engine**: Defaults to "BLOCK" if API data is malformed or policy ambiguity is detected.
- **Manual Kill-Switch**: A single-command arrest mechanism that can stop the autonomous daemon instantly.
- **Append-Only Audit Log**: Every evaluation cycle and execution is recorded in a persistent JSONL format for post-event forensics.

---

## 🛠️ Command Reference

| Command | Purpose |
| :--- | :--- |
| `zerion treasury judge-path` | **The Master Trace.** Prints the end-to-end logic proof. |
| `zerion treasury status` | View the real-time Guardian Control Room & Audit Log. |
| `zerion treasury policies` | List current active rules and rebalancing targets. |
| `zerion treasury kill-switch on/off` | Instantly arrest or resume the autonomous daemon. |
| `zerion treasury start` | Launch the autonomous daemon for continuous monitoring. |

---

*Built for the Zerion Frontier. Professional, Auditable, and Deterministically Safe.*
