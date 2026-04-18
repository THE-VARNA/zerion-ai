# Policy-Bounded Autonomous Treasury Guardian (Zerion)

An institutional-grade autonomous agent built for the Zerion Frontier Hackathon. The Guardian provides **Bounded Autonomy**—leveraging AI for intent and policy-writing, but enforcing execution through a deterministic, auditable engine.

## 🏛️ Architecture: Bounded Autonomy
Unlike typical chatbots, the Guardian separates **Intent** from **Execution**:
1. **The AI Layer**: Suggests and writes treasury policies based on risk tolerance (via MCP / OpenClaw).
2. **The Policy Engine**: A deterministic, code-enforced layer that prevents any transaction that violates the JSON guardrails.
3. **The Secure Keystore**: Transactions are signed using a local, encrypted keystore (OWS) which requires an explicit unlock secret.

## 🏆 The Judge's Path (Proof of Correctness)
For judges and auditors, the Guardian provides the `judge-path` command. This produces an unambiguous, verifiable trace of the system's logic state machine:
- ✅ **SAFE → NO ACTION**: Treasury is compliant with all operational bounds.
- ⚡ **BREACH → EXECUTED**: A policy was violated, and a remedial transaction was broadcast.
- 🟥 **BREACH → BLOCKED**: A policy was violated, but execution was arrested by the manual kill-switch or safety-lock.

## 🚀 Quick Start & Demo
The fastest way to verify the system is to run the automated demo:
```bash
./demo.sh
```
This script walks through policy initialization, safety-override testing, and generates the final high-fidelity **Judge Trace**.

### Operational Commands
```bash
# Verify the high-fidelity judge trace (Recommended for Hackathon Review)
zerion treasury judge-path

# View the real-time Guardian Control Room
zerion treasury status

# Activate and manage policies
zerion treasury policies --init
```

### Security & Privacy
- **Zero-Trust Signing**: The agent never handles raw private keys; it uses the local encrypted keystore.
- **Fail-Closed Design**: If API data is malformed or the policy engine is uncertain, the system defaults to "BLOCKED".
- **Hardware Kill-Switch**: A single file-system lock can arrest all autonomous loops instantly.

---
*Built for the Zerion Frontier Hackathon. Professional, Auditable, and Deterministically Safe.*
