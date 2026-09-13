/**
 * Next.js server-instance startup hook (`register` runs once per server boot).
 *
 * Optional in-process reminder scheduler. OFF by default — it only starts when
 * `REMINDERS_AUTO=true`, so a plain deploy (and local dev) never auto-sends
 * WhatsApp messages. When enabled, it runs the reminder job shortly after boot
 * and then hourly. Sending is idempotent: `reminder_sent_at` guards against
 * double reminders, so an hourly cadence just catches each appointment once as
 * it enters the 20–28h window.
 *
 * This is the app's single-instance automation surface, consistent with the
 * in-memory `runSerial`/coalescing model. If you scale horizontally, disable it
 * and use an external cron hitting `/api/cron/reminders?key=CRON_SECRET` instead
 * (otherwise every instance would run its own timer).
 *
 * Reminders can still always be triggered externally via the HTTP cron route,
 * regardless of this flag.
 */
export async function register(): Promise<void> {
  // Only the Node.js runtime has DB/network access and long-lived timers.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.REMINDERS_AUTO !== "true") return;

  const { runReminders } = await import("@/lib/reminders");

  const tick = () => {
    runReminders({ trigger: "auto" })
      .then(({ sent, considered }) => {
        if (considered > 0) console.log(`[reminders] auto run: sent ${sent}/${considered}`);
      })
      .catch((e) => console.error("[reminders] auto run failed:", e));
  };

  // First pass 30s after boot (let the server settle), then hourly.
  setTimeout(tick, 30_000);
  setInterval(tick, 60 * 60_000);
  console.log("[reminders] in-process scheduler enabled (hourly)");
}
