import { NextRequest } from "next/server";
import { runReminders } from "@/lib/reminders";

export const runtime = "nodejs";

/**
 * GET /api/cron/reminders?key=CRON_SECRET
 * Sends a WhatsApp reminder for booked appointments starting within the window
 * (default 20–28h ahead) that haven't been reminded yet. Trigger from a cron.
 * The actual work lives in `src/lib/reminders.ts` so the status endpoint and the
 * optional in-process scheduler (`instrumentation.ts`) can reuse it.
 *
 * NOTE: outside Meta's 24h customer-service window this must use an APPROVED
 * message template. Plain text works only inside the 24h window.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fromH = Number(request.nextUrl.searchParams.get("fromH") ?? 20);
  const toH = Number(request.nextUrl.searchParams.get("toH") ?? 28);
  const { sent, considered } = await runReminders({ fromH, toH, trigger: "cron" });
  return Response.json({ ok: true, sent, considered });
}
