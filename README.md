# 🏛️ Policy-Bounded Autonomous Treasury Guardian (Zerion)

### *Institutional-Grade Autonomous Asset Management for the Zerion Frontier*

An autonomous treasury guardian for Zerion Frontier that drafts policy with AI assistance, but enforces every action through a deterministic, fail-closed execution engine. It monitors wallet-set data, reacts to webhooks, and executes real onchain rebalancing only when operator-approved guardrails allow it.

***Note: This system is autonomous but bounded by operator-approved policy.***


---

## 🏛️ The Architecture: Bounded Autonomy

Unlike "black-box" agents that handle keys directly, the Guardian separates **Strategic Drafting** from **Operational Execution**:

1.  **AI-Assisted Policy Drafting**: AI-assisted policy drafting can suggest guardrails, but only operator-approved policies become active.

2.  **The Deterministic Engine**: Translates active policies into binary guardrails. If a trade is not explicitly allowed by the operator-bounded rules, the engine defaults to a fail-closed "BLOCK" state.
3.  **Secure Local Keystore**: Transactions are signed locally through the project’s encrypted keystore flow. This ensures the agent never handles raw private keys and operates with a zero-trust footprint.


---

## 🏆 The Judge's Path (Proof of Correctness)

The Guardian provides an authoritative **Judge Trace**, a single-screen proof of the system's internal state machine. This eliminates "demo theater" by providing an unambiguous verdict:

- ✅ **CLEAN → NO ACTION REQUIRED**: Treasury is compliant. No remediation needed.
- ⚡ **BREACH → EXECUTED**: A user-defined policy was exceeded; a remedial transaction was broadcast.
- 🟥 **BREACH → BLOCKED**: A policy was exceeded, but execution was arrested by the manual kill-switch or safety guardrail.
- 🌫️ **BREACH → NON-EXECUTED PROOF**: A policy was exceeded and a transaction was drafted/signed, but not broadcast (Simulation/Dry-Run).

---

## 🔍 Proof of Execution

The Guardian provides deterministic artifacts to prove the system's internal state and external actions:

### Example: Real Execution (Provable)
When the system remediates a breach, it provides a cryptographically verifiable transaction hash:
`TX_HASH: 0x5c7b8d... (Track this on Etherscan/Solscan)`

### Example: Fallback (Simulation)
In dry-run mode or when credentials are not supplied, the Guardian produces a **NON-EXECUTED PROOF**:
`PROOF: Signed Zerion Transaction JSON (Provable intent, No broadcast)`

---

## 🚀 Quick Start (The "Grand Finale" Demo)

To see the system in a complete institutional end-to-end flow, run the automated benchmark script. It walks through policy initialization, safety-override proofing, and the final high-fidelity trace generation.

```bash
# Clone and install
git clone https://github.com/THE-VARNA/zerion-ai.git
cd zerion-ai
npm install

# Run the definitive demo
./demo.sh
```


---

## 🛡️ Key Highlights & Guardrails

- **Chain-Aware Identity**: The system uses Zerion chain-aware asset identifiers and wallet-set positions to avoid cross-chain identity collisions across **60+ EVM chains and Solana**.

- **User-Defined Threshold Monitoring**: Price or concentration policies trigger a rebalance cycle when the portfolio drifts beyond a threshold.
- **Focus-Mode Reporting**: The judge trace shows the top 5 positions by value to keep the decision path readable.

- **Fail-Closed Engine**: Defaults to "BLOCK" if API data is malformed or policy ambiguity is detected.
- **Manual Kill-Switch**: A single-command arrest mechanism that can stop the autonomous daemon instantly.
- **Append-Only Audit Log**: Append-only JSONL audit log for post-event review.


---

## 🛠️ Command Reference

| Command | Purpose |
| :--- | :--- |
| `zerion treasury judge-path` | **The Master Trace.** Prints the end-to-end logic proof. Displays the final state machine proof and execution artifact or audit-only fallback. |

| `zerion treasury status` | View the real-time Guardian Control Room & Audit Log. |
| `zerion treasury policies` | List current active rules and rebalancing targets. |
| `zerion treasury kill-switch on/off` | Instantly arrest or resume the autonomous daemon. |
| `zerion treasury start` | Launch the autonomous daemon for continuous monitoring. |

---

*Built for the Zerion Frontier. Professional, Auditable, and Deterministically Safe.*
