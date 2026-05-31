'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { lookupWord, TOPICS } from '@/lib/gemini';
import { getGuestArticle, getGuestLang, incrementGuestReadCount } from '@/lib/storage';
import { saveVocabulary } from '@/lib/db';

interface WordData {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  examples: { korean: string; translation: string }[];
  level: string;
}

function isKoreanWord(token: string): boolean {
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(token);
}

function tokenize(text: string): string[] {
  return text.split(/(\s+|[.!?,。、\n])/g).filter(t => t.length > 0);
}

export default function GuestReadPage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [article, setArticle] = useState<any>(null);
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const a = getGuestArticle();
    if (!a) { router.push('/library'); return; }
    setArticle(a);
  }, [router]);

  const handleWordClick = useCallback(async (word: string, sentence: string) => {
    if (!isKoreanWord(word)) return;
    setWordData(null);
    setLoadingWord(true);
    try {
      const lang = profile?.nativeLanguage || getGuestLang();
      const data = await lookupWord(word, sentence, lang);
      setWordData(data);
    } catch { /* ignore */ }
    finally { setLoadingWord(false); }
  }, [profile]);

  const handleSaveWord = async () => {
    if (!wordData) return;
    if (!user) {
      // Not logged in → show login prompt instead
      setWordData(null);
      setShowLoginModal(true);
      return;
    }
    try {
      await saveVocabulary(user.uid, {
        word: wordData.word,
        pronunciation: wordData.pronunciation,
        definition: wordData.definition,
        translation: wordData.translation,
        partOfSpeech: wordData.partOfSpeech,
        examples: wordData.examples,
        level: wordData.level,
        topic: article?.topicCategory || '',
        articleTitle: article?.title || '',
      });
      setSavedWords(prev => new Set([...prev, wordData.word]));
      setWordData(null);
    } catch (e) { console.error(e); }
  };

  const handleDoneReading = () => {
    const count = incrementGuestReadCount();
    setReadingDone(true);
    setShowLoginModal(true);
  };

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      setShowLoginModal(false);
      router.push('/library');
    } catch { setSigningIn(false); }
  };

  if (!article) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  const topicInfo = TOPICS.find(t => t.id === article.topicCategory);
  const paragraphs = article.content?.split('\n').filter((p: string) => p.trim()) || [];

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container" style={{ maxWidth: '760px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <a href="/library" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>📚 도서관</a>
          <span>›</span>
          <span style={{ color: 'var(--text-secondary)' }}>{article.title}</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span className={`level-badge level-${article.level}`}>{article.level}</span>
            {topicInfo && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '3px 10px', borderRadius: '100px', border: '1px solid var(--border-subtle)' }}>
                {topicInfo.emoji} {topicInfo.label}
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏱ {article.estimatedMinutes}분</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '12px', lineHeight: 1.4 }}>
            {article.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>{article.summary}</p>
        </div>

        {/* Tip */}
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '32px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          💡 모르는 단어를 <strong style={{ color: 'var(--accent-primary)' }}>클릭</strong>하면 사전과 번역이 표시됩니다.
        </div>

        {/* Key vocabulary */}
        {article.keyVocabulary?.length > 0 && (
          <div className="card" style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>핵심 어휘</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {article.keyVocabulary.map((word: string, i: number) => (
                <button key={i} onClick={() => handleWordClick(word, article.content)} style={{ background: savedWords.has(word) ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)', border: '1px solid', borderColor: savedWords.has(word) ? 'rgba(16,185,129,0.4)' : 'var(--border-subtle)', color: savedWords.has(word) ? '#10b981' : 'var(--text-primary)', padding: '6px 14px', borderRadius: '100px', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 150ms ease' }}>
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Article content */}
        <div className="card" style={{ padding: '36px', marginBottom: '32px' }}>
          {paragraphs.map((paragraph: string, pIdx: number) => {
            const tokens = tokenize(paragraph);
            return (
              <p key={pIdx} style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: '1.1rem', lineHeight: 2.2, marginBottom: '20px', color: 'var(--text-primary)' }}>
                {tokens.map((token, tIdx) =>
                  isKoreanWord(token) ? (
                    <span key={tIdx} className={`reading-word ${savedWords.has(token) ? 'saved' : ''}`} onClick={() => handleWordClick(token, paragraph)} title="클릭하여 뜻 보기">{token}</span>
                  ) : (
                    <span key={tIdx}>{token}</span>
                  )
                )}
              </p>
            );
          })}
        </div>

        {/* Done button */}
        {!readingDone && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '60px' }}>
            <a href="/library" className="btn btn-ghost">← 도서관으로</a>
            <button id="mark-done-btn" onClick={handleDoneReading} className="btn btn-primary">
              ✅ 다 읽었어요!
            </button>
          </div>
        )}
      </div>

      {/* Word Popup */}
      {(loadingWord || wordData) && (
        <div className="word-popup-overlay" onClick={e => { if (e.target === e.currentTarget) setWordData(null); }}>
          <div className="word-popup">
            {loadingWord ? (
              <div className="loading-wrapper" style={{ padding: '40px' }}>
                <div className="loading-spinner" />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>단어 검색 중...</span>
              </div>
            ) : wordData && (
              <>
                <div className="word-popup-header">
                  <div>
                    <div className="word-popup-word">{wordData.word}</div>
                    <div className="word-popup-pronunciation">[{wordData.pronunciation}]</div>
                  </div>
                  <button className="word-popup-close" onClick={() => setWordData(null)}>✕</button>
                </div>
                <span className="word-popup-pos">{wordData.partOfSpeech}</span>
                <div className="word-popup-section">
                  <div className="word-popup-section-title">📖 한국어 정의</div>
                  <div className="word-popup-definition">{wordData.definition}</div>
                </div>
                <div className="word-popup-section">
                  <div className="word-popup-section-title">🌐 번역</div>
                  <div className="word-popup-translation">{wordData.translation}</div>
                </div>
                <div className="word-popup-section">
                  <div className="word-popup-section-title">📝 예문</div>
                  {wordData.examples?.map((ex, i) => (
                    <div key={i} className="word-popup-example">
                      <div className="word-popup-example-korean">{ex.korean}</div>
                      <div className="word-popup-example-translation">{ex.translation}</div>
                    </div>
                  ))}
                </div>
                <button className="word-popup-save-btn" onClick={handleSaveWord}>
                  {user ? (savedWords.has(wordData.word) ? '✓ 단어장에 저장됨' : '📚 단어장에 저장') : '🔑 로그인하여 단어장에 저장'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Login prompt modal */}
      {showLoginModal && (
        <div className="word-popup-overlay" onClick={e => { if (e.target === e.currentTarget && !readingDone) setShowLoginModal(false); }}>
          <div className="word-popup" style={{ maxWidth: '460px', textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🎉</div>
            {readingDone ? (
              <>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '12px' }}>첫 번째 읽기 완료!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '28px' }}>
                  정말 잘 하셨어요!<br />
                  로그인하면 <strong style={{ color: 'var(--text-primary)' }}>학습 진도, 단어장, 읽기 기록</strong>을<br />
                  저장하고 언제든 이어서 공부할 수 있어요.
                </p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '12px' }}>단어장에 저장하려면 로그인이 필요해요</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '28px' }}>
                  Google 계정으로 로그인하면<br />
                  단어장, 학습 진도를 모두 저장할 수 있어요.
                </p>
              </>
            )}

            <button
              id="login-from-reading-btn"
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="btn btn-google"
              style={{ width: '100%', justifyContent: 'center', marginBottom: '12px' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {signingIn ? '로그인 중...' : 'Google로 로그인하기'}
            </button>

            <button
              onClick={() => { setShowLoginModal(false); if (readingDone) router.push('/library'); }}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {readingDone ? '로그인 없이 계속 읽기' : '나중에 하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
