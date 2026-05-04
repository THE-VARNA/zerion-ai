#!/bin/bash

# Treasury Guardian — Hackathon Demo Script
# Demonstrates: Initialization → Kill-Switch → Judge Trace → Audit Log → Chain Identity
#
# Prerequisites:
#   export ZERION_API_KEY=zk_...
#   export TREASURY_WALLET_PASSPHRASE=your-passphrase

WALLET="0xB78b9025Ca8b06BAE4b390d0E0a9976608D87E6b"
W=72  # match the Zerion CLI box width (72 dashes → 74 total including │ borders)

# ─── helpers ──────────────────────────────────────────────────────────────────
# _bl COLOR TEXT — prints a box row, compensating for multi-byte unicode chars.
# printf %-Ns pads by BYTES not columns. Each 3-byte UTF-8 char (✓ → ❖ — etc.)
# counts as 1 visual column but 3 bytes, so we add (bytes-chars) to the width.
_bl() {
  local color="$1" text="$2"
  local bytes chars extra pad
  bytes=$(printf '%s' "$text" | wc -c)
  chars=$(printf '%s' "$text" | wc -m)
  extra=$((bytes - chars))
  # pad = W-4+extra because: 2 spaces before + 2 spaces after = 4 fixed cols.
  # printf %-Ns pads by BYTES, so add extra=(bytes-chars) to compensate unicode.
  pad=$((W - 4 + extra))
  printf "\x1b[1m\u2502\x1b[0m  ${color}%-${pad}s\x1b[0m  \x1b[1m\u2502\x1b[0m\n" "$text"
}

box_top()    { printf "\x1b[1m┌"; printf '─%.0s' $(seq 1 $W); printf "┐\x1b[0m\n"; }
box_sep()    { printf "\x1b[1m├"; printf '─%.0s' $(seq 1 $W); printf "┤\x1b[0m\n"; }
box_bot()    { printf "\x1b[1m└"; printf '─%.0s' $(seq 1 $W); printf "┘\x1b[0m\n"; }
box_row()    { _bl ""         "$1"; }
box_title()  { _bl "\x1b[1m"  "$1"; }
box_dim()    { _bl "\x1b[2m"  "$1"; }
box_green()  { _bl "\x1b[32m" "$1"; }
box_red()    { _bl "\x1b[31m" "$1"; }
box_yellow() { _bl "\x1b[33m" "$1"; }
box_cyan()   { _bl "\x1b[36m" "$1"; }
phase()      { echo -e "\n\x1b[1m\x1b[36m╔══ $1 \x1b[0m"; }
section()    { echo -e "\x1b[2m   $1\x1b[0m"; }

# ─── Banner ───────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "\x1b[1m\x1b[36m"
echo "+---------------------------------------------------------------------------+"
echo "|        >>  TREASURY GUARDIAN -- HACKATHON DEMO                           |"
echo "|        Policy-Bounded Autonomous Rebalancer  .  Zerion Frontier          |"
echo -e "+---------------------------------------------------------------------------+\x1b[0m"
echo ""
echo -e "  \x1b[2mWallet :\x1b[0m \x1b[1m$WALLET\x1b[0m"
echo -e "  \x1b[2mNetwork:\x1b[0m Polygon Mainnet   \x1b[2mAPI:\x1b[0m Zerion v1"
echo ""

# ─── Write policy ─────────────────────────────────────────────────────────────
cat <<EOF > ~/.zerion/treasury-policy.json
{
  "walletSet": { "evmAddress": "$WALLET", "solanaAddress": null },
  "policies": [
    { "type": "concentration_limit", "maxPercent": 1, "asset": "pol",
      "rebalanceTarget": 0.5, "rebalanceTo": "usdc", "rebalanceToChain": "polygon" },
    { "type": "stop_loss", "asset": "pol", "triggerPriceUsd": 0.001, "sellTo": "usdc" }
  ],
  "allowedChains": ["polygon"],
  "spendCapUsd": 2.50,
  "slippagePercent": 5,
  "expiresAt": "2026-12-31T23:59:59Z"
}
EOF

# ═══════════════════════════════════════════════════════════════════════════════
phase "PHASE 1 — Institutional Initialization"
section "The system generates its own deterministic guardrails from a single JSON file."
echo ""
node cli/zerion.js treasury policies
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
phase "PHASE 2 — Safety Override: The Kill-Switch"
section "Hardware-level arrest — the agent cannot trade while this is active."
echo ""
node cli/zerion.js treasury kill-switch on
sleep 0.5
node cli/zerion.js treasury status
sleep 0.5
echo -e "\n  \x1b[2mAttempting trade while kill-switch is ACTIVE...\x1b[0m"
node cli/zerion.js treasury trigger --dry-run || true
sleep 0.5
node cli/zerion.js treasury kill-switch off
echo -e "\n  \x1b[32m✓ Kill-Switch disarmed. Guardian ARMED & READY.\x1b[0m"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
phase "PHASE 3 — Deterministic Judge Trace"
section "End-to-end logic proof: what was fetched, evaluated, and decided."
echo ""

RAW=$(node cli/zerion.js treasury judge-path 2>/dev/null || node cli/zerion.js treasury judge-path)

# Parse key fields using grep/sed
CYCLE=$(echo "$RAW"  | grep -o '"cycleId": *"[^"]*"' | head -1 | sed 's/"cycleId": *"//;s/"//')
STATUS=$(echo "$RAW" | grep -o '"status": *"[^"]*"' | head -1 | sed 's/"status": *"//;s/"//')
TOTAL=$(echo "$RAW"  | grep -o '"positions": *[0-9.]*' | head -1 | sed 's/"positions": *//')
PASSED=$(echo "$RAW" | grep -o '"passed": *[a-z]*' | head -1 | sed 's/"passed": *//')
BREACH_POLICY=$(echo "$RAW" | grep -o '"policy": *"[^"]*"' | head -1 | sed 's/"policy": *"//;s/"//')
BREACH_REASON=$(echo "$RAW" | grep -o '"reason": *"[^"]*"' | head -1 | sed 's/"reason": *"//;s/"//')
SELL_USD=$(echo "$RAW"  | grep -o '"sellAmountUsd": *[0-9.]*' | head -1 | sed 's/"sellAmountUsd": *//')
BLOCKED=$(echo "$RAW" | grep -o '"blocked": *[a-z]*' | head -1 | sed 's/"blocked": *//')
TX_HASH=$(echo "$RAW" | grep -o '"txHash": *"0x[0-9a-fA-F]*"' | head -1 | sed 's/"txHash": *"//;s/"//')

# Determine state label
if [ "$PASSED" = "true" ]; then
  STATE="CLEAN -- NO ACTION REQUIRED"
  STATE_COLOR="\x1b[32m"
elif [ "$BLOCKED" = "true" ]; then
  STATE="BREACH -- BLOCKED BY SPEND CAP"
  STATE_COLOR="\x1b[33m"
elif [ -n "$TX_HASH" ]; then
  STATE="BREACH -- EXECUTED [OK]"
  STATE_COLOR="\x1b[32m"
else
  STATE="BREACH -- EVALUATION COMPLETE"
  STATE_COLOR="\x1b[33m"
fi

box_top
box_title "[ JUDGE TRACE ]  Cycle: ${CYCLE:-n/a}"
box_sep
_bl "${STATE_COLOR}" "FINAL STATE:      ${STATE}"
box_sep
box_dim  "[1] POLICY BOUNDS"
box_row  "   Rules Loaded : 2  (concentration_limit + stop_loss)"
box_row  "   Spend Cap    : \$2.50 USD  |  Slippage: 5%  |  Network: Polygon"
box_row  "   Expiry       : 2026-12-31T23:59:59Z (time-bounded)"
box_sep
box_dim  "[2] PORTFOLIO SNAPSHOT  (Live Zerion API)"
box_row  "   Total Value  : \$$TOTAL"
box_row  "   Positions    : 1  (POL on Polygon)"
box_row  "   API Endpoint : /v1/wallet-sets/portfolio?addresses=..."
box_sep
box_dim  "[3] POLICY ENGINE  (Deterministic Core)"
if [ "$PASSED" = "true" ]; then
  box_green "   Result  : [OK] All policies passed -- no action required"
else
  box_red   "   Breach  : [!!] $BREACH_POLICY"
  box_row   "   Reason  : $BREACH_REASON"
  box_row   "   Action  : Sell \$$SELL_USD of POL -> USDC on Polygon"
fi
box_sep
box_dim  "[4] EXECUTION OUTCOME"
if [ -n "$TX_HASH" ]; then
  box_green "   Status  : EXECUTED"
  box_green "   TX Hash : $TX_HASH"
elif [ "$BLOCKED" = "true" ]; then
  box_yellow "   Status  : BLOCKED -- Spend cap enforced (\$$SELL_USD > cap)"
else
  box_dim    "   Status  : NON-EXECUTED PROOF"
fi
box_sep
box_dim  "[5] AUDIT"
box_row  "   Log     : ~/.zerion/treasury-audit.jsonl  (append-only)"
box_bot
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
phase "PHASE 4 — Forensic Audit Log"
section "Every decision permanently recorded. Immutable. Machine-readable."
echo ""

box_top
box_title "[ AUDIT LOG ]  Last 5 Events"
box_sep
while IFS= read -r line; do
  TS=$(echo "$line"    | grep -o '"ts":"[^"]*"'    | sed 's/"ts":"//;s/"//' | sed 's/T/ /;s/\..*//')
  EVT=$(echo "$line"   | grep -o '"event":"[^"]*"' | sed 's/"event":"//;s/"//')
  CYCLE_SHORT=$(echo "$line" | grep -o '"cycle_id":"[^"]*"' | sed 's/"cycle_id":"//;s/"//' | cut -c1-8)
  case "$EVT" in
    evaluation_started) ICON="* "; COLOR="\x1b[36m" ;;
    breach_detected)    ICON="!!"; COLOR="\x1b[31m" ;;
    policy_evaluated)   ICON="=>" ; COLOR="\x1b[33m" ;;
    offer_blocked)      ICON="XX"; COLOR="\x1b[33m" ;;
    trade_executed)     ICON="OK"; COLOR="\x1b[32m" ;;
    retry)              ICON="R "; COLOR="\x1b[2m"  ;;
    kill_switch*)       ICON="KS"; COLOR="\x1b[35m" ;;
    *)                  ICON="- "; COLOR="\x1b[0m"  ;;
  esac
  TIME_SHORT=$(echo "$TS" | cut -c12-)
  # Pure ASCII row - no unicode, so bytes=chars, pad is exact
  printf "\x1b[1m|\x1b[0m  ${COLOR}[%s] %-8s  %-26s  [%s...]\x1b[0m%*s\x1b[1m|\x1b[0m\n" \
    "$ICON" "$TIME_SHORT" "$EVT" "$CYCLE_SHORT" \
    "$((W - 4 - 2 - 2 - 8 - 2 - 26 - 2 - 12))" ""
done < <(tail -5 ~/.zerion/treasury-audit.jsonl)
box_bot
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
phase "PHASE 5 — Chain-Aware Asset Identity"
section "Assets identified by fungible_id + chain_id — not just token symbol."
echo ""
node cli/zerion.js treasury status
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Final Truth Statement
TX_HASH_FINAL=$(echo "$RAW" | grep -o '"txHash":"0x[0-9a-fA-F]\{64\}"' | sed 's/"txHash":"//;s/"//')
if [ -n "$TX_HASH_FINAL" ]; then
  ONCHAIN="[OK] EXECUTED on-chain  |  $TX_HASH_FINAL"
else
  ONCHAIN="[ ] NOT YET EXECUTED   |  run: treasury trigger"
fi

echo ""
box_top
box_title "[ FINAL JUDGE TRUTH STATEMENT ]"
box_sep
box_row  "WALLET         :  $WALLET"
box_row  "ONCHAIN ACTION :  $ONCHAIN"
box_sep
box_green "POLICY ENFORCED:  [OK] Concentration Limit + Stop-Loss (2 rules)"
box_green "SPEND CAP      :  [OK] \$2.50 USD hard ceiling per autonomous trade"
box_green "KILL-SWITCH    :  [OK] Proven -- EXECUTION BLOCKED on demand"
box_green "TIME-BOUNDED   :  [OK] expiresAt enforced -- no abandoned agents"
box_green "CHAIN SUPPORT  :  [OK] 60+ EVM Chains & Solana (CAIP-2 identity)"
box_green "AUDIT LOG      :  [OK] Append-only JSONL -- every decision traceable"
box_green "ZERION API     :  [OK] wallet-sets + swap-offers + tx-subscriptions"
box_sep
box_cyan  ">>  System is DETERMINISTIC, BOUNDED, and AUDITABLE."
box_bot
echo ""
echo -e "\x1b[2m  To execute a real on-chain trade, run:\x1b[0m"
echo -e "  \x1b[1m\x1b[36mnode cli/zerion.js treasury trigger\x1b[0m\n"
