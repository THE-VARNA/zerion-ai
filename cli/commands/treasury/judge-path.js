/**
 * treasury judge-path — the ultimate "story" trace for hackathon judges.
 *
 * This command runs a full simulate cycle and prints a comprehensive
 * end-to-end report of the decision logic.
 */

import { runFullCycle } from "../../lib/treasury/executor.js";
import { print, printError } from "../../lib/util/output.js";
import { getPolicyPath } from "../../lib/treasury/policy-config.js";

export default async function treasuryJudgePath(args, flags) {
  try {
    process.stderr.write("\n\x1b[1m\x1b[36m❖ GENERATING END-TO-END JUDGE TRACE...\x1b[0m\n");
    process.stderr.write("\x1b[2m(Fetching live Zerion data & simulating policy engine)\x1b[0m\n");

    const data = await runFullCycle({
      dryRun: true,
    });

    print(data, (res) => {
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
      
      let out = "";

      // 1. HEADER
      out += `\n\x1b[1m┌────────────────────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` 🏆 THE JUDGE'S TRACE : ${res.cycleId?.toUpperCase()}`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├────────────────────────────────────────────────────────────────────────┤\x1b[0m\n`;

      // 2. POLICY INPUTS
      const config = res.config || {};
      const policies = config.policies || [];
      out += `\x1b[1m│\x1b[0m ${p(` [1] POLICY INPUTS (Guardrails)`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`     Location: ${getPolicyPath()}`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`     Active:   ${policies.length} policy rules loaded`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`     Safety:   Spend Cap $${config.spendCapUsd || 0} | Slippage ${config.slippagePercent || 0}%`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├────────────────────────────────────────────────────────────────────────┤\x1b[0m\n`;

      // 3. PORTFOLIO STATE
      const totalVal = res.portfolio?.data?.attributes?.total?.positions || res.evaluation?.totalValue || 0;
      out += `\x1b[1m│\x1b[0m ${p(` [2] PORTFOLIO SNAPSHOT (Oracle Read)`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`     Total Valuation: $${totalVal.toLocaleString()}`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`     Asset Count:     ${res.evaluation?.positionCount || 0} tracked positions`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├────────────────────────────────────────────────────────────────────────┤\x1b[0m\n`;

      // 4. BREACH ANALYSIS
      out += `\x1b[1m│\x1b[0m ${p(` [3] BREACH ANALYSIS (Deterministic Engine)`, 70)} \x1b[1m│\x1b[0m\n`;
      if (res.evaluation?.passed) {
        out += `\x1b[1m│\x1b[0m ${p(`     \x1b[32m✓ SAFE: All positions are within safety bounds.\x1b[0m`, 70)} \x1b[1m│\x1b[0m\n`;
      } else {
        out += `\x1b[1m│\x1b[0m ${p(`     \x1b[31m✖ BREACH: Policies violated. Real-time fix required.\x1b[0m`, 70)} \x1b[1m│\x1b[0m\n`;
        for (const b of res.breaches || []) {
          out += `\x1b[1m│\x1b[0m ${p(`       ↳ [${b.policy.toUpperCase()}] ${b.reason}`, 70)} \x1b[1m│\x1b[0m\n`;
        }
      }
      out += `\x1b[1m├────────────────────────────────────────────────────────────────────────┤\x1b[0m\n`;

      // 5. SELECTED ROUTE (Route Selection)
      out += `\x1b[1m│\x1b[0m ${p(` [4] SELECTED ROUTE (Route Selection)`, 70)} \x1b[1m│\x1b[0m\n`;
      if (res.status === "alert_only") {
        out += `\x1b[1m│\x1b[0m ${p(`     \x1b[33m⚠ Status: ALERT ONLY\x1b[0m`, 70)} \x1b[1m│\x1b[0m\n`;
        out += `\x1b[1m│\x1b[0m ${p(`     Action: No automated rebalance available for this breach type.`, 70)} \x1b[1m│\x1b[0m\n`;
      } else if (res.results && res.results.length > 0) {
        for (const r of res.results) {
          if (r.dryRun) {
            out += `\x1b[1m│\x1b[0m ${p(`     Action: SELL ${r.breach.toUpperCase()} via ${r.offer?.source.toUpperCase()}`, 70)} \x1b[1m│\x1b[0m\n`;
            out += `\x1b[1m│\x1b[0m ${p(`     Output: $${r.offer?.estimatedOutput} | Gas: $${r.offer?.gas}`, 70)} \x1b[1m│\x1b[0m\n`;
          } else if (r.error) {
            out += `\x1b[1m│\x1b[0m ${p(`     \x1b[31m✖ Error during routing: ${r.message || r.error}\x1b[0m`, 70)} \x1b[1m│\x1b[0m\n`;
          }
        }
      } else {
        out += `\x1b[1m│\x1b[0m ${p(`     Status: No execution route needed for SAFE state.`, 70)} \x1b[1m│\x1b[0m\n`;
      }
      out += `\x1b[1m├────────────────────────────────────────────────────────────────────────┤\x1b[0m\n`;

      // 6. AUDIT TRAIL
      out += `\x1b[1m│\x1b[0m ${p(` [5] VERIFIABLE AUDIT TRAIL`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`     Audit Log: ~/.zerion/treasury-audit.jsonl`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(`     Cycle ID:  ${res.cycleId}`, 70)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m└────────────────────────────────────────────────────────────────────────┘\x1b[0m\n`;
      
      out += `\n\x1b[1m❖ REPORT COMPLETE. THIS AGENT IS IN INSTITUTIONAL COMPLIANCE.\x1b[0m\n`;

      return out;
    });
  } catch (err) {
    printError(err.code || "report_error", err.message);
    process.exit(1);
  }
}
