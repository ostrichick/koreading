'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { getGuestLevel } from '@/lib/storage';

// Bilingual text component — shows English, reveals Korean on hover with ZERO layout shifting
function BilingualText({
  en,
  ko,
  style = {},
}: {
  en: string;
  ko: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'default',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr',
        transition: 'all 0.3s ease',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <span style={{
        gridArea: '1 / 1 / 2 / 2',
        transition: 'opacity 0.25s ease, transform 0.25s ease, visibility 0.25s ease',
        opacity: hovered ? 0 : 1,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        visibility: hovered ? 'hidden' : 'visible',
      }}>
        {en}
      </span>
      <span style={{
        gridArea: '1 / 1 / 2 / 2',
        transition: 'opacity 0.25s ease, transform 0.25s ease, visibility 0.25s ease',
        opacity: hovered ? 1 : 0,
        transform: hovered ? 'translateY(0)' : 'translateY(4px)',
        visibility: hovered ? 'visible' : 'hidden',
        color: 'var(--accent-primary)',
        fontFamily: 'Noto Sans KR, sans-serif',
      }}>
        {ko}
      </span>
    </span>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) { router.push('/library'); return; }
    const level = getGuestLevel();
    if (level) router.push('/library');
  }, [user, loading, router]);

  if (loading) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  const features = [
    {
      icon: '🎯',
      en: 'Level Test',
      ko: '레벨 테스트',
      descEn: 'Find your exact level from A1 to C2 with an AI-generated reading test.',
      descKo: 'AI가 생성한 읽기 테스트로 A1부터 C2까지 정확한 레벨을 파악해요.',
    },
    {
      icon: '📚',
      en: 'i+1 Texts',
      ko: 'i+1 원리 텍스트',
      descEn: '90% familiar + 10% new vocabulary — the proven formula for language acquisition.',
      descKo: '90% 아는 어휘 + 10% 새 어휘 — 언어 습득에 검증된 방법입니다.',
    },
    {
      icon: '👆',
      en: 'Tap Any Word',
      ko: '단어 클릭 사전',
      descEn: 'Click any Korean word for its definition, example sentences, and translation.',
      descKo: '한국어 단어를 클릭하면 정의, 예문, 번역이 즉시 표시됩니다.',
    },
    {
      icon: '📝',
      en: 'Vocabulary Notebook',
      ko: '내 단어장',
      descEn: 'Save words by topic and review them anytime in your personal notebook.',
      descKo: '주제별로 단어를 저장하고 언제든 내 단어장에서 복습하세요.',
    },
    {
      icon: '✅',
      en: 'Track Progress',
      ko: '학습 진도 저장',
      descEn: 'See which texts you\'ve read. Pick up exactly where you left off.',
      descKo: '읽은 글이 표시되어 학습 기록을 한눈에 관리할 수 있어요.',
    },
    {
      icon: '🌏',
      en: 'EN & ES Support',
      ko: '영어 & 스페인어',
      descEn: 'Full translations in English and Spanish — choose what works for you.',
      descKo: '영어 또는 스페인어로 맞춤 번역을 제공합니다.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Hero ── */}
      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glows */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '5%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Logo mark */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 0 40px rgba(99,102,241,0.4)', border: '1px solid var(--border-medium)' }}>
              <Image src="/logo.png" alt="Koreading logo" width={80} height={80} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--border-medium)', borderRadius: '100px', fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '28px', fontWeight: 600 }}>
            ✨ i+1 Principle · Korean Reading
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '12px', letterSpacing: '-0.02em' }}>
            Read Korean.{' '}
            <span style={{ background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Actually acquire it.
            </span>
          </h1>

          {/* Hover hint */}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '32px', letterSpacing: '0.05em' }}>
            ✦ Hover the text below to see Korean · 아래 텍스트에 마우스를 올려보세요 ✦
          </p>

          {/* Bilingual subtitle */}
          <div style={{ maxWidth: '640px', margin: '0 auto 48px' }}>
            <div style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', lineHeight: 1.6 }}>
              <BilingualText en="Koreading gives you Korean texts perfectly matched to your level." ko="코리딩은 당신의 레벨에 딱 맞는 한국어 텍스트를 제공합니다." />
              <BilingualText en="Click any word for an instant dictionary lookup." ko="모르는 단어는 클릭 한 번으로 즉시 사전을 확인하세요." />
              <BilingualText en="No login needed to start." ko="시작하는 데 로그인이 필요 없어요." />
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/test" className="btn btn-primary btn-lg">
              🎯 Start Level Test — Free
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              🔑 Sign In
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '48px', justifyContent: 'center', marginTop: '64px', flexWrap: 'wrap' }}>
            {[
              { value: 'A1~C2', label: '6 CEFR Levels' },
              { value: '8', label: 'Topic Categories' },
              { value: '∞', label: 'AI-generated Texts' },
              { value: 'Free', label: 'To Get Started' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(15,22,41,0.5)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '12px' }}>
            Everything you need to read Korean
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '48px', fontSize: '0.9rem' }}>
            Hover each card to see it in Korean
          </p>
          <div className="grid-3">
            {features.map(f => (
              <FeatureCard key={f.en} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '16px' }}>
            Ready to read Korean?
          </h2>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
            <BilingualText en="Take a 5-minute level test and start reading immediately." ko="5분 레벨 테스트로 바로 시작하세요." />
          </div>
          <Link href="/test" className="btn btn-primary btn-lg">
            🚀 Start for Free
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '28px 24px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Image src="/logo.png" alt="Koreading logo" width={20} height={20} style={{ borderRadius: '4px', opacity: 0.6 }} />
          Koreading — Korean Reading for Every Level
        </div>
      </footer>
    </div>
  );
}

// Feature card with bilingual hover
function FeatureCard({ icon, en, ko, descEn, descKo }: { icon: string; en: string; ko: string; descEn: string; descKo: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'default', transition: 'all 0.25s ease' }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{
        fontSize: '1.1rem',
        marginBottom: '10px',
        transition: 'all 0.25s ease',
        color: hovered ? 'var(--accent-primary)' : 'var(--text-primary)',
        fontFamily: hovered ? 'Noto Sans KR, sans-serif' : 'inherit',
      }}>
        {hovered ? ko : en}
      </h3>
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '0.875rem',
        lineHeight: 1.7,
        transition: 'all 0.25s ease',
        fontFamily: hovered ? 'Noto Sans KR, sans-serif' : 'inherit',
      }}>
        {hovered ? descKo : descEn}
      </p>
    </div>
  );
}
