/**
 * Appointment-reminder logic, extracted from the cron route so it can be reused
 * by (a) the HTTP cron endpoint, (b) the read-only status endpoint that feeds
 * the dashboard, and (c) the optional in-process scheduler (`instrumentation.ts`).
 *
 * IMPORTANT: outside Meta's 24h customer-service window plain-text sends are
 * rejected — a production deployment needs an approved template (see docs 08 /
 * 10 §7). This module only sends plain text today; keep that constraint in mind.
 */

import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { SALON } from "@/lib/salon-config";
import { formatZoned } from "@/lib/timezone";

const DEFAULT_FROM_H = 20;
const DEFAULT_TO_H = 28;

/** Tracks the last automated/manual run so the dashboard can show freshness. */
interface LastRun {
  at: string;
  sent: number;
  considered: number;
  trigger: "cron" | "auto" | "manual";
}
let lastRun: LastRun | null = null;
export function getLastReminderRun(): LastRun | null {
  return lastRun;
}

/**
 * Send reminders for `booked` appointments starting within the window that
 * haven't been reminded yet. Returns `{ sent, considered }`. Never throws for a
 * single failed send — it logs and moves on so one bad number can't block the
 * rest.
 */
export async function runReminders(opts: {
  fromH?: number;
  toH?: number;
  trigger?: "cron" | "auto" | "manual";
} = {}): Promise<{ sent: number; considered: number }> {
  const fromH = opts.fromH ?? DEFAULT_FROM_H;
  const toH = opts.toH ?? DEFAULT_TO_H;
  const now = Date.now();
  const from = new Date(now + fromH * 3600_000).toISOString();
  const to = new Date(now + toH * 3600_000).toISOString();

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, customer_phone, customer_name, starts_at, service:services(name)")
    .eq("status", "booked")
    .is("reminder_sent_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to);

  let sent = 0;
  for (const a of appts ?? []) {
    const when = formatZoned(new Date(a.starts_at), SALON.timezone, SALON.locale);
    const svc = (a.service as unknown as { name?: string } | null)?.name ?? "il tuo appuntamento";
    const name = a.customer_name ? ` ${a.customer_name}` : "";
    const text = `Ciao${name}! Ti ricordiamo l'appuntamento da ${SALON.name} per ${svc}: ${when}. Per modifiche rispondi a questo messaggio. A presto!`;
    try {
      await sendWhatsAppMessage(a.customer_phone, text);
      await supabase.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
      sent++;
    } catch (e) {
      console.error("reminder failed", a.id, e);
    }
  }

  const considered = appts?.length ?? 0;
  lastRun = { at: new Date().toISOString(), sent, considered, trigger: opts.trigger ?? "cron" };
  return { sent, considered };
}

/**
 * Read-only reminder status for the dashboard: how many upcoming appointments
 * still need a reminder in the default window, how many were reminded in the
 * last 24h, and when the reminder job last ran in this process. Does NOT send
 * anything.
 */
export async function getReminderStatus(): Promise<{
  pending: number;
  sentLast24h: number;
  lastRun: LastRun | null;
  windowFromH: number;
  windowToH: number;
}> {
  const now = Date.now();
  const from = new Date(now + DEFAULT_FROM_H * 3600_000).toISOString();
  const to = new Date(now + DEFAULT_TO_H * 3600_000).toISOString();
  const dayAgo = new Date(now - 24 * 3600_000).toISOString();

  const [pendingR, sentR] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "booked")
      .is("reminder_sent_at", null)
      .gte("starts_at", from)
      .lt("starts_at", to),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .not("reminder_sent_at", "is", null)
      .gte("reminder_sent_at", dayAgo),
  ]);

  return {
    pending: pendingR.count ?? 0,
    sentLast24h: sentR.count ?? 0,
    lastRun,
    windowFromH: DEFAULT_FROM_H,
    windowToH: DEFAULT_TO_H,
  };
}
