import type { Metadata } from 'next';
export const metadata: Metadata = { alternates: { canonical: 'https://koreading.vercel.app/vocabulary' }, robots: { index: false, follow: true }, };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
