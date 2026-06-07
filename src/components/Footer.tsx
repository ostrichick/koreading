'use client';

/**
 * @file Footer.tsx
 * @description 사이트 전체 하단에 공통으로 표시되는 푸터 컴포넌트입니다.
 * Privacy Policy, Terms of Service, About 링크를 제공하여 Google AdSense 심사 기준을 충족합니다.
 * onMouseEnter/onMouseLeave 이벤트 핸들러를 사용하므로 클라이언트 컴포넌트로 선언합니다.
 */

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{
      background: 'rgba(10,14,26,0.9)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '40px 24px 28px',
      marginTop: 'auto',
    }}>
      <div className="container">
        {/* 상단: 로고 + 링크 그룹 */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '32px',
          marginBottom: '32px',
        }}>
          {/* 로고 + 서비스 설명 */}
          <div style={{ maxWidth: '280px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '12px' }}>
              <Image src="/logo.png" alt="Koreading logo" width={28} height={28} style={{ borderRadius: '6px' }} />
              <span style={{ fontWeight: 800, fontSize: '1rem', background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Koreading
              </span>
            </Link>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.7 }}>
              AI 기반 한국어 독해 학습 플랫폼. 레벨에 맞는 한국어를 읽고 단어를 즉시 사전으로 확인하세요.
            </p>
          </div>

          {/* 링크 그룹들 */}
          <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
            {/* 서비스 */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>서비스</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { href: '/test', label: '레벨 테스트' },
                  { href: '/library', label: '도서관' },
                  { href: '/vocabulary', label: '내 단어장' },
                ].map(link => (
                  <Link key={link.href} href={link.href} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 150ms ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* 회사/정보 */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>정보</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { href: '/about', label: 'About' },
                ].map(link => (
                  <Link key={link.href} href={link.href} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 150ms ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    {link.label}
                  </Link>
                ))}
                <a href="mailto:asulchoi@gmail.com" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 150ms ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  문의하기
                </a>
              </div>
            </div>

            {/* 법적 문서 */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>법적 정보</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { href: '/privacy', label: '개인정보처리방침' },
                  { href: '/terms', label: '이용약관' },
                ].map(link => (
                  <Link key={link.href} href={link.href} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 150ms ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            © {currentYear} Koreading by Munseong Choi. All rights reserved.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Powered by Google Gemini AI & Groq LPU
          </p>
        </div>
      </div>
    </footer>
  );
}
