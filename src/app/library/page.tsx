'use client';

/**
 * @file page.tsx (library)
 * @description 코레딩(Koreading) 앱의 핵심인 '도서관(Library)' 메인 화면입니다. 난이도별/주제별 학습 자료 필터링, 별점/최신순 동적 정렬, 맞춤형 텍스트 생성 모달창 호출, 그리고 공용 429 에러 해결을 위한 개인 API Key 등록 및 가이드 창을 제공합니다.
 * @why 다양한 수준의 전 세계 한국어 학습자들이 자신에게 최적화된 자료를 주도적으로 탐색 및 생성하고 학습 의지를 극대화할 수 있는 핵심 게이트웨이 역할을 수행하기 위해 존재합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TOPICS, CEFRLevel, NativeLanguage, generateArticle } from '@/lib/gemini';
import { getArticlesByLevel, getAllArticles, saveArticle, getReadArticles, createOrUpdateUser, Article } from '@/lib/db';
import { getGuestLevel, getGuestLang, setGuestLang } from '@/lib/storage';
import AlertModal from '@/components/AlertModal';

// CEFR 기반 레벨 필터 목록
const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// 각 레벨에 대한 라벨 정보 매핑
const LEVEL_LABELS: Record<CEFRLevel, string> = {
  A1: '입문 (A1)',
  A2: '초급 (A2)',
  B1: '중급 (B1)',
  B2: '중상급 (B2)',
  C1: '고급 (C1)',
  C2: '최고급 (C2)',
};

// 다국어 번역 사전 정의
const TRANSLATIONS = {
  ko: {
    newText: '✨ 새 텍스트 생성',
    cancel: '취소',
    startGen: '✨ 맞춤형 읽기 생성 시작',
    generating: '🔄 AI 텍스트 생성 중...',
    save: '💾 저장하기',
    apiKeySettings: '🔑 API Key 설정',
    apiKeyRegistered: '🔑 API Key 등록됨',
    deleteKey: '🗑️ 키 삭제',
    loginToSave: '로그인하여 단어 저장하기',
    allLevels: '전체 레벨',
    allTopics: '전체 주제',
    sortByRating: '⭐ 별점순',
    sortByNewest: '⏱️ 최신순',
    createCustomReading: '✨ 내 맞춤형 읽기 생성',
    setApiKeyTitle: '🔑 내 Gemini API Key 설정',
    generateNow: '✨ 지금 조건 선택해 생성하기',
  },
  en: {
    newText: '✨ Create New Text',
    cancel: 'Cancel',
    startGen: '✨ Start Generating Custom Reading',
    generating: '🔄 Generating AI Text...',
    save: '💾 Save',
    apiKeySettings: '🔑 API Key Settings',
    apiKeyRegistered: '🔑 API Key Registered',
    deleteKey: '🗑️ Delete Key',
    loginToSave: 'Log in to save vocabulary',
    allLevels: 'All Levels',
    allTopics: 'All Topics',
    sortByRating: '⭐ By Rating',
    sortByNewest: '⏱️ By Newest',
    createCustomReading: '✨ Create Custom Reading',
    setApiKeyTitle: '🔑 Set Gemini API Key',
    generateNow: '✨ Create custom text now',
  },
  es: {
    newText: '✨ Crear nuevo texto',
    cancel: 'Cancelar',
    startGen: '✨ Empezar a generar lectura personalizada',
    generating: '🔄 Generando texto de IA...',
    save: '💾 Guardar',
    apiKeySettings: '🔑 Configurar clave API',
    apiKeyRegistered: '🔑 Clave API registrada',
    deleteKey: '🗑️ Eliminar clave',
    loginToSave: 'Iniciar sesión para guardar vocabulario',
    allLevels: 'Todos los niveles',
    allTopics: 'Todos los temas',
    sortByRating: '⭐ Por calificación',
    sortByNewest: '⏱️ Más reciente',
    createCustomReading: '✨ Crear lectura personalizada',
    setApiKeyTitle: '🔑 Configurar clave API de Gemini',
    generateNow: '✨ Crear texto personalizado ahora',
  },
  ja: {
    newText: '✨ 新規テキスト作成',
    cancel: 'キャンセル',
    startGen: '✨ カスタム読解の作成を開始',
    generating: '🔄 AIテキスト生成中...',
    save: '💾 保存する',
    apiKeySettings: '🔑 APIキー設定',
    apiKeyRegistered: '🔑 APIキー登録済み',
    deleteKey: '🗑️ キー削除',
    loginToSave: 'ログインして単語を保存',
    allLevels: '全レベル',
    allTopics: '全トピック',
    sortByRating: '⭐ 評価順',
    sortByNewest: '⏱️ 最新順',
    createCustomReading: '✨ カスタם読解作成',
    setApiKeyTitle: '🔑 Gemini APIキー設定',
    generateNow: '✨ 条件を選択して今すぐ作成',
  },
  zh: {
    newText: '✨ 创建新文本',
    cancel: '取消',
    startGen: '✨ 开始生成自定义阅读',
    generating: '🔄 AI文本生成中...',
    save: '💾 保存',
    apiKeySettings: '🔑 设置 API Key',
    apiKeyRegistered: '🔑 API Key 已注册',
    deleteKey: '🗑️ 删除 Key',
    loginToSave: '登录以保存单词',
    allLevels: '所有级别',
    allTopics: '所有主题',
    sortByRating: '⭐ 按评分',
    sortByNewest: '⏱️ 按最新',
    createCustomReading: '✨ 创建自定义阅读',
    setApiKeyTitle: '🔑 设置 Gemini API Key',
    generateNow: '✨ 立即选择条件生成',
  }
};

export default function LibraryPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  // 도서관 필터링용 상태들
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | 'all'>('all'); // 현재 조회 선택된 레벨
  const [selectedTopic, setSelectedTopic] = useState<string>('all');           // 현재 조회 선택된 토픽
  const [articles, setArticles] = useState<Article[]>([]);                      // 도서관 기사 리스트
  const [readArticles, setReadArticles] = useState<string[]>([]);              // 유저가 다 읽은 기사 ID 배열
  const [loadingArticles, setLoadingArticles] = useState(false);               // 기사 목록 로딩 토글
  const articleCacheRef = useRef<Record<string, Article[]>>({});               // 레벨별 아티클 캐시 Ref
  const [generating, setGenerating] = useState(false);                         // AI 기사 생성 대기 토글
  const [genLogs, setGenLogs] = useState<string[]>([]);                        // AI 생성 중 로그 출력 내용
  const [userLevel, setUserLevel] = useState<CEFRLevel | null>(null);          // 로그인 유저의 레벨 정보

  // 정렬 순서 상태값 ('rating': 별점 높은 순, 'newest': 최신순)
  const [sortBy, setSortBy] = useState<'rating' | 'newest'>('rating');

  // "새 텍스트 생성" 모달 내의 체크박스 상태들
  const [showGenModal, setShowGenModal] = useState(false);
  const [genLevels, setGenLevels] = useState<CEFRLevel[]>([]);
  const [genTopics, setGenTopics] = useState<string[]>([]);

  // 알림 모달 제어 상태들
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

  // 개인 API Key 설정용 상태들
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  // 모국어 번역 설정 (게스트용)
  const LANG_OPTIONS: { value: NativeLanguage; label: string; flag: string }[] = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'es', label: 'Español', flag: '🇪🇸' },
    { value: 'ja', label: '日本語', flag: '🇯🇵' },
    { value: 'zh', label: '中文', flag: '🇨🇳' },
  ];
  const [currentLang, setCurrentLang] = useState<NativeLanguage>('en');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // 컴포넌트 마운트 시, 브라우저 로컬 저장소로부터 개인 API Key 유무 판별 및 모국어 정보 동기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('koreading_custom_api_key');
      setHasApiKey(!!key);
      if (key) setTempApiKey(key);
      
      const savedLang = profile?.nativeLanguage || getGuestLang();
      setCurrentLang(savedLang);
    }
  }, [profile]);

  // 사용자가 개인 API Key를 설정하고 저장할 때 실행되는 핸들러
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

  // 유저의 학습 레벨 진단 여부를 확인하고, 이력이 없다면 레벨 테스트(/test) 페이지로 즉시 강제 포워딩합니다.
  useEffect(() => {
    const level = profile?.level || getGuestLevel();
    if (!level) {
      router.push('/test');
      return;
    }
    setUserLevel(level);

    // AI 생성기 팝업 창 내의 기본 레벨/주제 선택 기본값을 복원합니다.
    if (typeof window !== 'undefined') {
      const savedLevelsJson = localStorage.getItem('koreading_gen_levels');
      const savedTopicsJson = localStorage.getItem('koreading_gen_topics');
      
      if (savedLevelsJson) {
        try {
          setGenLevels(JSON.parse(savedLevelsJson));
        } catch {
          setGenLevels([level]);
        }
      } else {
        setGenLevels([level]);
      }
      
      if (savedTopicsJson) {
        try {
          setGenTopics(JSON.parse(savedTopicsJson));
        } catch {
          setGenTopics([]);
        }
      } else {
        setGenTopics([]);
      }
    }
  }, [profile, router]);

  // Firestore DB로부터 해당 레벨의 아티클 목록을 쿼리하고 정렬 순서에 맞게 세팅하는 헬퍼 함수
  const loadArticles = useCallback(async (level: CEFRLevel | 'all', currentSort: 'rating' | 'newest') => {
    setLoadingArticles(true);
    try {
      let all: Article[] = [];
      const cacheKey = level;
      if (articleCacheRef.current[cacheKey]) {
        all = articleCacheRef.current[cacheKey];
      } else {
        if (level === 'all') {
          all = await getAllArticles();
        } else {
          all = await getArticlesByLevel(level);
        }
        articleCacheRef.current[cacheKey] = all;
      }

      // 평점 정렬(별점 동일 시 최신순) 또는 최신 생성 시간 정렬 적용
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

  // 레벨 조건 및 정렬 방식 변경 감지 시 도서관 목록 갱신
  useEffect(() => {
    loadArticles(selectedLevel, sortBy);
  }, [selectedLevel, sortBy, loadArticles]);

  // 로그인 회원일 경우 읽은 아티클 목록 갱신
  useEffect(() => {
    if (user) {
      getReadArticles(user.uid).then(setReadArticles);
    }
  }, [user]);

  // AI 텍스트 생성 버튼 클릭 이벤트 핸들러
  const handleGenerate = async () => {
    if (genLevels.length === 0) {
      triggerAlert('최소 한 개의 레벨을 선택해 주세요!', '조건 선택', 'warning');
      return;
    }
    if (genTopics.length === 0) {
      triggerAlert('최소 한 개의 주제를 선택해 주세요!', '조건 선택', 'warning');
      return;
    }

    // 선택된 복수 난이도 및 복수 주제 중 하나씩 무작위 선택(Random Selection)하여 AI에 생성 요청
    const level = genLevels[Math.floor(Math.random() * genLevels.length)];
    const topic = genTopics[Math.floor(Math.random() * genTopics.length)];
    const lang = currentLang;

    setGenerating(true);
    setGenLogs([]);
    try {
      // client wrapper function 호출 (진행 로그 콜백 연동)
      const data = await generateArticle(level, topic, lang, (logMsg) => {
        setGenLogs(prev => [...prev, logMsg]);
      });
      
      try {
        // Firestore 아티클 저장
        const id = await saveArticle(data);
        articleCacheRef.current = {}; // 새 아티클이 생성되었으므로 캐시 초기화
        setShowGenModal(false);
        setGenLogs([]);
        router.push(`/read/${id}`); // 완료 시 회원용 독해로 포워딩
      } catch (dbErr: any) {
        console.warn('Firestore 저장 실패, 임시 로컬 저장소로 백업합니다:', dbErr);
        
        // Firestore 권한이 모자랄 경우 (비로그인, 혹은 DB 규칙 상 미인증 시) 게스트 로컬 세션에 보관
        sessionStorage.setItem('koreading_guest_article', JSON.stringify({ ...data, id: 'guest' }));
        setShowGenModal(false);
        setGenLogs([]);
        
        triggerAlert(
          'ℹ️ Firebase Database 권한 설정(Missing or insufficient permissions)으로 인해 도서관에 저장되지 못했습니다.\n\n걱정 마세요! 생성된 글은 임시 페이지에 로드되므로 지금 바로 읽으실 수 있습니다.\n\n(영구 저장하여 공유하시려면 Google 로그인 후 글을 생성하시거나, Firebase 콘솔의 Firestore 규칙에서 articles 컬렉션의 write 권한을 허용 [allow read, write: if true;]해 주세요!)',
          '데이터베이스 권한 오류',
          'warning'
        );
        
        router.push('/read/guest'); // 게스트용 임시 독해로 포워딩
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || JSON.stringify(err);
      const serverLogs: string[] = err?._logs || [];
      const isQuotaError = errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('quota') || errMsg.includes('limit');
      const is503Error = errMsg.includes('503') || errMsg.includes('과부하') || errMsg.includes('high demand');
      
      // 폴백 체인 수행 로그 정리
      const logBlock = serverLogs.length > 0
        ? '\n\n───── 📡 AI 엔진 시도 로그 ─────\n' + serverLogs.join('\n')
        : '';

      let helpfulGuide: string;
      if (isQuotaError) {
        helpfulGuide = `🚨 [API 쿼터 제한 초과 에러]\n\n현재 서버의 무료 Gemini API 키 할당량이 전부 소진되었습니다.\n\n💡 해결 방법:\n도서관 화면 상단의 [🔑 API Key 설정] 버튼을 눌러 본인의 무료 Gemini API Key를 등록하시면, 즉시 대기 시간 없이 무제한으로 학습 자료를 평생 무료 생성하고 즐기실 수 있습니다!${logBlock}`;
      } else if (is503Error) {
        helpfulGuide = `⏳ [서버 과부하 에러]\n\nAI 서버(Groq 3종 + Gemini 5종, 총 8개 모델)를 모두 시도했으나 전부 과부하 상태입니다.\n\n💡 해결 방법:\n• 1~2분 후 다시 시도해 보세요 (일시적 현상)\n• 도서관 상단의 [🔑 API Key 설정]에서 본인의 Gemini API Key를 등록하면 개인 쿼터를 사용하므로 성공률이 크게 높아집니다!${logBlock}`;
      } else {
        helpfulGuide = `텍스트 생성에 실패했습니다: ${errMsg}${logBlock}`;
      }
      
      triggerAlert(helpfulGuide, '텍스트 생성 실패', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 모달 생성 시 레벨 체크박스 선택 제어
  const toggleLevelCheckbox = (lvl: CEFRLevel) => {
    setGenLevels(prev => {
      const next = prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl];
      if (typeof window !== 'undefined') {
        localStorage.setItem('koreading_gen_levels', JSON.stringify(next));
      }
      return next;
    });
  };

  // 모달 생성 시 주제 체크박스 선택 제어
  const toggleTopicCheckbox = (id: string) => {
    setGenTopics(prev => {
      const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem('koreading_gen_topics', JSON.stringify(next));
      }
      return next;
    });
  };

  // 난이도 및 토픽 조건 기반 최종 필터링된 기사 목록
  const filteredArticles = articles.filter(a => {
    const matchLevel = selectedLevel === 'all' || a.level === selectedLevel;
    const matchTopic = selectedTopic === 'all' || a.topicCategory === selectedTopic;
    return matchLevel && matchTopic;
  });

  const isGuest = !user;

  // 사용자의 로그인 여부 및 레벨에 따른 UI 언어 선택
  const getUiLang = (): 'en' | 'es' | 'ja' | 'zh' | 'ko' => {
    if (!user) return currentLang; // 비로그인은 모국어 설정에 맞게
    if (userLevel && ['C1', 'C2'].includes(userLevel)) {
      return 'ko'; // C1, C2 레벨은 한국어로
    }
    return currentLang; // A1, A2, B1, B2 레벨은 설정한 언어로
  };

  const uiLang = getUiLang();
  const t = TRANSLATIONS[uiLang];

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container">
        {/* 상단 타이틀 영역 (내 정보 및 레벨 배지 드로잉) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>📚 도서관</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              내 레벨:{' '}
              {userLevel && <span className={`level-badge level-${userLevel}`}>{userLevel}</span>}
              {isGuest && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>· 게스트 모드</span>}
            </p>
          </div>
          
          {/* 우측 상단 유저 행동 단추 그룹 (언어 선택, API Key 설정, 신규 생성) */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* 다국어 번역 언어 선택 드롭다운 버튼 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="btn btn-ghost"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '100px',
                  padding: '8px 14px',
                }}
              >
                {LANG_OPTIONS.find(l => l.value === currentLang)?.flag} {LANG_OPTIONS.find(l => l.value === currentLang)?.label}
                <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
              </button>
              {showLangDropdown && (
                <>
                  <div onClick={() => setShowLangDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px',
                    zIndex: 100,
                    minWidth: '160px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  }}>
                    {LANG_OPTIONS.map(lang => (
                      <button
                        key={lang.value}
                        onClick={async () => {
                          setCurrentLang(lang.value);
                          setGuestLang(lang.value);
                          if (user) {
                            try {
                              await createOrUpdateUser(user.uid, { nativeLanguage: lang.value });
                              await refreshProfile();
                            } catch (err) {
                              console.error('Failed to update user language in Firestore:', err);
                            }
                          }
                          setShowLangDropdown(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          background: currentLang === lang.value ? 'rgba(99,102,241,0.15)' : 'transparent',
                          color: currentLang === lang.value ? 'var(--accent-primary)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: currentLang === lang.value ? 700 : 500,
                          transition: 'all 150ms ease',
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{lang.flag}</span>
                        {lang.label}
                        {currentLang === lang.value && <span style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* 개인 API 키 등록 버튼 */}
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
              {hasApiKey ? t.apiKeyRegistered : t.apiKeySettings}
            </button>

            {/* 새 텍스트 임시 생성 단추 (테스트 E2E용 generate-article-btn ID 바인딩) */}
            <button id="generate-article-btn" onClick={() => setShowGenModal(true)} disabled={generating} className="btn btn-primary">
              {t.newText}
            </button>
          </div>
        </div>

        {/* 비로그인 방문자 안내 카드 배너 */}
        {isGuest && (
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              🔓 게스트 모드 — 생성된 모든 텍스트는 도서관에 평생 기록되어 함께 공부하게 됩니다!
            </div>
            <a href="/login" className="btn btn-sm btn-primary">{t.loginToSave}</a>
          </div>
        )}

        {/* 정렬 바 및 레벨 필터 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          {/* 난이도 필터 버튼 그룹 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedLevel('all')} className={`btn btn-sm ${selectedLevel === 'all' ? 'btn-primary' : 'btn-ghost'}`}>{t.allLevels}</button>
            {LEVELS.map(lvl => (
              <button key={lvl} onClick={() => setSelectedLevel(lvl)} className={`btn btn-sm ${selectedLevel === lvl ? 'btn-primary' : 'btn-ghost'}`}>{lvl}</button>
            ))}
          </div>

          {/* 평점 및 최신 작성순 정렬 전환 단추 */}
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
              {t.sortByRating}
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
              {t.sortByNewest}
            </button>
          </div>
        </div>

        {/* 8대 주제 선택 필터 뱃지 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedTopic('all')} style={{ padding: '8px 16px', borderRadius: '100px', background: selectedTopic === 'all' ? 'var(--accent-primary)' : 'var(--bg-card)', border: '1px solid', borderColor: selectedTopic === 'all' ? 'var(--accent-primary)' : 'var(--border-subtle)', color: selectedTopic === 'all' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 200ms ease', fontFamily: 'inherit' }}>{t.allTopics}</button>
          {TOPICS.map(topic => (
            <button key={topic.id} onClick={() => setSelectedTopic(topic.id)} style={{ padding: '8px 16px', borderRadius: '100px', background: selectedTopic === topic.id ? 'var(--accent-primary)' : 'var(--bg-card)', border: '1px solid', borderColor: selectedTopic === topic.id ? 'var(--accent-primary)' : 'var(--border-subtle)', color: selectedTopic === topic.id ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 200ms ease', fontFamily: 'inherit' }}>
              {topic.emoji} {topic.label}
            </button>
          ))}
        </div>

        {/* 아티클 로딩 스켈레톤 및 조회 리스트 그리드 */}
        {loadingArticles ? (
          <div className="loading-wrapper"><div className="loading-spinner" /><span style={{ color: 'var(--text-muted)' }}>텍스트 불러오는 중...</span></div>
        ) : filteredArticles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">해당하는 텍스트가 아직 없어요</div>
            <div className="empty-state-desc">"{t.newText}" 버튼을 눌러 첫 번째 읽기 자료를 만들어보세요!</div>
            <button onClick={() => setShowGenModal(true)} className="btn btn-primary mt-4">{t.generateNow}</button>
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
                      <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '100px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>✓ 읽음</div>
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

      {/* 맞춤형 아티클 생성 설정 팝업 모달 */}
      {showGenModal && (
        <div className="word-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGenModal(false); }}>
          <div className="word-popup" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="word-popup-header">
              <div className="word-popup-word" style={{ fontSize: '1.25rem' }}>{t.createCustomReading}</div>
              <button className="word-popup-close" onClick={() => setShowGenModal(false)}>✕</button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: 1.5 }}>
              체크박스로 레벨과 주제를 원하는 대로 선택하세요. 선택된 조건 내에서 무작위 조합으로 AI 맞춤 텍스트가 즉시 생성되며, 생성된 자료는 도서관에 보존됩니다.
            </p>

            {/* 레벨 선택 다중 조건 토픽 목록 */}
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

            {/* 토픽 선택 다중 조건 목록 */}
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

            {/* 📡 실시간 AI 백그라운드 폴백 상태 로그 패널 */}
            {generating && (
              <div style={{
                marginBottom: '16px',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
                fontSize: '0.75rem',
                lineHeight: 1.8,
              }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '6px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>📡 AI 엔진 연결 로그</div>
                {genLogs.length > 0 ? (
                  /* 모델 전환 및 성공 여부 로그 실시간 리스트업 */
                  genLogs.map((log, i) => (
                    <div key={i} style={{
                      color: log.includes('✅') ? '#10b981'
                           : log.includes('❌') || log.includes('💀') ? '#ef4444'
                           : log.includes('⚠️') ? '#f59e0b'
                           : log.includes('⏳') ? '#818cf8'
                           : 'var(--text-secondary)',
                      padding: '1px 0',
                    }}>
                      {log}
                    </div>
                  ))
                ) : (
                  /* 최초 요청 전달 중: 고장 우려 경감을 위한 로딩 메시지 표출 */
                  <div>
                    <div style={{ color: '#818cf8', padding: '1px 0' }}>⚡ Groq + Gemini 총 8개 AI 모델 폴백 체인 가동 중...</div>
                    <div style={{ color: 'var(--text-secondary)', padding: '1px 0' }}>🔄 Groq Gemma 2 → Llama 3.3 → Llama 3.1</div>
                    <div style={{ color: 'var(--text-secondary)', padding: '1px 0' }}>🔄 Gemini 2.5 → 2.0 → 1.5 → Lite → 8B</div>
                    <div style={{ color: 'var(--text-muted)', padding: '1px 0', fontSize: '0.7rem', marginTop: '4px' }}>서버 과부하 시 자동으로 다음 모델로 전환됩니다</div>
                  </div>
                )}
                <div style={{ color: 'var(--accent-primary)', animation: 'pulse 1.5s ease-in-out infinite' }}>▍</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setShowGenModal(false); setGenLogs([]); }}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={generating}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || genLevels.length === 0 || genTopics.length === 0}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {generating ? t.generating : t.startGen}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 개인 구글 Gemini API Key 입력용 모달 */}
      {showApiKeyModal && (
        <div className="word-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowApiKeyModal(false); }}>
          <div className="word-popup" style={{ maxWidth: '500px', width: '90%', userSelect: 'text' }}>
            <div className="word-popup-header">
              <div className="word-popup-word" style={{ fontSize: '1.25rem' }}>{t.setApiKeyTitle}</div>
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
                  {t.deleteKey}
                </button>
              )}
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!tempApiKey.trim()}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공통 에러/알림창 모달 */}
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
