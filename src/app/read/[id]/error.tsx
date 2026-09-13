'use client';
export default function ReadingError({ reset }: { reset: () => void }) {
  return <div className="card"><h1>Reading temporarily unavailable</h1><p>Please try again in a moment.</p><button onClick={reset}>Retry</button></div>;
}
