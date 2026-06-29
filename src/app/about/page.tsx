/**
 * @file page.tsx (about)
 * @description About Koreading — English-first page for international SEO and Google indexing.
 * This page is intentionally written in English to help Google extract English snippets
 * for search results shown to non-Korean speaking users worldwide.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Koreading — Free AI Korean Reading Platform',
  description:
    'Learn about Koreading, the free AI-powered Korean reading platform. Practice Korean reading from beginner (A1) to advanced (C2) with personalized texts, instant dictionary, and vocabulary tools.',
};

const features = [
  {
    icon: '🎯',
    title: 'i+1 Input Hypothesis',
    desc: 'Based on linguist Stephen Krashen\'s Input Hypothesis: reading texts that are just slightly above your current level (i+1) is the most effective way to acquire a language naturally.',
    titleKo: 'i+1 원리 기반 학습',
  },
  {
    icon: '🤖',
    title: 'AI-Generated Korean Texts',
    desc: 'Powered by Groq LPU and Google Gemini AI, Koreading generates unlimited Korean reading texts across 8 topic categories — all perfectly tailored to your CEFR level.',
    titleKo: 'AI 맞춤 콘텐츠',
  },
  {
    icon: '👆',
    title: 'Instant Word Lookup',
    desc: 'Click any Korean word to instantly see its dictionary form, pronunciation (romanization), Korean definition, translation, grammatical structure, and example sentences.',
    titleKo: '단어 클릭 즉시 사전',
  },
  {
    icon: '📝',
    title: 'Personal Vocabulary Notebook',
    desc: 'Save words while reading and review them anytime in your personal vocabulary notebook. Organize by custom categories for systematic vocabulary building.',
    titleKo: '개인 단어장',
  },
  {
    icon: '📊',
    title: 'CEFR Level Test',
    desc: 'Take a 10-minute AI-generated placement test to accurately identify your Korean level from A1 (complete beginner) to C2 (mastery), based on the European CEFR framework.',
    titleKo: 'CEFR 레벨 테스트',
  },
  {
    icon: '🌏',
    title: '4 Language Support',
    desc: 'Full translation support in English, Spanish (Español), Japanese (日本語), and Chinese (中文). Dictionary definitions and example sentence translations in your native language.',
    titleKo: '4개 언어 지원',
  },
];

const targetUsers = [
  'Complete beginners starting Korean from scratch (A1 level)',
  'K-drama and K-pop fans who want to understand Korean',
  'Intermediate learners who know grammar but struggle to read real texts',
  'Advanced learners building vocabulary and mastering natural expressions',
  'TOPIK exam candidates looking for reading practice',
  'Anyone who wants to learn Korean for travel, work, or study in Korea',
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── Hero Section ── */}
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
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '8px' }}>
            Koreading is a <strong style={{ color: 'var(--text-primary)' }}>free, AI-powered Korean reading platform</strong> that helps
            learners worldwide improve their Korean reading skills naturally — by reading real, level-matched Korean texts.
          </p>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '32px' }}>
            한국어 독해 학습 플랫폼 · Plataforma de lectura en coreano · 韓国語読解学習プラットフォーム · 韩语阅读学习平台
          </p>
          <Link href="/test" className="btn btn-primary btn-lg">
            🎯 Start Free Level Test
          </Link>
        </div>
      </section>

      {/* ── Mission Section ── */}
      <section style={{ padding: '60px 24px', background: 'rgba(15,22,41,0.6)' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          <div className="card" style={{ padding: '40px', borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🌱 Our Mission
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '1rem', marginBottom: '12px' }}>
              Languages are not memorized from textbooks — they are <em>acquired</em> by reading and comprehending real stories.
              Koreading uses AI to generate engaging Korean texts on topics you actually care about (K-dramas, Korean history,
              food, daily life, and more), matched precisely to your current proficiency level.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: '1rem' }}>
              With an instant word lookup on every word, you stay in the flow of reading instead of breaking concentration to
              open a separate dictionary app. This immersive reading experience is how Korean is naturally acquired.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section style={{ padding: '80px 24px' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 900, marginBottom: '12px' }}>Key Features</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '48px', fontSize: '0.95rem' }}>
            Everything you need to read Korean and build vocabulary — completely free
          </p>
          <div className="grid-3">
            {features.map((f) => (
              <div key={f.title} className="card" style={{ padding: '28px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginBottom: '8px', fontWeight: 600 }}>{f.titleKo}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who It's For ── */}
      <section style={{ padding: '60px 24px', background: 'rgba(15,22,41,0.6)' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>Who Is Koreading For?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {targetUsers.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section style={{ padding: '60px 24px' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>Built With</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {['Next.js 15 (App Router)', 'Firebase Auth', 'Cloud Firestore', 'Google Gemini AI', 'Groq LPU (Llama/Gemma)', 'Vercel', 'TypeScript'].map(tech => (
              <span key={tech} style={{ padding: '8px 18px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '100px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tech}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Developer Info ── */}
      <section style={{ padding: '60px 24px', background: 'rgba(15,22,41,0.6)' }}>
        <div className="container" style={{ maxWidth: '640px' }}>
          <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>👨‍💻</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>About the Creator</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: '20px' }}>
              Hi! I&apos;m <strong style={{ color: 'var(--text-primary)' }}>Koreading</strong>.<br />
              I built this platform to help Korean language learners worldwide get better reading practice
              with AI-powered content that adapts to their level. Learning Korean should be fun and immersive.
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
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '16px' }}>Start Reading Korean Today</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem', lineHeight: 1.7 }}>
            No login required. Take a free level test and start reading Korean texts matched to your level in minutes.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/test" className="btn btn-primary btn-lg">🎯 Free Level Test</Link>
            <Link href="/library" className="btn btn-secondary btn-lg">📚 Browse Library</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
