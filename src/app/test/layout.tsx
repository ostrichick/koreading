import type { Metadata } from 'next';
export const metadata: Metadata = { alternates: { canonical: 'https://koreading.vercel.app/test' },  };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
