#!/bin/bash
# show-audit.sh — Forensic Audit Log pretty-printer
# Usage:  ./show-audit.sh [N]
#         N = number of recent entries to show (default: 5)
#
# Drop-in replacement for:  tail -N ~/.zerion/treasury-audit.jsonl

AUDIT_LOG="$HOME/.zerion/treasury-audit.jsonl"
N="${1:-5}"
W=72   # 72 dashes → 74 total width, matching Zerion CLI boxes

# ── Box drawing ──────────────────────────────────────────────────────────────
box_top() { printf "\x1b[1m┌"; printf '─%.0s' $(seq 1 $W); printf "┐\x1b[0m\n"; }
box_sep() { printf "\x1b[1m├"; printf '─%.0s' $(seq 1 $W); printf "┤\x1b[0m\n"; }
box_bot() { printf "\x1b[1m└"; printf '─%.0s' $(seq 1 $W); printf "┘\x1b[0m\n"; }

# Pure ASCII row — W-4 content cols (2 spaces before + 2 after)
_row() {
  local color="$1"
  printf "\x1b[1m│\x1b[0m  ${color}%-$((W-4))s\x1b[0m  \x1b[1m│\x1b[0m\n" "$2"
}

if [ ! -f "$AUDIT_LOG" ]; then
  echo "No audit log found at $AUDIT_LOG"
  exit 1
fi

TOTAL=$(wc -l < "$AUDIT_LOG")

echo ""
box_top
_row "\x1b[1m"  "[ FORENSIC AUDIT LOG ]  Last $N of $TOTAL Events"
_row "\x1b[2m"  "  Log: $AUDIT_LOG"
box_sep
# Header row — fixed widths must sum to W-4=68
#   [ICON](5) + sp(1) + TIME(8) + sp(2) + EVENT(20) + sp(2) + DETAIL(30) = 68
printf "\x1b[1m│\x1b[0m  \x1b[2m%-5s %-8s  %-20s  %-30s\x1b[0m  \x1b[1m│\x1b[0m\n" \
  "TYPE" "TIME" "EVENT" "KEY DETAIL"
box_sep

while IFS= read -r line; do
  # ── parse fields ────────────────────────────────────────────────────────────
  TS=$(  echo "$line" | grep -o '"ts":"[^"]*"'       | sed 's/"ts":"//;s/"//'     | sed 's/T/ /;s/\..*//')
  EVT=$( echo "$line" | grep -o '"event":"[^"]*"'    | sed 's/"event":"//;s/"//')
  CID=$( echo "$line" | grep -o '"cycle_id":"[^"]*"' | sed 's/"cycle_id":"//;s/"//' | cut -c1-8)
  TIME_SHORT=$(echo "$TS" | cut -c12-)

  # ── per-event icon, color, detail ───────────────────────────────────────────
  case "$EVT" in
    retry)
      TARGET=$(echo "$line" | grep -o '"target":"[^"]*"' | sed 's/"target":"//;s/"//')
      ATT=$(   echo "$line" | grep -o '"attempt":[0-9]*'  | sed 's/"attempt"://')
      ERR=$(   echo "$line" | grep -o '"error":"[^"]*"'   | sed 's/"error":"//;s/"//' | cut -c1-20)
      ICON="[R ]"; COLOR="\x1b[2m"
      DETAIL="$TARGET  attempt $ATT  ($ERR)"
      ;;
    policy_evaluated)
      PASSED=$(  echo "$line" | grep -o '"passed":[a-z]*'      | sed 's/"passed"://')
      BREACHES=$(echo "$line" | grep -o '"breachCount":[0-9]*'  | sed 's/"breachCount"://')
      VALUE=$(   echo "$line" | grep -o '"totalValue":[0-9.]*'  | sed 's/"totalValue"://' | cut -c1-7)
      ICON="[=>]"; COLOR="\x1b[33m"
      DETAIL="passed=$PASSED  breaches=${BREACHES:-0}  val=\$$VALUE"
      ;;
    breach_detected)
      POLICY=$(echo "$line" | grep -o '"policy":"[^"]*"' | sed 's/"policy":"//;s/"//')
      REASON=$(echo "$line" | grep -o '"reason":"[^"]*"' | sed 's/"reason":"//;s/"//' | cut -c1-28)
      ICON="[!!]"; COLOR="\x1b[31m"
      DETAIL="$POLICY: $REASON"
      ;;
    offer_warning)
      MSG=$(echo "$line" | grep -o '"error":"[^"]*"' | sed 's/"error":"//;s/"//' | cut -c1-28)
      ICON="[WW]"; COLOR="\x1b[33m"
      DETAIL="${MSG:-price lookup failed}"
      ;;
    offer_failed)
      REASON=$(echo "$line" | grep -o '"reason":"[^"]*"' | sed 's/"reason":"//;s/"//' | cut -c1-30)
      ICON="[XX]"; COLOR="\x1b[31m"
      DETAIL="$REASON"
      ;;
    offer_blocked)
      REASON=$(echo "$line" | grep -o '"reasons":\["[^"]*"' | sed 's/"reasons":\["//;s/"//' | cut -c1-28)
      ICON="[BL]"; COLOR="\x1b[31m"
      DETAIL="BLOCKED: $REASON"
      ;;
    trade_executed)
      HASH=$(echo "$line" | grep -o '"txHash":"0x[^"]*"' | sed 's/"txHash":"//;s/"//' | cut -c1-18)
      ICON="[OK]"; COLOR="\x1b[32m"
      DETAIL="ON-CHAIN  TX: ${HASH}..."
      ;;
    kill_switch_activated)
      ICON="[KS]"; COLOR="\x1b[35m"; DETAIL="Kill-switch ACTIVATED -- agent ARRESTED";;
    kill_switch_deactivated)
      ICON="[KS]"; COLOR="\x1b[35m"; DETAIL="Kill-switch DEACTIVATED -- agent RUNNING";;
    evaluation_started)
      ICON="[**]"; COLOR="\x1b[36m"; DETAIL="New evaluation cycle started";;
    *)
      ICON="[- ]"; COLOR="\x1b[0m";  DETAIL="$(echo "$line" | cut -c1-30)";;
  esac

  # Truncate DETAIL to exactly 30 chars so column math is exact
  DETAIL=$(printf "%-30.30s" "$DETAIL")

  # Print colored row — cols: 5+1+8+2+20+2+30 = 68 = W-4
  printf "\x1b[1m│\x1b[0m  ${COLOR}%-5s %-8s  %-20s  %s\x1b[0m  \x1b[1m│\x1b[0m\n" \
    "$ICON" "$TIME_SHORT" "$EVT" "$DETAIL"

done < <(tail -"$N" "$AUDIT_LOG")

box_sep
_row "\x1b[2m" "  Cycle: $CID...  |  Total logged events: $TOTAL"
box_bot
echo ""
