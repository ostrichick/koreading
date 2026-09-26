import type { Metadata } from 'next';
// Placement assessment is intentionally unavailable until its educational validity is checked.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
