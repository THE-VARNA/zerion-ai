/**
 * treasury status — show current agent status and recent activity.
 *
 * Usage: zerion treasury status [--last <n>]
 */

import { readAuditLog, getAuditLogPath } from "../../lib/treasury/audit-log.js";
import { isKillSwitchActive, getKillSwitchInfo } from "../../lib/treasury/safety.js";
import { print } from "../../lib/util/output.js";

export default async function treasuryStatus(args, flags) {
  const lastN = parseInt(flags.last || "10", 10);
  const entries = readAuditLog(lastN);

  const killSwitch = isKillSwitchActive();
  const killSwitchInfo = killSwitch ? getKillSwitchInfo() : null;

  // Find stats from audit log
  const triggers = entries.filter((e) => e.event === "trigger_received").length;
  const breaches = entries.filter((e) => e.event === "breach_detected").length;
  const executions = entries.filter((e) => e.event === "tx_confirmed").length;
  const failures = entries.filter((e) => e.event === "tx_failed").length;
  const killBlocks = entries.filter((e) => e.event === "kill_switch_block").length;

  // Last evaluation time
  const lastEval = entries.filter((e) => e.event === "policy_evaluated").pop();

  const status = {
    agent: {
      killSwitch: killSwitch ? "ACTIVE" : "inactive",
      killSwitchInfo,
      auditLogPath: getAuditLogPath(),
    },
    recentActivity: {
      lastNEntries: lastN,
      triggers,
      breaches,
      executions,
      failures,
      killSwitchBlocks: killBlocks,
      lastEvaluation: lastEval?.ts || null,
    },
    recentEvents: entries.slice(-5).map((e) => ({
      time: e.ts,
      event: e.event,
      cycleId: e.cycle_id?.slice(0, 8),
      data: summarizeEventData(e),
    })),
  };

  print(status, (data) => {
    const K = data.agent.killSwitch === "ACTIVE" 
      ? "\x1b[31mACTIVE (Arrested)\x1b[0m" : "\x1b[32minactive (Running properly)\x1b[0m";
    
    let out = `\n\x1b[1m=== TREASURY GUARDIAN STATUS ===\x1b[0m\n\n`;
    out += `Kill Switch: ${K}\n`;
    out += `Audit Log:   ${data.agent.auditLogPath}\n\n`;
    out += `\x1b[1mRecent Activity (Last ${data.recentActivity.lastNEntries} cycles)\x1b[0m\n`;
    out += `Triggers:    ${data.recentActivity.triggers}\n`;
    out += `Breaches:    \x1b[${data.recentActivity.breaches > 0 ? "31" : "32"}m${data.recentActivity.breaches}\x1b[0m\n`;
    out += `Executions:  \x1b[36m${data.recentActivity.executions}\x1b[0m\n`;
    out += `Failures:    ${data.recentActivity.failures > 0 ? `\x1b[31m${data.recentActivity.failures}\x1b[0m` : "0"}\n\n`;
    out += `\x1b[1mLast 5 Events:\x1b[0m\n`;
    for (const e of data.recentEvents) {
      out += ` [${new Date(e.time).toLocaleTimeString()}] ${e.event.padEnd(20)} `;
      if (e.event === "breach_detected") out += `\x1b[31m${e.data.reason}\x1b[0m\n`;
      else if (e.event === "tx_confirmed") out += `\x1b[32mConfirmed: ${e.data.hash}\x1b[0m\n`;
      else if (e.event === "policy_evaluated" && e.data.breaches === 0) out += `\x1b[32mClean\x1b[0m\n`;
      else out += `${JSON.stringify(e.data)}\n`;
    }
    return out;
  });
}

function summarizeEventData(entry) {
  const d = entry.data || {};
  switch (entry.event) {
    case "policy_evaluated":
      return { passed: d.passed, breaches: d.breachCount, totalValue: d.totalValue };
    case "breach_detected":
      return { policy: d.policy, reason: d.reason };
    case "tx_confirmed":
      return { hash: d.hash, status: d.status };
    case "tx_failed":
      return { hash: d.hash, error: d.error };
    case "kill_switch_block":
      return { phase: d.phase || "evaluation" };
    case "agent_started":
      return { dryRun: d.dryRun, policies: d.policyCount };
    default:
      return d;
  }
}
