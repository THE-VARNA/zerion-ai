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
    });
    return;
  }

  if (action === "off") {
    deactivateKillSwitch();
    logAuditEvent("kill_switch_deactivated", {});
    print({
      killSwitch: "inactive",
      message: "Kill switch deactivated — treasury execution is now allowed",
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
  });
}
