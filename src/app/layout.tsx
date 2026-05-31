import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Korider — Korean Reading for Every Level',
  description: 'Read Korean texts perfectly matched to your level. Click any word for instant definitions, examples, and translations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <NavBar />
          <main className="page-wrapper">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
