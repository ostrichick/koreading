'use client';

/**
 * @file page.tsx (read/guest)
 * @description 비로그인 게스트 사용자가 방금 임시 생성한 맞춤형 한국어 텍스트를 읽고 인터랙티브 사전을 활용하는 '게스트 전용 본문 독해 화면'입니다. 회원이 아니어도 초광속 2단계 점진적 사전 조회(Double-Stage Progressive Lookup), iOS 스타일 마우스 오버 즉시 검색, 다 읽은 후 자동 가입 권유 모달 등을 제공합니다.
 * @why 신규 유저가 복잡한 구글 로그인이나 가입 절차 없이도 코레딩의 초속 독해 및 사전 조회의 매끄러움을 온전히 경험하고 자연스럽게 정식 회원으로 유입되게 돕는 강력한 랜딩 버퍼로 작동하기 위해 존재합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { lookupWordBasic, lookupWordAdvanced, TOPICS } from '@/lib/gemini';
import { getGuestArticle, getGuestLang, incrementGuestReadCount } from '@/lib/storage';
import { saveVocabulary, deleteArticle } from '@/lib/db';

interface WordData {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  structure?: string;
  definition: string;
  translation: string;
  examples?: { korean: string; translation: string }[];
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
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Hover lookup state
  const [hoverLookup, setHoverLookup] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load hover preference from localStorage
    const savedHover = localStorage.getItem('koreading_hover_lookup') === 'true';
    setHoverLookup(savedHover);

    const a = getGuestArticle();
    if (!a) { router.push('/library'); return; }
    setArticle(a);

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [router]);

  const handleWordClick = useCallback(async (word: string, sentence: string) => {
    if (!isKoreanWord(word)) return;
    const nativeLang = profile?.nativeLanguage || getGuestLang() || 'en';
    
    setWordData(null);
    setLoadingWord(true);
    setLoadingAdvanced(false);
    try {
      // Step 1: Quick basic dictionary lookup (takes < 1s)
      const basicData = await lookupWordBasic(word, sentence, nativeLang);
      setWordData(basicData);
      setLoadingWord(false); // Instantly open popup and display definition!

      // Step 2: Background advanced lookup (loads structure & examples)
      setLoadingAdvanced(true);
      const advancedData = await lookupWordAdvanced(word, sentence, nativeLang);
      setWordData(prev => prev ? { ...prev, ...advancedData } : null);
    } catch (err) {
      console.error(err);
      setLoadingWord(false);
    } finally {
      setLoadingAdvanced(false);
    }
  }, [profile]);

  // Debounced Hover Handler
  const handleWordMouseEnter = (word: string, sentence: string) => {
    if (!hoverLookup) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    hoverTimeoutRef.current = setTimeout(() => {
      handleWordClick(word, sentence);
    }, 250); // REST threshold delay to trigger dictionary
  };

  const handleWordMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const closePopup = () => {
    setWordData(null);
    setLoadingWord(false);
    setLoadingAdvanced(false);
  };

  const handleSaveWord = async () => {
    if (!wordData) return;
    if (!user) {
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
        examples: wordData.examples || [],
        level: wordData.level,
        topic: article?.topicCategory || '',
        articleTitle: article?.title || '',
      });
      setSavedWords(prev => new Set([...prev, wordData.word]));
      closePopup();
    } catch (e) { console.error(e); }
  };

  const handleDeleteArticle = async () => {
    const confirmDelete = window.confirm(
      '🚨 [테스트 기간 전용 액션]\n\n이 텍스트의 퀄리티가 너무 낮아 영구 삭제하시겠습니까?\n도서관 데이터베이스 혹은 임시 스토리지에서 완전히 제거됩니다.'
    );
    if (!confirmDelete) return;

    try {
      if (article?.id && article.id !== 'guest') {
        await deleteArticle(article.id);
      }
      sessionStorage.removeItem('koreading_guest_article');
      alert('텍스트가 성공적으로 삭제되었습니다. 도서관으로 이동합니다.');
      router.push('/library');
    } catch (err: any) {
      console.error(err);
      alert(`삭제 실패: ${err?.message || JSON.stringify(err)}`);
    }
  };

  const handleDoneReading = () => {
    incrementGuestReadCount();
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
  const activeNativeLang = profile?.nativeLanguage || getGuestLang() || 'en';

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      {/* Styles inject */}
      <style>{`
        @keyframes skeleton-pulse {
          0% {
            background-color: var(--border-subtle);
            opacity: 0.6;
          }
          50% {
            background-color: var(--border-medium);
            opacity: 1;
          }
          100% {
            background-color: var(--border-subtle);
            opacity: 0.6;
          }
        }
        .skeleton {
          animation: skeleton-pulse 1.4s ease-in-out infinite;
        }
      `}</style>

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

        {/* Settings Toggle Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            💡 모르는 단어를 클릭하면 사전이 뜹니다.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              🔍 마우스 오버로 즉시 검색
            </span>
            <button
              onClick={() => {
                const next = !hoverLookup;
                setHoverLookup(next);
                localStorage.setItem('koreading_hover_lookup', String(next));
              }}
              style={{
                position: 'relative',
                width: '46px',
                height: '24px',
                borderRadius: '100px',
                background: hoverLookup ? 'var(--accent-primary)' : 'var(--border-medium)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 200ms ease',
                padding: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                top: '3px',
                left: hoverLookup ? '25px' : '3px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'white',
                boxShadow: 'var(--shadow-sm)',
                transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </button>
          </div>
        </div>

        {/* Key vocabulary */}
        {article.keyVocabulary?.length > 0 && (
          <div className="card" style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>핵심 어휘</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {article.keyVocabulary.map((word: string, i: number) => (
                <button
                  key={i}
                  onClick={() => handleWordClick(word, article.content)}
                  onMouseEnter={() => handleWordMouseEnter(word, article.content)}
                  onMouseLeave={handleWordMouseLeave}
                  style={{
                    background: savedWords.has(word) ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                    border: '1px solid',
                    borderColor: savedWords.has(word) ? 'rgba(16,185,129,0.4)' : 'var(--border-subtle)',
                    color: savedWords.has(word) ? '#10b981' : 'var(--text-primary)',
                    padding: '6px 14px',
                    borderRadius: '100px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    transition: 'all 150ms ease'
                  }}
                >
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
                    <span
                      key={tIdx}
                      className={`reading-word ${savedWords.has(token) ? 'saved' : ''}`}
                      onClick={() => handleWordClick(token, paragraph)}
                      onMouseEnter={() => handleWordMouseEnter(token, paragraph)}
                      onMouseLeave={handleWordMouseLeave}
                      title="클릭/오버하여 뜻 보기"
                    >
                      {token}
                    </span>
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
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '60px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* [테스트 기간 전용] 텍스트 삭제 버튼 */}
            <button
              onClick={handleDeleteArticle}
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '100px',
                padding: '8px 20px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 150ms ease',
                fontFamily: 'inherit',
                marginRight: 'auto', // Push to the far left!
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            >
              🗑️ 텍스트 삭제 (품질 저하)
            </button>

            <a href="/library" className="btn btn-ghost">← 도서관으로</a>
            <button id="mark-done-btn" onClick={handleDoneReading} className="btn btn-primary">
              ✅ 다 읽었어요!
            </button>
          </div>
        )}
      </div>

      {/* Word Lookup Popup with Glimmering Skeletons */}
      {(loadingWord || wordData) && (
        <div className="word-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePopup(); }}>
          <div className="word-popup" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
            {loadingWord ? (
              <div style={{ padding: '8px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div style={{ width: '80%' }}>
                    {/* Pulsing Word Title */}
                    <div className="skeleton" style={{ width: '55%', height: '28px', marginBottom: '10px', borderRadius: '6px' }} />
                    {/* Pulsing Subtitle */}
                    <div className="skeleton" style={{ width: '30%', height: '14px', borderRadius: '4px' }} />
                  </div>
                  <button className="word-popup-close" onClick={closePopup}>✕</button>
                </div>

                {/* Pulsing Part of Speech */}
                <div className="skeleton" style={{ width: '18%', height: '18px', marginBottom: '24px', borderRadius: '4px' }} />

                {/* Pulsing Structure Section Placeholder */}
                <div style={{ marginBottom: '20px' }}>
                  <div className="skeleton" style={{ width: '45%', height: '12px', marginBottom: '10px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '88%', height: '16px', borderRadius: '4px' }} />
                </div>

                {/* Pulsing Definition Section */}
                <div style={{ marginBottom: '20px' }}>
                  <div className="skeleton" style={{ width: '35%', height: '12px', marginBottom: '10px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '92%', height: '16px', borderRadius: '4px' }} />
                </div>

                {/* Pulsing Translation Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div className="skeleton" style={{ width: '40%', height: '12px', marginBottom: '10px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '85%', height: '16px', borderRadius: '4px' }} />
                </div>

                {/* Pulsing Examples Section */}
                <div>
                  <div className="skeleton" style={{ width: '25%', height: '12px', marginBottom: '12px', borderRadius: '4px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="skeleton" style={{ width: '95%', height: '14px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ width: '60%', height: '12px', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            ) : wordData && (
              <>
                <div className="word-popup-header">
                  <div>
                    <div className="word-popup-word">{wordData.word}</div>
                    <div className="word-popup-pronunciation">[{wordData.pronunciation}]</div>
                  </div>
                  <button className="word-popup-close" onClick={closePopup}>✕</button>
                </div>

                <span className="word-popup-pos">{wordData.partOfSpeech}</span>

                {/* Progressive Morphological Structure Box */}
                {loadingAdvanced && !wordData.structure ? (
                  <div style={{ marginBottom: '20px', background: 'rgba(99,102,241,0.02)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', border: '1px dotted var(--border-subtle)' }}>
                    <div className="skeleton" style={{ width: '45%', height: '12px', marginBottom: '10px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ width: '85%', height: '16px', borderRadius: '4px' }} />
                  </div>
                ) : wordData.structure ? (
                  <div className="word-popup-section" style={{ background: 'rgba(99,102,241,0.05)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', border: '1px solid rgba(99,102,241,0.1)', marginBottom: '20px' }}>
                    <div className="word-popup-section-title" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                      🧱 단어 구조 분석 (Word Structure)
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Noto Sans KR, sans-serif', marginTop: '6px', lineHeight: 1.5 }}>
                      {wordData.structure}
                    </div>
                  </div>
                ) : null}

                <div className="word-popup-section">
                  <div className="word-popup-section-title">📖 한국어 정의</div>
                  <div className="word-popup-definition">{wordData.definition}</div>
                </div>

                <div className="word-popup-section">
                  <div className="word-popup-section-title">
                    🌐 {activeNativeLang === 'es' ? '스페인어' : '영어'} 번역
                  </div>
                  <div className="word-popup-translation">{wordData.translation}</div>
                </div>

                {/* Progressive Examples Section */}
                {loadingAdvanced && !wordData.examples ? (
                  <div style={{ marginBottom: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '16px', border: '1px dotted var(--border-subtle)' }}>
                    <div className="skeleton" style={{ width: '25%', height: '12px', marginBottom: '12px', borderRadius: '4px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="skeleton" style={{ width: '95%', height: '14px', borderRadius: '4px' }} />
                      <div className="skeleton" style={{ width: '60%', height: '12px', borderRadius: '4px' }} />
                    </div>
                  </div>
                ) : wordData.examples ? (
                  <div className="word-popup-section">
                    <div className="word-popup-section-title">📝 예문</div>
                    {wordData.examples.map((ex, i) => (
                      <div key={i} className="word-popup-example">
                        <div className="word-popup-example-korean">{ex.korean}</div>
                        <div className="word-popup-example-translation">{ex.translation}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <span className={`level-badge level-${wordData.level}`}>{wordData.level}</span>
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
