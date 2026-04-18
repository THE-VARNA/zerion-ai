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
    const isKill = data.agent.killSwitch === "ACTIVE";
    const killColor = isKill ? "\x1b[41m\x1b[37m" : "\x1b[42m\x1b[30m";
    const killStatus = isKill ? " ARRESTED " : " RUNNING  ";
    
    const p = (str, w) => str + " ".repeat(Math.max(0, w - str.replace(/\x1b\[\d+m/g, '').length));

    let out = `\n\x1b[1m┌────────────────────────────────────────────────────────────────────────┐\x1b[0m\n`;
    out += `\x1b[1m│\x1b[0m ${p(` ❖ TREASURY GUARDIAN DASHBOARD            ${killColor}\x1b[1m ${killStatus} \x1b[0m`, 70)} \x1b[1m│\x1b[0m\n`;
    out += `\x1b[1m├──────────────────────────────────────┬─────────────────────────────────┤\x1b[0m\n`;
    
    const ksText = ` Kill Switch: ${data.agent.killSwitch}`;
    const alText = ` Log: ~${data.agent.auditLogPath.slice(-25)}`;
    const brColor = data.recentActivity.breaches > 0 ? "\x1b[31m" : "\x1b[32m";
    const brText = ` BREACHES: ${brColor}${data.recentActivity.breaches}\x1b[0m`;
    
    const trigText = ` Triggers:    ${data.recentActivity.triggers}`;
    const execText = ` Executions:  \x1b[36m${data.recentActivity.executions}\x1b[0m`;
    const failColor = data.recentActivity.failures > 0 ? "\x1b[31m" : "";
    const failText = ` Failures:    ${failColor}${data.recentActivity.failures}\x1b[0m`;

    out += `\x1b[1m│\x1b[0m ${p(ksText, 36)} \x1b[1m│\x1b[0m ${p(trigText, 31)} \x1b[1m│\x1b[0m\n`;
    out += `\x1b[1m│\x1b[0m ${p(alText, 36)} \x1b[1m│\x1b[0m ${p(execText, 31)} \x1b[1m│\x1b[0m\n`;
    out += `\x1b[1m│\x1b[0m ${p(brText, 36)} \x1b[1m│\x1b[0m ${p(failText, 31)} \x1b[1m│\x1b[0m\n`;
    
    out += `\x1b[1m├──────────────────────────────────────┴─────────────────────────────────┤\x1b[0m\n`;
    out += `\x1b[1m│\x1b[0m ${p(` RECENT ACTIVITY LOG (Last 5 Events)`, 70)} \x1b[1m│\x1b[0m\n`;
    out += `\x1b[1m├────────────────────────────────────────────────────────────────────────┤\x1b[0m\n`;

    for (const e of data.recentEvents) {
      const ts = new Date(e.time).toLocaleTimeString();
      let icon = "●";
      let eventColor = "\x1b[37m";
      if (e.event === "breach_detected") { icon = "✖"; eventColor = "\x1b[31m"; }
      else if (e.event === "tx_confirmed") { icon = "✓"; eventColor = "\x1b[32m"; }
      else if (e.event === "tx_failed") { icon = "✖"; eventColor = "\x1b[31m"; }
      else if (e.event === "policy_evaluated") { icon = "❖"; eventColor = "\x1b[36m"; }
      else if (e.event === "retry") { icon = "↻"; eventColor = "\x1b[33m"; }

      const rawEventName = e.event.replace(/_/g, " ").toUpperCase();
      const eventName = `${eventColor}${rawEventName}\x1b[0m`;
      out += `\x1b[1m│\x1b[0m ${p(` ${icon} [${ts}] ${eventName}`, 70)} \x1b[1m│\x1b[0m\n`;
      
      const details = JSON.stringify(e.data);
      const detailStr = details.length > 58 ? details.slice(0, 55) + "..." : details;
      out += `\x1b[1m│\x1b[0m ${p(`      ↳ ${detailStr}`, 70)} \x1b[1m│\x1b[0m\n`;
    }
    
    out += `\x1b[1m└────────────────────────────────────────────────────────────────────────┘\x1b[0m\n`;
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
