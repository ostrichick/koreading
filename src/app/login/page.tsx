'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

// 사용자 로그인 및 가입 처리를 진행하는 LoginPage 컴포넌트입니다.
export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth(); // AuthContext로부터 유저 데이터 및 로그인 핸들러 조회
  const router = useRouter();

  // 이미 로그인 세션이 완료된 유저인 경우, 로그인 화면에 접근 시 즉시 도서관 페이지(/library)로 리다이렉션합니다.
  useEffect(() => {
    if (!loading && user) {
      router.push('/library');
    }
  }, [user, loading, router]);

  // 구글 간편 로그인 버튼 클릭 시 구동될 액션 핸들러
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle(); // 구글 소셜 로그인 팝업 활성화
    } catch (err) {
      console.error('로그인 에러:', err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 백그라운드용 그라데이션 광원 조명 효과 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {/* 상단 로고 및 안내 문구 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            background: 'var(--gradient-main)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 20px',
            boxShadow: 'var(--shadow-glow)',
          }}>
            📚
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>
            환영합니다!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            한국어 읽기 학습을 시작하세요
          </p>
        </div>

        {/* 로그인 수행 글래스모피즘 카드 박스 */}
        <div className="card-glass" style={{ padding: '36px' }}>
          {/* Koreading 회원 가입 시 얻을 수 있는 유용한 가치 제안 목록 */}
          <div style={{ marginBottom: '28px' }}>
            {[
              { icon: '🎯', text: '내 레벨에 맞는 텍스트 추천' },
              { icon: '📝', text: '단어장 & 학습 진도 저장' },
              { icon: '🌏', text: '영어/스페인어 번역 제공' },
            ].map(item => (
              <div key={item.text} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* 구글 로그인 시작 버튼 (고유 ID google-login-btn 부여로 E2E 테스트 자동화 대응) */}
          <button
            id="google-login-btn"
            onClick={handleGoogleLogin}
            className="btn btn-google"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google 계정으로 계속하기
          </button>

          {/* 약관 안내 문구 */}
          <p style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '16px',
            lineHeight: 1.6,
          }}>
            로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

