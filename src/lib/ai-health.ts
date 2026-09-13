/**
 * In-memory health signal for the WhatsApp AI agent.
 *
 * The webhook records every AI success/failure here so the dashboard and
 * `/api/health` can show whether the assistant is currently answering
 * customers or down (e.g. an expired/over-limit OpenRouter key — the exact
 * incident that motivated the staff-alert in `webhook.ts`).
 *
 * Deliberately in-memory (module-level state), consistent with the rest of the
 * app's single-persistent-instance model (`runSerial`, coalescing timers). It
 * resets on restart — that's fine; it reflects the *current* process's health,
 * which is exactly what an operator wants to see. If the app is ever scaled
 * horizontally this would need a shared store, same caveat as the reply locks.
 */

export type AiStatus = "ok" | "down" | "unknown";

interface AiHealthState {
  lastOkAt: number | null;
  lastFailAt: number | null;
  lastError: string | null;
}

const state: AiHealthState = { lastOkAt: null, lastFailAt: null, lastError: null };

/** Call after the agent successfully produced a reply. */
export function recordAiOk(): void {
  state.lastOkAt = Date.now();
}

/** Call when `getAIResponse` throws (AI is failing). */
export function recordAiFailure(err: unknown): void {
  state.lastFailAt = Date.now();
  state.lastError = String((err as Error)?.message ?? err).slice(0, 200);
}

/**
 * Derived status. `down` when the most recent outcome was a failure; `ok` once
 * a success is the most recent outcome; `unknown` before any traffic.
 */
export function getAiHealth(): {
  status: AiStatus;
  lastOkAt: string | null;
  lastFailAt: string | null;
  lastError: string | null;
} {
  const { lastOkAt, lastFailAt, lastError } = state;
  let status: AiStatus = "unknown";
  if (lastFailAt && (!lastOkAt || lastFailAt > lastOkAt)) status = "down";
  else if (lastOkAt) status = "ok";
  return {
    status,
    lastOkAt: lastOkAt ? new Date(lastOkAt).toISOString() : null,
    lastFailAt: lastFailAt ? new Date(lastFailAt).toISOString() : null,
    // `down` keeps the error visible; once healthy again we drop the stale detail.
    lastError: status === "down" ? lastError : null,
  };
}
