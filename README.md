# 🏛️ Policy-Bounded Autonomous Treasury Guardian (Zerion)

### *Institutional-Grade Autonomous Asset Management for the Zerion Frontier*

An autonomous agent engineered for **Bounded Autonomy**—leveraging AI for intent and policy writing while enforcing execution through a deterministic, fail-closed safety engine. Built exclusively for the **Zerion Frontier Hackathon**.

---

## 🏛️ The Architecture: Bounded Autonomy

Unlike "black-box" agents that handle keys directly, the Guardian separates **Logical Intent** from **Operational Execution**:

1.  **The AI Layer**: Suggests institutional-grade treasury policies based on risk profiles (via Zerion MCP / OpenClaw).
2.  **The Deterministic Engine**: Translates human policies into binary guardrails. If a trade is not explicitly allowed, it is cryptographically impossible for the agent to execute it.
3.  **Secure Local Keystore**: Signs transactions using an encrypted local vault. This ensures the agent never handles raw private keys and operates with a zero-trust footprint.

---

## 🏆 The Judge's Path (Proof of Correctness)

The Guardian provides an authoritative **Judge Trace**, a single-screen proof of the system's internal state machine. This eliminates "demo theater" by providing an unambiguous verdict:

- ✅ **CLEAN → NO ACTION REQUIRED**: Treasury is compliant. No remediation needed.
- ⚡ **BREACH → EXECUTED**: A policy was violated; a remedial transaction was broadcast.
- 🟥 **BREACH → BLOCKED**: A policy was violated, but execution was arrested by the manual kill-switch.

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

- **Chain-Aware Identity**: Fully integrates with Zerion's unique `fungible_id` system to uniquely identify assets across multiple L1s and L2s (Ethereum, Base, Arbitrum, etc.).
- **Deterministic Stop-Loss**: Automatic liquidation triggers instantly if asset prices fall below configured USD thresholds.
- **Focus-Mode Reporting**: The Judge Trace automatically filters for the **Top 5 positions by value**, ensuring high-signal decision making.
- **Fail-Closed Design**: Defaults to "BLOCK" if API data is malformed or policy ambiguity is detected.
- **Manual Kill-Switch**: A single-command arrest mechanism that can stop the autonomous daemon instantly.
- **Append-Only Audit Log**: Every evaluation cycle and execution is recorded in a tamper-resistant JSONL format for post-event forensics.

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
