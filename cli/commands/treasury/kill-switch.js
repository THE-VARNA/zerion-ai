/**
 * treasury kill-switch — manage the treasury agent kill switch.
 *
 * Usage:
 *   zerion treasury kill-switch          — show kill switch status
 *   zerion treasury kill-switch on       — activate (blocks all execution)
 *   zerion treasury kill-switch off      — deactivate (resumes execution)
 */

import {
  isKillSwitchActive,
  activateKillSwitch,
  deactivateKillSwitch,
  getKillSwitchInfo,
} from "../../lib/treasury/safety.js";
import { logAuditEvent } from "../../lib/treasury/audit-log.js";
import { print } from "../../lib/util/output.js";

export default async function treasuryKillSwitch(args, flags) {
  const action = args[0];

  if (action === "on") {
    const reason = flags.reason || "manual activation via CLI";
    activateKillSwitch(reason);
    logAuditEvent("kill_switch_activated", { reason });
    print({
      killSwitch: "ACTIVE",
      message: "Kill switch activated — all treasury execution is now blocked",
      deactivate: "zerion treasury kill-switch off",
    }, (data) => {
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
      let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(" \x1b[41m\x1b[37m ❖ SAFETY OVERRIDE: ACTIVATED \x1b[0m", 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Status:   \x1b[31mARRESTED\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Reason:   ${data.message.split(' — ')[0]}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Unlock:   ${data.deactivate}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
      return out;
    });
    return;
  }

  if (action === "off") {
    deactivateKillSwitch();
    logAuditEvent("kill_switch_deactivated", {});
    print({
      killSwitch: "inactive",
      message: "Kill switch deactivated — treasury execution is now allowed",
    }, (data) => {
      const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
      let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(" \x1b[42m\x1b[37m ❖ SAFETY OVERRIDE: DEACTIVATED \x1b[0m", 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Status:   \x1b[32mARMED & READY\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Action:   Treasury monitoring has resumed.`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
      return out;
    });
    return;
  }

  // Default: show status
  const active = isKillSwitchActive();
  const info = active ? getKillSwitchInfo() : null;

  print({
    killSwitch: active ? "ACTIVE" : "inactive",
    info,
    usage: {
      activate: "zerion treasury kill-switch on [--reason <text>]",
      deactivate: "zerion treasury kill-switch off",
    },
  }, (data) => {
    const p = (str, width) => str + " ".repeat(Math.max(0, width - str.replace(/\x1b\[\d+m/g, '').length));
    let out = `\n\x1b[1m┌──────────────────────────────────────────────────────────┐\x1b[0m\n`;
    out += `\x1b[1m│\x1b[0m ${p(" ❖ KILL SWITCH STATUS", 56)} \x1b[1m│\x1b[0m\n`;
    out += `\x1b[1m├──────────────────────────────────────────────────────────┤\x1b[0m\n`;
    const stColor = data.killSwitch === "ACTIVE" ? "\x1b[31m" : "\x1b[32m";
    out += `\x1b[1m│\x1b[0m ${p(` State:    ${stColor}${data.killSwitch.toUpperCase()}\x1b[0m`, 56)} \x1b[1m│\x1b[0m\n`;
    if (data.info) {
      out += `\x1b[1m│\x1b[0m ${p(` Reason:   ${data.info.reason}`, 56)} \x1b[1m│\x1b[0m\n`;
      out += `\x1b[1m│\x1b[0m ${p(` Time:     ${new Date(data.info.time).toLocaleTimeString()}`, 56)} \x1b[1m│\x1b[0m\n`;
    }
    out += `\x1b[1m└──────────────────────────────────────────────────────────┘\x1b[0m\n`;
    return out;
  });
}
