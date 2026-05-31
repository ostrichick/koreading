'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getVocabulary, VocabularyEntry } from '@/lib/db';
import { TOPICS } from '@/lib/gemini';

export default function VocabularyPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vocab, setVocab] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<VocabularyEntry | null>(null);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    getVocabulary(user.uid).then(v => {
      setVocab(v);
      setLoading(false);
    });
  }, [user, router]);

  const filteredVocab = vocab.filter(entry =>
    selectedTopic === 'all' || entry.topic === selectedTopic
  );

  const topicsWithWords = ['all', ...Array.from(new Set(vocab.map(v => v.topic)))];

  if (loading) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>📝 내 단어장</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            저장된 단어: <strong style={{ color: 'var(--text-primary)' }}>{vocab.length}개</strong>
          </p>
        </div>

        {/* Topic filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {topicsWithWords.map(topic => {
            const topicInfo = TOPICS.find(t => t.id === topic);
            const count = topic === 'all' ? vocab.length : vocab.filter(v => v.topic === topic).length;
            return (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '100px',
                  background: selectedTopic === topic ? 'var(--accent-primary)' : 'var(--bg-card)',
                  border: '1px solid',
                  borderColor: selectedTopic === topic ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  color: selectedTopic === topic ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'all 200ms ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {topicInfo ? `${topicInfo.emoji} ${topicInfo.label}` : '전체'}
                <span style={{
                  background: selectedTopic === topic ? 'rgba(255,255,255,0.2)' : 'var(--border-subtle)',
                  borderRadius: '100px',
                  padding: '1px 7px',
                  fontSize: '0.7rem',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Vocabulary Grid */}
        {filteredVocab.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-title">단어장이 비어 있어요</div>
            <div className="empty-state-desc">텍스트를 읽으면서 모르는 단어를 저장해보세요!</div>
            <a href="/library" className="btn btn-primary mt-4">도서관으로 가기</a>
          </div>
        ) : (
          <div className="grid-4" style={{ '--grid-cols': '4' } as React.CSSProperties}>
            {filteredVocab.map(entry => {
              const topicInfo = TOPICS.find(t => t.id === entry.topic);
              return (
                <div
                  key={entry.id}
                  className="card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedEntry(entry)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className={`level-badge level-${entry.level}`}>{entry.level}</span>
                    {topicInfo && (
                      <span style={{ fontSize: '1rem' }}>{topicInfo.emoji}</span>
                    )}
                  </div>

                  <div style={{
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    fontFamily: 'Noto Sans KR, sans-serif',
                    marginBottom: '6px',
                    color: 'var(--text-primary)',
                  }}>
                    {entry.word}
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    [{entry.pronunciation}]
                  </div>

                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--accent-primary)',
                    fontStyle: 'italic',
                    marginBottom: '8px',
                  }}>
                    {entry.translation}
                  </div>

                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontFamily: 'Noto Sans KR, sans-serif',
                  }}>
                    {entry.definition}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Popup */}
      {selectedEntry && (
        <div
          className="word-popup-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEntry(null); }}
        >
          <div className="word-popup">
            <div className="word-popup-header">
              <div>
                <div className="word-popup-word">{selectedEntry.word}</div>
                <div className="word-popup-pronunciation">[{selectedEntry.pronunciation}]</div>
              </div>
              <button className="word-popup-close" onClick={() => setSelectedEntry(null)}>✕</button>
            </div>

            <span className="word-popup-pos">{selectedEntry.partOfSpeech}</span>

            <div className="word-popup-section">
              <div className="word-popup-section-title">📖 한국어 정의</div>
              <div className="word-popup-definition">{selectedEntry.definition}</div>
            </div>

            <div className="word-popup-section">
              <div className="word-popup-section-title">🌐 번역</div>
              <div className="word-popup-translation">{selectedEntry.translation}</div>
            </div>

            <div className="word-popup-section">
              <div className="word-popup-section-title">📝 예문</div>
              {selectedEntry.examples?.map((ex, i) => (
                <div key={i} className="word-popup-example">
                  <div className="word-popup-example-korean">{ex.korean}</div>
                  <div className="word-popup-example-translation">{ex.translation}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
              <span className={`level-badge level-${selectedEntry.level}`}>{selectedEntry.level}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                출처: {selectedEntry.articleTitle}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
