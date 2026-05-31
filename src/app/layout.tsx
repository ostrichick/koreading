import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: '읽기 — 한국어 읽기 학습',
  description: '레벨에 맞는 한국어 텍스트로 자연스럽게 한국어를 습득하세요.',
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
