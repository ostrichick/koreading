'use client';

import { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getArticleById, markArticleRead, saveVocabulary, getReadArticles, Article, saveReview, getReviews, Review } from '@/lib/db';
import { lookupWordBasic, lookupWordAdvanced, TOPICS } from '@/lib/gemini';
import { getGuestLang } from '@/lib/storage';

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

function tokenizeKorean(text: string): string[] {
  return text.split(/(\s+|[.!?,。、])/g).filter(t => t.length > 0);
}

function isKoreanWord(token: string): boolean {
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(token);
}

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, profile } = useAuth();
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [savingWord, setSavingWord] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  // Hover lookup state
  const [hoverLookup, setHoverLookup] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reviews states
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    // Load hover preference from localStorage
    const savedHover = localStorage.getItem('koreading_hover_lookup') === 'true';
    setHoverLookup(savedHover);

    const load = async () => {
      const a = await getArticleById(id);
      if (!a) { router.push('/library'); return; }
      setArticle(a);
      
      if (user) {
        const readIds = await getReadArticles(user.uid);
        setIsRead(readIds.includes(id));
      }
      
      const list = await getReviews(id);
      setReviews(list);
      setLoading(false);
    };
    load();

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [id, user, router]);

  const handleWordClick = useCallback(async (word: string, sentence: string) => {
    if (!isKoreanWord(word)) return;
    const nativeLang = user ? (profile?.nativeLanguage || 'en') : getGuestLang();
    if (!nativeLang) return;
    
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
  }, [profile, user]);

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
    if (!user || !wordData || !article) {
      alert('단어를 저장하려면 로그인해야 합니다.');
      router.push('/login');
      return;
    }
    setSavingWord(true);
    try {
      await saveVocabulary(user.uid, {
        word: wordData.word,
        pronunciation: wordData.pronunciation,
        definition: wordData.definition,
        translation: wordData.translation,
        partOfSpeech: wordData.partOfSpeech,
        examples: wordData.examples || [],
        level: wordData.level,
        topic: article.topicCategory,
        articleTitle: article.title,
      });
      setSavedWords(prev => new Set([...prev, wordData.word]));
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
      closePopup();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingWord(false);
    }
  };

  const handleMarkRead = async () => {
    if (!user) {
      setIsRead(true);
      return;
    }
    setMarkingRead(true);
    await markArticleRead(user.uid, id);
    setIsRead(true);
    setMarkingRead(false);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      alert('별점을 선택해주세요!');
      return;
    }
    setSubmittingReview(true);
    try {
      const name = user?.displayName || '게스트';
      await saveReview(id, {
        rating,
        pros,
        cons,
        userDisplayName: name,
      });
      setHasReviewed(true);
      setPros('');
      setCons('');
      setRating(0);
      
      const list = await getReviews(id);
      setReviews(list);
      
      const updatedArticle = await getArticleById(id);
      if (updatedArticle) setArticle(updatedArticle);
    } catch (err) {
      console.error(err);
      alert('리뷰 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--text-muted)' }}>텍스트 불러오는 중...</span>
    </div>
  );

  if (!article) return null;

  const topicInfo = TOPICS.find(t => t.id === article.topicCategory);
  const paragraphs = article.content.split('\n').filter(p => p.trim());
  const activeNativeLang = user ? (profile?.nativeLanguage || 'en') : getGuestLang();

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

        {/* Article header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span className={`level-badge level-${article.level}`}>{article.level}</span>
            {topicInfo && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '3px 10px', borderRadius: '100px', border: '1px solid var(--border-subtle)' }}>
                {topicInfo.emoji} {topicInfo.label}
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏱ {article.estimatedMinutes}분</span>
            {article.averageRating ? (
              <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '3px 10px', borderRadius: '100px', border: '1px solid rgba(251,191,36,0.3)', fontWeight: 700 }}>
                ★ {article.averageRating} ({article.ratingCount}개 평가)
              </span>
            ) : null}
            {isRead && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '3px 10px', borderRadius: '100px', border: '1px solid rgba(16,185,129,0.3)' }}>
                ✓ 읽음
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '12px', lineHeight: 1.4 }}>
            {article.title}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
            {article.summary}
          </p>
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
        {article.keyVocabulary && article.keyVocabulary.length > 0 && (
          <div className="card" style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>
              핵심 어휘
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {article.keyVocabulary.map((word, i) => (
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
                    transition: 'all 150ms ease',
                  }}
                >
                  {savedWords.has(word) && '✓ '}{word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Article content */}
        <div className="card" style={{ padding: '36px', marginBottom: '32px' }}>
          {paragraphs.map((paragraph, pIdx) => {
            const tokens = tokenizeKorean(paragraph);
            return (
              <p key={pIdx} style={{
                fontFamily: 'Noto Sans KR, sans-serif',
                fontSize: '1.1rem',
                lineHeight: 2.2,
                marginBottom: '20px',
                color: 'var(--text-primary)',
              }}>
                {tokens.map((token, tIdx) => {
                  if (isKoreanWord(token)) {
                    const isSaved = savedWords.has(token);
                    return (
                      <span
                        key={tIdx}
                        className={`reading-word ${isSaved ? 'saved' : ''}`}
                        onClick={() => handleWordClick(token, paragraph)}
                        onMouseEnter={() => handleWordMouseEnter(token, paragraph)}
                        onMouseLeave={handleWordMouseLeave}
                        title="클릭/오버하여 뜻 보기"
                      >
                        {token}
                      </span>
                    );
                  }
                  return <span key={tIdx}>{token}</span>;
                })}
              </p>
            );
          })}
        </div>

        {/* Rating and Comment Section */}
        <div className="card" style={{ marginBottom: '32px', padding: '32px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💬 이 읽기 자료에 평가 남기기
          </h2>
          
          {hasReviewed ? (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: '16px', color: '#10b981', fontSize: '0.9rem', marginBottom: '24px', fontWeight: 600, textAlign: 'center' }}>
              🎉 별점과 코멘트가 성공적으로 등록되었습니다. 감사합니다!
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} style={{ marginBottom: '32px' }}>
              {/* Star Rating Select */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  별점을 선택해주세요 (필수)
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const active = star <= (hoverRating || rating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '2rem',
                          padding: 0,
                          color: active ? '#fbbf24' : 'var(--border-medium)',
                          transition: 'transform 100ms ease, color 150ms ease',
                          transform: active ? 'scale(1.1)' : 'scale(1)',
                        }}
                      >
                        ★
                      </button>
                    );
                  })}
                  {rating > 0 && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 600 }}>
                      {rating}점 / 5점
                    </span>
                  )}
                </div>
              </div>

              {/* Pros Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  👍 좋았던 점
                </label>
                <textarea
                  value={pros}
                  onChange={e => setPros(e.target.value)}
                  placeholder="단어 구성, 흥미로운 주제, 난이도 적절성 등 좋았던 부분을 작성해보세요."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
                />
              </div>

              {/* Cons Input */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  👎 아쉬운 점
                </label>
                <textarea
                  value={cons}
                  onChange={e => setCons(e.target.value)}
                  placeholder="번역 개선점, 어려운 단어 분포 등 아쉬웠던 부분을 편하게 알려주세요."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview || rating === 0}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {submittingReview ? '제출 중...' : '별점 및 평가 등록하기'}
              </button>
            </form>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '32px 0' }} />

          {/* User Reviews List */}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⭐ 독자 평가 ({reviews.length}개)</span>
              {article.averageRating ? (
                <span style={{ color: '#fbbf24', fontSize: '1.1rem', fontWeight: 800 }}>
                  ★ {article.averageRating} / 5.0
                </span>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>평가 없음</span>
              )}
            </h3>

            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                아직 작성된 평가가 없습니다. 첫 번째 평가를 남겨보세요!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reviews.map(rev => (
                  <div key={rev.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{rev.userDisplayName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>· 독자</span>
                      </div>
                      <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem' }}>
                        {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                      </div>
                    </div>

                    {rev.pros && (
                      <div style={{ fontSize: '0.85rem', marginBottom: '8px', lineHeight: 1.5 }}>
                        <span style={{ color: '#10b981', fontWeight: 700, marginRight: '6px' }}>👍 좋았던 점:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{rev.pros}</span>
                      </div>
                    )}

                    {rev.cons && (
                      <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <span style={{ color: '#fb7185', fontWeight: 700, marginRight: '6px' }}>👎 아쉬운 점:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{rev.cons}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mark as read */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '60px', flexWrap: 'wrap' }}>
          <a href="/library" className="btn btn-ghost">← 도서관으로</a>
          {!isRead && (
            <button
              id="mark-read-btn"
              onClick={handleMarkRead}
              disabled={markingRead}
              className="btn btn-primary"
            >
              {markingRead ? '저장 중...' : '✅ 읽음으로 표시'}
            </button>
          )}
        </div>
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

                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className={`level-badge level-${wordData.level}`}>{wordData.level}</span>
                </div>

                <button
                  className="word-popup-save-btn"
                  onClick={handleSaveWord}
                  disabled={savingWord || savedWords.has(wordData.word)}
                >
                  {savingWord ? '저장 중...' : savedWords.has(wordData.word) ? '✓ 단어장에 저장됨' : '📚 단어장에 저장'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {savedToast && (
        <div className="toast toast-success">
          ✓ 단어장에 저장되었습니다!
        </div>
      )}
    </div>
  );
}
