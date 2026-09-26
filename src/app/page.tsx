'use client';

import Link from 'next/link';
import Image from 'next/image';

/** 영어와 한국어 안내를 터치·키보드 이용자에게도 동일하게 제공합니다. */
function BilingualText({
  en,
  ko,
  style = {},
}: {
  en: string;
  ko: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        ...style,
      }}
    >
      <span lang="en">{en}</span>
      <span lang="ko" style={{ color: 'var(--accent-primary)', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.9em' }}>{ko}</span>
    </span>
  );
}

// 서비스의 인트로/랜딩 첫 화면을 그리는 HomePage 컴포넌트입니다.
// 로고 클릭 시 항상 이 메인 화면으로 돌아올 수 있도록 자동 리다이렉트를 제거했습니다.
export default function HomePage() {
  // 서비스 특징 카드 데이터 모음
  const features = [
    {
      icon: '📚',
      en: 'Level-Selected Texts',
      ko: '레벨 선택 독해 자료',
      descEn: 'Choose an A1–C2 reading level and explore AI-generated practice texts. Level suitability is not independently validated.',
      descKo: 'A1~C2 난이도를 직접 선택해 AI 독해 자료로 연습하세요. 실제 레벨 적합도는 별도 검증되지 않았습니다.',
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
      descEn: 'See which texts you have marked as read.',
      descKo: '읽은 글이 표시되어 학습 기록을 한눈에 관리할 수 있어요.',
    },
    {
      icon: '🌏',
      en: '4 Languages',
      ko: '4개 언어',
      descEn: 'Dictionary translations are available in English, Spanish, Japanese and Chinese.',
      descKo: '단어 사전은 영어·스페인어·일본어·중국어 번역을 지원합니다.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── 히어로 배너 섹션 ── */}
      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* 장식용 은은한 웜 앰버 빛 무리 백그라운드 효과 */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse, rgba(217,119,6,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '5%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(13,148,136,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Koreading 로고 마크 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(217,119,6,0.2)', border: '1px solid var(--border-medium)' }}>
              <Image src="/logo.png" alt="Koreading logo" width={80} height={80} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

          {/* 서브 설명 뱃지 */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(217,119,6,0.08)', border: '1px solid var(--border-medium)', borderRadius: '100px', fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '28px', fontWeight: 600 }}>
            AI-powered Korean Reading Practice
          </div>

          {/* 메인 헤드라인 타이틀 */}
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '12px', letterSpacing: '-0.02em' }}>
            Read Korean.
            <br />
            <span style={{ background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Practice at your pace.
            </span>
          </h1>

          {/* 사용방법 힌트 */}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '32px', letterSpacing: '0.05em' }}>
            ✦ English and Korean guidance · 영어와 한국어 안내 ✦
          </p>

          {/* 레이아웃 시프트가 없는 2개 언어 실시간 페이드 자막 */}
          <div style={{ maxWidth: '640px', margin: '0 auto 48px' }}>
            <div style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', lineHeight: 1.6 }}>
              <BilingualText en="Choose a reading level and explore AI-generated Korean texts." ko="독해 난이도를 선택해 AI가 생성한 한국어 글을 읽어보세요." />
              <BilingualText en="Click any word for an instant dictionary lookup." ko="모르는 단어는 클릭 한 번으로 즉시 사전을 확인하세요." />
              <BilingualText en="Browse without logging in. AI generation is subject to limits." ko="로그인 없이 글을 찾아볼 수 있어요. AI 생성에는 이용 제한이 있습니다." />
            </div>
          </div>

          {/* 페이지 이동 유도 버튼 */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/library" className="btn btn-primary btn-lg">
              📚 Browse Reading Texts
            </Link>
            <Link href="/about" className="btn btn-secondary btn-lg">
              About Koreading
            </Link>
          </div>

          {/* 주요 학습 통계/수치 요약 */}
          <div style={{ display: 'flex', gap: '48px', justifyContent: 'center', marginTop: '64px', flexWrap: 'wrap' }}>
            {[
              { value: 'A1~C2', label: '6 Difficulty Labels' },
              { value: '8', label: 'Topic Categories' },
              { value: 'AI', label: 'Generated Reading Practice' },
              { value: '4', label: 'Dictionary Languages' },
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

      {/* ── 서비스 상세 기능 리스트 섹션 ── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg-secondary)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '12px' }}>
            Everything you need to read Korean
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '48px', fontSize: '0.9rem' }}>
            Explore reading features in English and Korean
          </p>
          <div className="grid-3">
            {features.map(f => (
              <FeatureCard key={f.en} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 하단 마무리 CTA 배너 섹션 ── */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '16px' }}>
            Ready to read Korean?
          </h2>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
            <BilingualText en="Browse Korean texts without an account; AI generation has request limits." ko="계정 없이 한국어 글을 둘러볼 수 있어요. AI 생성에는 이용 제한이 있습니다." />
          </div>
          <Link href="/library" className="btn btn-primary btn-lg">
            🚀 Start Reading Now
          </Link>
        </div>
      </section>
    </div>
  );
}

// 각 고유 기능 카드 컴포넌트
function FeatureCard({ icon, en, ko, descEn, descKo }: { icon: string; en: string; ko: string; descEn: string; descKo: string }) {
  return (
    <div
      className="card"
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', color: 'var(--text-primary)' }}>{en}</h3>
      <p lang="ko" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginBottom: '10px' }}>{ko}</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>{descEn}</p>
      <p lang="ko" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.7, marginTop: '8px' }}>{descKo}</p>
    </div>
  );
}

