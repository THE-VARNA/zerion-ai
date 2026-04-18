   ```bash
   zerion treasury trigger
   ```
   *The agent will sign the ECDSA transaction locally and broadcast it.*
4. **View the Audit Log**:
   ```bash

### Dashboard & Status
```bash
# The High-Fidelity "story" trace for judges (Recommended)
zerion treasury judge-path

# View the real-time Guardian Dashboard
zerion treasury status

# Run a live policy evaluation card
zerion treasury evaluate --pretty
```

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
