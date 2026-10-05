import Link from "next/link";
export default function NotFound() {
  return (
    <main className="detail-loading">
      <h1>Recipe not found.</h1>
      <p>It may no longer be available.</p>
      <Link className="primary" href="/">
        Back to ingredient search
      </Link>
    </main>
  );
}
