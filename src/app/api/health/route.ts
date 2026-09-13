import { NextResponse } from "next/server";
import { getAiHealth } from "@/lib/ai-health";

export const runtime = "nodejs";

/**
 * Liveness probe. Confirms the Next.js server is up and answering, and reports
 * the WhatsApp AI agent's current status (from the in-memory health signal the
 * webhook updates on every reply). Public (see middleware PUBLIC_PATHS) so
 * uptime monitors can hit it without a login.
 *
 * The AI block intentionally omits the error *detail* here (public endpoint);
 * the authenticated `/api/overview` exposes the message for staff.
 */
export async function GET() {
  const ai = getAiHealth();
  return NextResponse.json({
    status: "ok",
    ts: new Date().toISOString(),
    ai: { status: ai.status, lastOkAt: ai.lastOkAt, lastFailAt: ai.lastFailAt },
  });
}
