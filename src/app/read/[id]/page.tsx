'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getArticleById, markArticleRead, saveVocabulary, getReadArticles, Article } from '@/lib/db';
import { lookupWord, TOPICS } from '@/lib/gemini';

interface WordData {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  examples: { korean: string; translation: string }[];
  level: string;
}

function tokenizeKorean(text: string): string[] {
  // Split into words while preserving punctuation
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
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [savingWord, setSavingWord] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    const load = async () => {
      const a = await getArticleById(id);
      if (!a) { router.push('/library'); return; }
      setArticle(a);
      const readIds = await getReadArticles(user.uid);
      setIsRead(readIds.includes(id));
      setLoading(false);
    };
    load();
  }, [id, user, router]);

  const handleWordClick = useCallback(async (word: string, sentence: string) => {
    if (!isKoreanWord(word) || !profile?.nativeLanguage) return;
    setWordData(null);
    setLoadingWord(true);
    try {
      const data = await lookupWord(word, sentence, profile.nativeLanguage);
      setWordData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWord(false);
    }
  }, [profile]);

  const closePopup = () => setWordData(null);

  const handleSaveWord = async () => {
    if (!user || !wordData || !article) return;
    setSavingWord(true);
    try {
      await saveVocabulary(user.uid, {
        word: wordData.word,
        pronunciation: wordData.pronunciation,
        definition: wordData.definition,
        translation: wordData.translation,
        partOfSpeech: wordData.partOfSpeech,
        examples: wordData.examples,
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
    if (!user || isRead) return;
    setMarkingRead(true);
    await markArticleRead(user.uid, id);
    setIsRead(true);
    setMarkingRead(false);
  };

  if (loading) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--text-muted)' }}>텍스트 불러오는 중...</span>
    </div>
  );

  if (!article) return null;

  const topicInfo = TOPICS.find(t => t.id === article.topicCategory);

  // Tokenize article content into paragraphs and words
  const paragraphs = article.content.split('\n').filter(p => p.trim());

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
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

        {/* Tip box */}
        <div style={{
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '32px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          💡 모르는 단어를 <strong style={{ color: 'var(--accent-primary)' }}>클릭</strong>하면 사전과 번역이 표시됩니다.
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
                        title="클릭하여 뜻 보기"
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

      {/* Word Lookup Popup */}
      {(loadingWord || wordData) && (
        <div className="word-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePopup(); }}>
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
                  <button className="word-popup-close" onClick={closePopup}>✕</button>
                </div>

                <span className="word-popup-pos">{wordData.partOfSpeech}</span>

                <div className="word-popup-section">
                  <div className="word-popup-section-title">📖 한국어 정의</div>
                  <div className="word-popup-definition">{wordData.definition}</div>
                </div>

                <div className="word-popup-section">
                  <div className="word-popup-section-title">
                    🌐 {profile?.nativeLanguage === 'es' ? '스페인어' : '영어'} 번역
                  </div>
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
