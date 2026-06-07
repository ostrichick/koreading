'use client';

/**
 * @file page.tsx (about)
 * @description Koreading 서비스 소개, 학습 철학, 주요 기능을 안내하는 About 페이지입니다.
 * Google AdSense 심사에서 사이트의 목적과 신뢰성을 보여주는 핵심 페이지입니다.
 */

import Link from 'next/link';
import Image from 'next/image';

export default function AboutPage() {
  const features = [
    {
      icon: '🎯',
      title: 'i+1 원리 기반 학습',
      desc: '언어학자 스티브 크라센(Stephen Krashen)의 입력 가설(Input Hypothesis)에 따라, 현재 수준보다 살짝 높은 난이도(i+1)의 한국어 텍스트를 읽으며 자연스럽게 언어를 체득합니다.',
    },
    {
      icon: '🤖',
      title: 'AI 맞춤 콘텐츠',
      desc: 'Groq LPU와 Google Gemini AI를 이용해 동화, 역사, K-콘텐츠, 음식 등 8가지 주제에서 사용자의 레벨에 딱 맞는 글을 무한히 생성합니다.',
    },
    {
      icon: '👆',
      title: '단어 클릭 즉시 사전',
      desc: '모르는 단어를 클릭하면 한국어 뜻, 발음 표기, 모국어 번역, 문법 구조 분석, 예문까지 즉시 표시됩니다. 마우스 오버 즉시 검색 모드도 지원합니다.',
    },
    {
      icon: '📝',
      title: '개인 단어장',
      desc: '학습 중 저장한 단어를 개인 단어장에서 언제든 복습할 수 있습니다. 주제별, 레벨별로 정리되어 체계적인 어휘 확장이 가능합니다.',
    },
    {
      icon: '📊',
      title: 'CEFR 레벨 테스트',
      desc: 'A1(입문)부터 C2(최고급)까지 유럽공통참조기준(CEFR)에 기반한 10분 레벨 테스트로 자신의 현재 한국어 수준을 정확히 파악합니다.',
    },
    {
      icon: '🌏',
      title: '4개 언어 지원',
      desc: '영어(English), 스페인어(Español), 일본어(日本語), 중국어(中文)로 번역된 사전 정의와 예문을 제공합니다.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── 히어로 섹션 ── */}
      <section style={{ padding: '80px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '300px', background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1, maxWidth: '760px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 0 40px rgba(99,102,241,0.4)', border: '1px solid var(--border-medium)' }}>
              <Image src="/logo.png" alt="Koreading logo" width={72} height={72} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, marginBottom: '20px', lineHeight: 1.15 }}>
            About{' '}
            <span style={{ background: 'var(--gradient-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Koreading
            </span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '32px' }}>
            Koreading은 전 세계 한국어 학습자들이 자신의 수준에 맞는 한국어 글을 읽으며 자연스럽게 실력을 키울 수 있도록 돕는 AI 기반 한국어 독해 학습 플랫폼입니다.
          </p>
          <Link href="/test" className="btn btn-primary btn-lg">
            🎯 무료로 레벨 테스트 시작하기
          </Link>
        </div>
      </section>

      {/* ── 미션 섹션 ── */}
      <section style={{ padding: '60px 24px', background: 'rgba(15,22,41,0.6)' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          <div className="card" style={{ padding: '40px', borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🌱 우리의 미션
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '1rem' }}>
              언어는 교재로 외우는 것이 아니라, 진짜 이야기를 읽고 이해하는 과정에서 자연스럽게 습득됩니다. Koreading은 K-드라마·K-팝·한국 역사 등 실제로 흥미로운 주제를 담은 한국어 텍스트를 AI로 학습자 수준에 맞게 생성하고, 단어를 즉시 찾아볼 수 있는 환경을 제공함으로써 학습자가 몰입 속에서 한국어를 자연스럽게 체득하도록 돕습니다.
            </p>
          </div>
        </div>
      </section>

      {/* ── 주요 기능 ── */}
      <section style={{ padding: '80px 24px' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 900, marginBottom: '12px' }}>주요 기능</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '48px', fontSize: '0.95rem' }}>
            처음 한국어를 배우는 분부터 고급 실력자까지 — 모두를 위한 도구
          </p>
          <div className="grid-3">
            {features.map((f) => (
              <div key={f.title} className="card" style={{ padding: '28px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '10px', color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 대상 학습자 ── */}
      <section style={{ padding: '60px 24px', background: 'rgba(15,22,41,0.6)' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>이런 분께 추천합니다</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              '한국어를 처음 시작하는 완전 초보자 (A1 레벨)',
              'K-드라마나 K-팝을 좋아해서 한국어를 공부하고 싶은 분',
              '문법은 아는데 실제 글 읽기가 어려운 중급 학습자',
              '어휘력을 늘리고 고급 표현을 자연스럽게 익히고 싶은 분',
              '한국 유학이나 취업을 준비하는 분',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 기술 스택 ── */}
      <section style={{ padding: '60px 24px' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>기술 스택</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {['Next.js 15 (App Router)', 'Firebase Auth', 'Cloud Firestore', 'Google Gemini AI', 'Groq LPU (Llama/Gemma)', 'Vercel', 'TypeScript'].map(tech => (
              <span key={tech} style={{ padding: '8px 18px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '100px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tech}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 개발자 정보 ── */}
      <section style={{ padding: '60px 24px', background: 'rgba(15,22,41,0.6)' }}>
        <div className="container" style={{ maxWidth: '640px' }}>
          <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>👨‍💻</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>개발자 소개</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: '20px' }}>
              안녕하세요, Koreading을 만든 <strong style={{ color: 'var(--text-primary)' }}>Munseong Choi</strong>입니다.<br />
              한국어를 배우는 전 세계 학습자들을 위해 더 쉽고 재미있는 학습 경험을 제공하고자 이 서비스를 만들었습니다.
            </p>
            <a
              href="mailto:asulchoi@gmail.com"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
            >
              ✉️ asulchoi@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '500px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '16px' }}>지금 바로 시작해보세요</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem', lineHeight: 1.7 }}>
            로그인 없이도 무료로 레벨 테스트를 받고 한국어 읽기를 시작할 수 있습니다.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/test" className="btn btn-primary btn-lg">🎯 레벨 테스트 (무료)</Link>
            <Link href="/library" className="btn btn-secondary btn-lg">📚 도서관 보기</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
