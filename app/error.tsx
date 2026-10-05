"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="detail-loading">
      <h1>Something went wrong.</h1>
      <p>Please try again in a moment.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
