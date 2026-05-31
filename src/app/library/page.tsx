'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { TOPICS, CEFRLevel, generateArticle } from '@/lib/gemini';
import { getArticlesByLevel, saveArticle, getReadArticles, Article } from '@/lib/db';

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function LibraryPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | 'all'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [articles, setArticles] = useState<Article[]>([]);
  const [readArticles, setReadArticles] = useState<string[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (profile && !profile.level) router.push('/test');
  }, [user, profile, router]);

  const loadArticles = useCallback(async (level: CEFRLevel | 'all') => {
    setLoadingArticles(true);
    try {
      let all: Article[] = [];
      if (level === 'all') {
        const results = await Promise.all(LEVELS.map(l => getArticlesByLevel(l)));
        all = results.flat();
      } else {
        all = await getArticlesByLevel(level);
      }
      setArticles(all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  useEffect(() => {
    loadArticles(selectedLevel);
  }, [selectedLevel, loadArticles]);

  useEffect(() => {
    if (!user) return;
    getReadArticles(user.uid).then(setReadArticles);
  }, [user]);

  const handleGenerate = async () => {
    if (!profile?.level || !profile?.nativeLanguage) return;
    setGenerating(true);
    try {
      const topic = selectedTopic === 'all'
        ? TOPICS[Math.floor(Math.random() * TOPICS.length)].id
        : selectedTopic;
      const level = selectedLevel === 'all' ? profile.level : selectedLevel;
      const data = await generateArticle(level, topic, profile.nativeLanguage);
      const id = await saveArticle(data);
      router.push(`/read/${id}`);
    } catch (err) {
      console.error(err);
      alert('텍스트 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setGenerating(false);
    }
  };

  const filteredArticles = articles.filter(a => {
    const matchLevel = selectedLevel === 'all' || a.level === selectedLevel;
    const matchTopic = selectedTopic === 'all' || a.topicCategory === selectedTopic;
    return matchLevel && matchTopic;
  });

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>📚 도서관</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              내 레벨:{' '}
              {profile?.level && (
                <span className={`level-badge level-${profile.level}`}>{profile.level}</span>
              )}
            </p>
          </div>
          <button
            id="generate-article-btn"
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-primary"
            style={{ gap: '8px' }}
          >
            {generating ? (
              <>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                생성 중...
              </>
            ) : (
              '✨ 새 텍스트 생성'
            )}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {/* Level filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedLevel('all')}
              className={`btn btn-sm ${selectedLevel === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            >
              전체
            </button>
            {LEVELS.map(lvl => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`btn btn-sm ${selectedLevel === lvl ? 'btn-primary' : 'btn-ghost'}`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Topic filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedTopic('all')}
            style={{
              padding: '8px 16px',
              borderRadius: '100px',
              background: selectedTopic === 'all' ? 'var(--accent-primary)' : 'var(--bg-card)',
              border: '1px solid',
              borderColor: selectedTopic === 'all' ? 'var(--accent-primary)' : 'var(--border-subtle)',
              color: selectedTopic === 'all' ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 200ms ease',
              fontFamily: 'inherit',
            }}
          >
            전체 주제
          </button>
          {TOPICS.map(topic => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '100px',
                background: selectedTopic === topic.id ? 'var(--accent-primary)' : 'var(--bg-card)',
                border: '1px solid',
                borderColor: selectedTopic === topic.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                color: selectedTopic === topic.id ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 200ms ease',
                fontFamily: 'inherit',
              }}
            >
              {topic.emoji} {topic.label}
            </button>
          ))}
        </div>

        {/* Articles Grid */}
        {loadingArticles ? (
          <div className="loading-wrapper">
            <div className="loading-spinner" />
            <span style={{ color: 'var(--text-muted)' }}>텍스트 불러오는 중...</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">아직 텍스트가 없어요</div>
            <div className="empty-state-desc">위의 "새 텍스트 생성" 버튼으로 첫 번째 읽기 자료를 만들어보세요!</div>
            <button onClick={handleGenerate} disabled={generating} className="btn btn-primary mt-4">
              ✨ 지금 생성하기
            </button>
          </div>
        ) : (
          <div className="grid-3">
            {filteredArticles.map(article => {
              const isRead = readArticles.includes(article.id);
              const topicInfo = TOPICS.find(t => t.id === article.topicCategory);
              return (
                <Link
                  key={article.id}
                  href={`/read/${article.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="card"
                    style={{
                      height: '100%',
                      position: 'relative',
                      opacity: isRead ? 0.7 : 1,
                    }}
                  >
                    {isRead && (
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'rgba(16,185,129,0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '100px',
                        padding: '2px 10px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}>
                        ✓ 읽음
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                      <span className={`level-badge level-${article.level}`}>{article.level}</span>
                      {topicInfo && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {topicInfo.emoji} {topicInfo.label}
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {article.title}
                    </h3>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: 1.6, marginBottom: '16px' }}>
                      {article.summary}
                    </p>

                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>⏱ {article.estimatedMinutes}분</span>
                      <span>📝 {article.keyVocabulary?.length || 0}개 핵심 단어</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
