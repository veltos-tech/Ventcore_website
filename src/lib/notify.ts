import "server-only";

import { drainQueue } from "@/lib/crm/queue";
import { submitNewLead } from "@/lib/crm/service";

export type Lead = { name: string; phone: string; email?: string };

// The database transaction stores the lead and queues notifications together.
// A transient Telegram error leaves the notification in the durable outbox.
export async function notifyLead(lead: Lead, clientKey: string) {
  const accepted = submitNewLead(lead, clientKey);
  if (!accepted) return false;
  try { await drainQueue(1); } catch { console.error("[crm] Queue dispatch failed; retry is scheduled"); }
  return true;
}
