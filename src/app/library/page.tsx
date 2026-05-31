'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TOPICS, CEFRLevel, generateArticle } from '@/lib/gemini';
import { getArticlesByLevel, saveArticle, getReadArticles, Article } from '@/lib/db';
import { getGuestLevel, getGuestLang } from '@/lib/storage';
import AlertModal from '@/components/AlertModal';

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_LABELS: Record<CEFRLevel, string> = {
  A1: '입문 (A1)',
  A2: '초급 (A2)',
  B1: '중급 (B1)',
  B2: '중상급 (B2)',
  C1: '고급 (C1)',
  C2: '최고급 (C2)',
};

export default function LibraryPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | 'all'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [articles, setArticles] = useState<Article[]>([]);
  const [readArticles, setReadArticles] = useState<string[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [userLevel, setUserLevel] = useState<CEFRLevel | null>(null);

  // Sorting state
  const [sortBy, setSortBy] = useState<'rating' | 'newest'>('rating');

  // Generation Modal States
  const [showGenModal, setShowGenModal] = useState(false);
  const [genLevels, setGenLevels] = useState<CEFRLevel[]>([]);
  const [genTopics, setGenTopics] = useState<string[]>([]);

  // Alert Modal States
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('알림');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'error' | 'warning' | 'success'>('info');

  const triggerAlert = (message: string, title = '알림', type: 'info' | 'error' | 'warning' | 'success' = 'info') => {
    setAlertTitle(title);
    setAlertMsg(message);
    setAlertType(type);
    setAlertOpen(true);
  };

  // Custom API Key States
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('koreading_custom_api_key');
      setHasApiKey(!!key);
      if (key) setTempApiKey(key);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (typeof window !== 'undefined') {
      const trimmed = tempApiKey.trim();
      if (trimmed) {
        localStorage.setItem('koreading_custom_api_key', trimmed);
        setHasApiKey(true);
        triggerAlert('Gemini API Key가 성공적으로 브라우저 로컬 저장소에 등록되었습니다! 이제 일일 20회 제한 없이 무제한으로 사용하실 수 있습니다.', '등록 완료', 'success');
      } else {
        localStorage.removeItem('koreading_custom_api_key');
        setHasApiKey(false);
        triggerAlert('Gemini API Key가 삭제되었습니다. 이제 서버 공용 Key를 사용합니다.', '삭제 완료', 'info');
      }
      setShowApiKeyModal(false);
    }
  };

  useEffect(() => {
    const level = profile?.level || getGuestLevel();
    if (!level) {
      router.push('/test');
      return;
    }
    setUserLevel(level);
    // Initialize checked levels for generation to the user's current level
    setGenLevels([level]);
    // Initialize checked topics for generation to all topics
    setGenTopics(TOPICS.map(t => t.id));
  }, [profile, router]);

  const loadArticles = useCallback(async (level: CEFRLevel | 'all', currentSort: 'rating' | 'newest') => {
    setLoadingArticles(true);
    try {
      let all: Article[] = [];
      if (level === 'all') {
        const results = await Promise.all(LEVELS.map(l => getArticlesByLevel(l)));
        all = results.flat();
      } else {
        all = await getArticlesByLevel(level);
      }

      // Sort
      const sorted = [...all];
      if (currentSort === 'rating') {
        sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      } else {
        sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      }

      setArticles(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  useEffect(() => {
    loadArticles(selectedLevel, sortBy);
  }, [selectedLevel, sortBy, loadArticles]);

  useEffect(() => {
    if (user) {
      getReadArticles(user.uid).then(setReadArticles);
    }
  }, [user]);

  const handleGenerate = async () => {
    if (genLevels.length === 0) {
      triggerAlert('최소 한 개의 레벨을 선택해 주세요!', '조건 선택', 'warning');
      return;
    }
    if (genTopics.length === 0) {
      triggerAlert('최소 한 개의 주제를 선택해 주세요!', '조건 선택', 'warning');
      return;
    }

    // Randomly pick a level and topic from Checked options
    const level = genLevels[Math.floor(Math.random() * genLevels.length)];
    const topic = genTopics[Math.floor(Math.random() * genTopics.length)];
    const lang = profile?.nativeLanguage || getGuestLang();

    setGenerating(true);
    try {
      const data = await generateArticle(level, topic, lang);
      
      try {
        // Try saving to Firestore persistently so all readers can see it
        const id = await saveArticle(data);
        setShowGenModal(false);
        router.push(`/read/${id}`);
      } catch (dbErr: any) {
        console.warn('Firestore save failed, falling back to local guest storage:', dbErr);
        // Save locally to sessionStorage for fallback guest reading
        sessionStorage.setItem('koreading_guest_article', JSON.stringify({ ...data, id: 'guest' }));
        setShowGenModal(false);
        
        // Show a helpful warning explaining the Firebase rule constraint and how to fix it
        triggerAlert(
          'ℹ️ Firebase Database 권한 설정(Missing or insufficient permissions)으로 인해 도서관에 저장되지 못했습니다.\n\n걱정 마세요! 생성된 글은 임시 페이지에 로드되므로 지금 바로 읽으실 수 있습니다.\n\n(영구 저장하여 공유하시려면 Google 로그인 후 글을 생성하시거나, Firebase 콘솔의 Firestore 규칙에서 articles 컬렉션의 write 권한을 허용 [allow read, write: if true;]해 주세요!)',
          '데이터베이스 권한 오류',
          'warning'
        );
        
        router.push('/read/guest');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || JSON.stringify(err);
      const isQuotaError = errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('quota') || errMsg.includes('limit');
      
      const helpfulGuide = isQuotaError 
        ? `🚨 [API 쿼터 제한 초과 에러]\n\n현재 서버의 무료 Gemini API 키 할당량이 전부 소진되었습니다.\n\n💡 해결 방법:\n도서관 화면 상단의 [🔑 API Key 설정] 버튼을 눌러 본인의 무료 Gemini API Key를 등록하시면, 즉시 대기 시간 없이 무제한으로 학습 자료를 평생 무료 생성하고 즐기실 수 있습니다!\n\n-----------------------------------\n\n[상세 오류 로그]:\n${errMsg}`
        : `텍스트 생성에 실패했습니다: ${errMsg}`;
      
      triggerAlert(helpfulGuide, '텍스트 생성 실패', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const toggleLevelCheckbox = (lvl: CEFRLevel) => {
    setGenLevels(prev =>
      prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]
    );
  };

  const toggleTopicCheckbox = (id: string) => {
    setGenTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const filteredArticles = articles.filter(a => {
    const matchLevel = selectedLevel === 'all' || a.level === selectedLevel;
    const matchTopic = selectedTopic === 'all' || a.topicCategory === selectedTopic;
    return matchLevel && matchTopic;
  });

  const isGuest = !user;

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>📚 도서관</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              내 레벨:{' '}
              {userLevel && <span className={`level-badge level-${userLevel}`}>{userLevel}</span>}
              {isGuest && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>· 게스트 모드</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="btn btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '100px',
                padding: '8px 16px',
              }}
            >
              {hasApiKey ? '🔑 API Key 등록됨' : '🔑 API Key 설정'}
            </button>
            <button id="generate-article-btn" onClick={() => setShowGenModal(true)} disabled={generating} className="btn btn-primary">
              ✨ 새 텍스트 생성
            </button>
          </div>
        </div>

        {/* Guest banner */}
        {isGuest && (
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              🔓 게스트 모드 — 생성된 모든 텍스트는 도서관에 평생 기록되어 함께 공부하게 됩니다!
            </div>
            <a href="/login" className="btn btn-sm btn-primary">로그인하여 단어 저장하기</a>
          </div>
        )}

        {/* Sort and Filter Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          {/* Level Filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedLevel('all')} className={`btn btn-sm ${selectedLevel === 'all' ? 'btn-primary' : 'btn-ghost'}`}>전체 레벨</button>
            {LEVELS.map(lvl => (
              <button key={lvl} onClick={() => setSelectedLevel(lvl)} className={`btn btn-sm ${selectedLevel === lvl ? 'btn-primary' : 'btn-ghost'}`}>{lvl}</button>
            ))}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '100px', padding: '3px' }}>
            <button
              onClick={() => setSortBy('rating')}
              style={{
                padding: '6px 16px',
                borderRadius: '100px',
                background: sortBy === 'rating' ? 'var(--accent-primary)' : 'transparent',
                color: sortBy === 'rating' ? 'white' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 200ms ease',
                fontFamily: 'inherit',
              }}
            >
              ⭐ 별점순
            </button>
            <button
              onClick={() => setSortBy('newest')}
              style={{
                padding: '6px 16px',
                borderRadius: '100px',
                background: sortBy === 'newest' ? 'var(--accent-primary)' : 'transparent',
                color: sortBy === 'newest' ? 'white' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 200ms ease',
                fontFamily: 'inherit',
              }}
            >
              ⏱️ 최신순
            </button>
          </div>
        </div>

        {/* Topic Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedTopic('all')} style={{ padding: '8px 16px', borderRadius: '100px', background: selectedTopic === 'all' ? 'var(--accent-primary)' : 'var(--bg-card)', border: '1px solid', borderColor: selectedTopic === 'all' ? 'var(--accent-primary)' : 'var(--border-subtle)', color: selectedTopic === 'all' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 200ms ease', fontFamily: 'inherit' }}>전체 주제</button>
          {TOPICS.map(topic => (
            <button key={topic.id} onClick={() => setSelectedTopic(topic.id)} style={{ padding: '8px 16px', borderRadius: '100px', background: selectedTopic === topic.id ? 'var(--accent-primary)' : 'var(--bg-card)', border: '1px solid', borderColor: selectedTopic === topic.id ? 'var(--accent-primary)' : 'var(--border-subtle)', color: selectedTopic === topic.id ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 200ms ease', fontFamily: 'inherit' }}>
              {topic.emoji} {topic.label}
            </button>
          ))}
        </div>

        {/* Articles List */}
        {loadingArticles ? (
          <div className="loading-wrapper"><div className="loading-spinner" /><span style={{ color: 'var(--text-muted)' }}>텍스트 불러오는 중...</span></div>
        ) : filteredArticles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">해당하는 텍스트가 아직 없어요</div>
            <div className="empty-state-desc">"✨ 새 텍스트 생성" 버튼을 눌러 첫 번째 읽기 자료를 만들어보세요!</div>
            <button onClick={() => setShowGenModal(true)} className="btn btn-primary mt-4">✨ 지금 조건 선택해 생성하기</button>
          </div>
        ) : (
          <div className="grid-3">
            {filteredArticles.map(article => {
              const isRead = readArticles.includes(article.id);
              const topicInfo = TOPICS.find(t => t.id === article.topicCategory);
              return (
                <a key={article.id} href={`/read/${article.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ height: '100%', position: 'relative', opacity: isRead ? 0.7 : 1 }}>
                    {isRead && (
                      <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '100px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700 }}>✓ 읽음</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                      <span className={`level-badge level-${article.level}`}>{article.level}</span>
                      {topicInfo && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{topicInfo.emoji} {topicInfo.label}</span>}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', fontFamily: 'Noto Sans KR, sans-serif' }}>{article.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: 1.6, marginBottom: '16px' }}>{article.summary}</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span>⏱ {article.estimatedMinutes}분</span>
                        <span>📝 {article.keyVocabulary?.length || 0}개 단어</span>
                      </div>
                      {article.averageRating ? (
                        <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                          ★ {article.averageRating}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>평가 없음</span>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Generation Custom Conditions Modal */}
      {showGenModal && (
        <div className="word-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGenModal(false); }}>
          <div className="word-popup" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="word-popup-header">
              <div className="word-popup-word" style={{ fontSize: '1.25rem' }}>✨ 내 맞춤형 읽기 생성</div>
              <button className="word-popup-close" onClick={() => setShowGenModal(false)}>✕</button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: 1.5 }}>
              체크박스로 레벨과 주제를 원하는 대로 선택하세요. 선택된 조건 내에서 무작위 조합으로 AI 맞춤 텍스트가 즉시 생성되며, 생성된 자료는 도서관에 보존됩니다.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                📶 레벨 선택 (다중 선택 가능)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {LEVELS.map(lvl => {
                  const checked = genLevels.includes(lvl);
                  return (
                    <label
                      key={lvl}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: checked ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                        border: '1px solid',
                        borderColor: checked ? 'var(--accent-primary)' : 'var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        transition: 'all 150ms ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLevelCheckbox(lvl)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                      />
                      <span>{LEVEL_LABELS[lvl]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                🏷️ 주제 선택 (다중 선택 가능)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {TOPICS.map(topic => {
                  const checked = genTopics.includes(topic.id);
                  return (
                    <label
                      key={topic.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: checked ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                        border: '1px solid',
                        borderColor: checked ? 'var(--accent-primary)' : 'var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        transition: 'all 150ms ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTopicCheckbox(topic.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                      />
                      <span>{topic.emoji} {topic.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowGenModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                취소
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || genLevels.length === 0 || genTopics.length === 0}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {generating ? 'AI 텍스트 생성 중...' : '✨ 맞춤형 읽기 생성 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom API Key Configuration Modal */}
      {showApiKeyModal && (
        <div className="word-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowApiKeyModal(false); }}>
          <div className="word-popup" style={{ maxWidth: '500px', width: '90%', userSelect: 'text' }}>
            <div className="word-popup-header">
              <div className="word-popup-word" style={{ fontSize: '1.25rem' }}>🔑 내 Gemini API Key 설정</div>
              <button className="word-popup-close" onClick={() => setShowApiKeyModal(false)}>✕</button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.6 }}>
              무료 쿼터 초과 에러(429)를 우회하여 대기 시간 없이 평생 무제한으로 텍스트를 생성하시려면, 본인의 개인 Gemini API Key를 등록해 주세요. 입력된 키는 본인의 브라우저 로컬 저장소(localStorage)에만 안전하게 보관됩니다.
            </p>

            <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              💡 <strong>API Key 발급 방법 (1분 소요)</strong>:<br />
              1. <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'underline' }}>Google AI Studio</a>에 접속하여 로그인합니다.<br />
              2. <strong>'Get API Key'</strong> 버튼을 클릭하여 새로운 무료 키를 발급받은 뒤 복사하여 아래에 붙여넣어 주세요!
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Gemini API Key
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={e => setTempApiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
              />
              {hasApiKey && (
                <p style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '6px', fontWeight: 600 }}>
                  ✓ 현재 브라우저에 API Key가 안전하게 등록된 상태입니다.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {hasApiKey && (
                <button
                  onClick={() => {
                    setTempApiKey('');
                    localStorage.removeItem('koreading_custom_api_key');
                    setHasApiKey(false);
                    triggerAlert('Gemini API Key가 안전하게 삭제되었습니다. 이제 서버 공용 Key를 사용합니다.', '삭제 완료', 'info');
                    setShowApiKeyModal(false);
                  }}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: 'rgba(239,68,68,0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                >
                  🗑️ 키 삭제
                </button>
              )}
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                취소
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!tempApiKey.trim()}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                💾 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert/Error Modal */}
      <AlertModal
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMsg}
        type={alertType}
        onClose={() => setAlertOpen(false)}
      />
    </div>
  );
}
