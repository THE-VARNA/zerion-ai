# 🏛️ Policy-Bounded Autonomous Treasury Guardian (Zerion)

### *Institutional-Grade Autonomous Asset Management for the Zerion Frontier*

An autonomous agent engineered for **Bounded Autonomy**—leveraging AI for intent and policy writing while enforcing execution through a deterministic, fail-closed safety engine. Built exclusively for the **Zerion Frontier Hackathon**.

---

## 🏛️ The Architecture: Bounded Autonomy

Unlike "black-box" agents that handle keys directly, the Guardian separates **Logical Intent** from **Operational Execution**:

1.  **The AI Layer**: Suggests institutional-grade treasury policies based on risk profiles (via Zerion MCP / OpenClaw).
2.  **The Deterministic Engine**: Translates human policies into binary guardrails. If a trade is not explicitly allowed, it is cryptographically impossible for the agent to execute it.
3.  **Encrypted Local Keystore**: Signs transactions using an encrypted local vault, ensuring that keys never touch memory without an explicit unlock secret.

---

## 🏆 The Judge's Path (Proof of Correctness)

The Guardian provides an authoritative **Judge Trace**, a single-screen proof of the system's internal state machine. This eliminates "demo theater" by providing an unambiguous verdict:

- ✅ **CLEAN → NO ACTION REQUIRED**: Treasury is compliant. No remediation needed.
- ⚡ **BREACH → EXECUTED**: A manual policy was violated; a remedial transaction was broadcast.
- 🟥 **BREACH → BLOCKED**: A policy was violated, but execution was arrested by the manual kill-switch.

---

## 🚀 Quick Start (The "Grand Finale" Demo)

To see the system in a complete institutional end-to-end flow, run the automated demo script. It walks through policy initialization, safety-override proofing, and the final high-fidelity trace generation.

```bash
# Clone and install dependencies
git clone https://github.com/THE-VARNA/zerion-ai.git
cd zerion-ai
npm install
npm link  # This makes the 'zerion' command available globally

# Run the definitive demo
./demo.sh
```

---

## 🛠️ Command Reference for Judges

| Command | Purpose |
| :--- | :--- |
| `zerion treasury judge-path` | **The Master Trace.** Prints the end-to-end logic proof. |
| `zerion treasury status` | View the real-time Guardian Control Room & Audit Log. |
| `zerion treasury trigger` | Force an immediate evaluation cycle of the treasury. |
| `zerion treasury kill-switch on/off` | Instantly arrest or resume the autonomous daemon. |
| `zerion treasury policies --init` | Initialize the institutional policy template. |

---

## 🛡️ Security & Institutional Guardrails

- **Top 5 Data Filtering**: Zero-noise reporting. The Guardian pulls live Zerion portfolio data but filters for the Top 5 positions to maintain focus on high-value governance.
- **Fail-Closed Engine**: If API calls fail or data is ambiguous, the system defaults to "DENY."
- **Hardware-Level Kill-Switch**: A file-system-level safety lock that arrests the background daemon with zero latency.
- **Append-only Transaction Audit Log**: Every decision is logged to `~/.zerion/treasury-audit.jsonl` for post-event forensics.

---

## 📦 Setup & Environment

Ensure you have your **Zerion API Key** ready.

```bash
# .env file configuration
ZERION_API_KEY=your_key_here
TREASURY_POLICY_PATH=/absolute/path/to/policy.json
TREASURY_WALLET_PASSPHRASE=your_secret
```

---

*Built for the Zerion Frontier. Professional, Auditable, and Deterministically Safe.*
