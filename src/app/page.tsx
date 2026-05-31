'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/library');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>로딩 중...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow effects */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          top: '30%',
          right: '5%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid var(--border-medium)',
            borderRadius: '100px',
            fontSize: '0.8rem',
            color: 'var(--accent-primary)',
            marginBottom: '32px',
            fontWeight: 600,
          }}>
            ✨ i+1 원리 기반 한국어 읽기
          </div>

          {/* Main heading */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: '24px',
            letterSpacing: '-0.02em',
          }}>
            한국어를{' '}
            <span style={{
              background: 'var(--gradient-main)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              자연스럽게
            </span>
            {' '}읽다
          </h1>

          <p style={{
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
            maxWidth: '600px',
            margin: '0 auto 48px',
            lineHeight: 1.8,
          }}>
            당신의 레벨에 딱 맞는 한국어 텍스트를 읽으세요.
            모르는 단어는 클릭 한 번으로 즉시 확인하고,
            내 단어장에 저장하세요.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary btn-lg">
              🚀 무료로 시작하기
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              📖 레벨 테스트 하기
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: '48px',
            justifyContent: 'center',
            marginTop: '64px',
            flexWrap: 'wrap',
          }}>
            {[
              { value: 'A1~C2', label: '6단계 레벨' },
              { value: '8가지', label: '다양한 주제' },
              { value: '무제한', label: 'AI 생성 콘텐츠' },
              { value: '무료', label: '시작 비용' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  background: 'var(--gradient-main)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px', background: 'rgba(15,22,41,0.5)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '48px' }}>
            이런 기능이 있어요
          </h2>
          <div className="grid-3">
            {[
              {
                icon: '🎯',
                title: '레벨 테스트',
                desc: 'A1부터 C2까지 자동으로 내 한국어 수준을 파악해요.',
              },
              {
                icon: '📚',
                title: 'i+1 원리 텍스트',
                desc: '90% 이해 + 10% 새 어휘로 자연스러운 언어 습득을 돕습니다.',
              },
              {
                icon: '👆',
                title: '단어 클릭 사전',
                desc: '모르는 단어를 클릭하면 정의, 예문, 영어/스페인어 번역이 즉시 표시됩니다.',
              },
              {
                icon: '📝',
                title: '내 단어장',
                desc: '저장한 단어를 주제별로 정리해서 언제든 복습할 수 있어요.',
              },
              {
                icon: '✅',
                title: '읽기 진도 저장',
                desc: '이미 읽은 글은 표시되어 다시 읽을지 새 글을 읽을지 선택할 수 있어요.',
              },
              {
                icon: '🌏',
                title: '영어 & 스페인어',
                desc: '영어 또는 스페인어 모국어 설정으로 맞춤 번역을 제공합니다.',
              },
            ].map(feature => (
              <div key={feature.title} className="card">
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{feature.icon}</div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{feature.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '32px 24px',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}>
        <div className="container">
          <span>📚 읽기 — 한국어 읽기 학습 플랫폼</span>
        </div>
      </footer>
    </div>
  );
}
