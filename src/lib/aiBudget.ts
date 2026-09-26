/** Hard per-request attempt and wall-clock ceilings, not a currency or token-spend guarantee. */
export type AiAction = 'generateArticle' | 'lookupWord' | 'generateTest' | 'tutorChat' | 'writingFeedback';
type Provider = 'gemini' | 'groq';
type Outcome = 'success' | 'failure' | 'timeout';

export class AiDeadlineError extends Error {
  constructor() { super('AI request deadline exceeded'); }
}

export async function withinSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  // The operation may have begun (and rejected) while constructing the arguments.
  // Observe that rejection even when already aborted, avoiding an unhandled rejection.
  if (signal.aborted) { void operation.catch(() => {}); throw new AiDeadlineError(); }
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new AiDeadlineError()); };
    signal.addEventListener('abort', abort, { once: true });
    operation.then(
      value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); }
    );
  });
}

export function createAiBudget(action: AiAction, signal: AbortSignal, startedAt: number, maxAttempts = 4) {
  const deadline = startedAt + 30_000;
  let used = 0;
  const remainingMs = () => signal.aborted ? 0 : Math.max(0, deadline - Date.now());
  const reserve = (provider: Provider, perAttemptMs: number) => {
    const remaining = remainingMs();
    if (used >= maxAttempts || remaining < 100) return null;
    used++;
    return { provider, ordinal: used, startedAt: Date.now(), timeoutMs: Math.min(perAttemptMs, remaining) };
  };
  const record = (attempt: NonNullable<ReturnType<typeof reserve>>, outcome: Outcome) => {
    // Fixed enum fields only. Never serialize provider responses, exceptions, credentials,
    // request contents, client identifiers, or model catalog text to operational logs.
    console.info(JSON.stringify({ event: 'ai_provider_attempt', action, provider: attempt.provider,
      ordinal: attempt.ordinal, outcome, durationMs: Math.min(30_000, Math.max(0, Date.now() - attempt.startedAt)) }));
  };
  return { remainingMs, reserve, record, get attemptsUsed() { return used; } };
}
