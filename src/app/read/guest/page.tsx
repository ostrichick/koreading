'use client';

/**
 * @file page.tsx (read/guest)
 * @description 비로그인 게스트 사용자가 방금 임시 생성한 맞춤형 한국어 텍스트를 읽고 인터랙티브 사전을 활용하는 '게스트 전용 본문 독해 화면'입니다. 회원이 아니어도 초광속 2단계 점진적 사전 조회(Double-Stage Progressive Lookup), iOS 스타일 마우스 오버 즉시 검색, 다 읽은 후 자동 가입 권유 모달 등을 제공합니다.
 * @why 신규 유저가 복잡한 구글 로그인이나 가입 절차 없이도 코레딩의 초속 독해 및 사전 조회의 매끄러움을 온전히 경험하고 자연스럽게 정식 회원으로 유입되게 돕는 강력한 랜딩 버퍼로 작동하기 위해 존재합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TOPICS } from '@/lib/gemini';
import { getGuestArticle, getGuestLang, getGuestLevel, incrementGuestReadCount } from '@/lib/storage';
import { saveVocabulary, getCustomCategories } from '@/lib/db';
import ArticleIllustration from '@/components/ArticleIllustration';
import { isKoreanWord } from '@/lib/utils';
import { useWordLookup } from '@/hooks/useWordLookup';
import ReaderBody from '@/components/reader/ReaderBody';
import TutorPanel, { type TutorSelection } from '@/components/reader/TutorPanel';
import { articleSummary } from '@/lib/learning';

// 단어 상세 사전 데이터를 보관할 인터페이스 정의
// 다국어 번역 사전 정의
const TRANSLATIONS = {
  ko: {
    deleteArticle: '🗑️ 텍스트 삭제 (품질 저하)',
    toLibrary: '← 도서관으로',
    doneReading: '✅ 다 읽었어요!',
    save: '📚 저장',
    login: '🔑 로그인',
    details: '🔍 자세히',
    saveToVocab: '📚 단어장에 저장',
    loginToVocab: '🔑 로그인하여 단어장에 저장',
    tutorTitle: '💬 1:1 AI 튜터',
    tutorPlaceholder: '질문을 입력하세요...',
    tutorIntro: '이 문단에 대해 궁금한 점을 질문해 보세요.',
    qTranslate: '이 문단 전체 번역해 줘',
    qGrammar: '주요 문법 표현 정리해 줘',
    qVocab: '주요 단어와 품사를 알려줘',
    qNuance: '이 문단의 자연스러운 뉘앙스가 뭐야?',
  },
  en: {
    deleteArticle: '🗑️ Delete Text (Low Quality)',
    toLibrary: '← To Library',
    doneReading: '✅ Done Reading!',
    save: '📚 Save',
    login: '🔑 Log In',
    details: '🔍 Details',
    saveToVocab: '📚 Save to Vocabulary',
    loginToVocab: '🔑 Log In to Save',
    tutorTitle: '💬 1:1 AI Tutor',
    tutorPlaceholder: 'Type your question...',
    tutorIntro: 'Ask any questions about this paragraph.',
    qTranslate: 'Translate this paragraph',
    qGrammar: 'Explain key grammar points',
    qVocab: 'Show key vocabulary & parts of speech',
    qNuance: 'What is the natural nuance here?',
  },
  es: {
    deleteArticle: '🗑️ Eliminar texto (Baja calidad)',
    toLibrary: '← A la biblioteca',
    doneReading: '✅ ¡Terminé de leer!',
    save: '📚 Guardar',
    login: '🔑 Iniciar sesión',
    details: '🔍 Detalles',
    saveToVocab: '📚 Guardar en vocabulario',
    loginToVocab: '🔑 Iniciar sesión para guardar',
    tutorTitle: '💬 Tutor de IA 1:1',
    tutorPlaceholder: 'Escribe tu pregunta...',
    tutorIntro: 'Haz cualquier pregunta sobre este párrafo.',
    qTranslate: 'Traduce este párrafo',
    qGrammar: 'Explica los puntos gramaticales clave',
    qVocab: 'Muestra vocabulario clave y categorías gramaticales',
    qNuance: '¿Cuál es el matiz natural aquí?',
  },
  ja: {
    deleteArticle: '🗑️ テキスト削除 (品質低下)',
    toLibrary: '← 図書館へ',
    doneReading: '✅ 読み終えました！',
    save: '📚 保存',
    login: '🔑 ログイン',
    details: '🔍 詳細',
    saveToVocab: '📚 単語帳に保存',
    loginToVocab: '🔑 ログインして保存',
    tutorTitle: '💬 1:1 AIチューター',
    tutorPlaceholder: '質問を入力してください...',
    tutorIntro: 'この段落について何でも質問してください。',
    qTranslate: 'この段落を翻訳して',
    qGrammar: '重要な文法表現を説明して',
    qVocab: '主要な単語と品詞を教えて',
    qNuance: 'ここでの自然なニュアンスは何ですか？',
  },
  zh: {
    deleteArticle: '🗑️ 删除文本 (质量低下)',
    toLibrary: '← 返回图书馆',
    doneReading: '✅ 我读完了！',
    save: '📚 保存',
    login: '🔑 登录',
    details: '🔍 详情',
    saveToVocab: '📚 保存到单词本',
    loginToVocab: '🔑 登录以保存',
    tutorTitle: '💬 1:1 AI导师',
    tutorPlaceholder: '输入您的问题...',
    tutorIntro: '请针对该段落提出任何问题。',
    qTranslate: '翻译这个段落',
    qGrammar: '解释关键语法点',
    qVocab: '显示核心词汇与词性',
    qNuance: '这里的自然语境和语气是什么？',
  }
};

export default function GuestReadPage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [guestNativeLang, setGuestNativeLang] = useState<import('@/lib/gemini').NativeLanguage>('en');
  useEffect(() => setGuestNativeLang(getGuestLang()), []);
  const { wordData, loadingWord, loadingAdvanced, lookupError, fetchWordData, clearWord } = useWordLookup(profile?.nativeLanguage || guestNativeLang);


  const [article, setArticle] = useState<any>(null);                        // 읽고 있는 임시 아티클 객체
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());      // 단어장 저장이 완료된 단어들 목록
  const [showLoginModal, setShowLoginModal] = useState(false);               // 구글 로그인 유도 모달 노출 제어
  const [readingDone, setReadingDone] = useState(false);                     // 다 읽기 완료 처리 상태
  const [signingIn, setSigningIn] = useState(false);                         // 소셜 로그인 처리 중 대기 제어

  // [신규 기능] 툴팁 사전 및 독해 뷰어 커스텀 설정 상태 변수들
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [showAdvancedModal, setShowAdvancedModal] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<string>('normal');
  const [lineHeight, setLineHeight] = useState<number>(2.2);
  const [readerTheme, setReaderTheme] = useState<string>('light');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // 마우스 오버 즉시 검색 옵션 관련 Ref 및 상태 값
  const [hoverLookup, setHoverLookup] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // [신규 기능] 커스텀 카테고리 상태 및 단어 저장 시 선택된 카테고리
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [selectedSaveCategory, setSelectedSaveCategory] = useState<string>('');

  const [tutorSelection, setTutorSelection] = useState<TutorSelection | null>(null);
  const handleOpenTutor = (index: number, text: string) => setTutorSelection({ index, text });
  const closePopup = useCallback(() => {
    clearWord();
    setTooltipPosition(null);
    setShowAdvancedModal(false);
  }, [clearWord]);

  // 🎙️ 발음 연습 및 채점 상태 변수들
  const [recordingParaIdx, setRecordingParaIdx] = useState<number | null>(null);
  const [paraScores, setParaScores] = useState<Record<number, { text: string; score: number }>>({});
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  // Levenshtein Distance 계산을 통한 유사도 측정 (0-100점)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const clean = (s: string) => s.replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9]/g, '').toLowerCase();
    const s1 = clean(str1);
    const s2 = clean(str2);

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 100;

    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1
          );
        }
      }
    }

    const distance = dp[m][n];
    const maxLength = Math.max(m, n);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    return Math.round(similarity);
  };

  const handleMicClick = (pIdx: number, originalText: string) => {
    if (typeof window === 'undefined') return;

    if (recordingParaIdx !== null) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
      setRecordingParaIdx(null);
      if (recordingParaIdx === pIdx) return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Safari 브라우저 사용을 권장합니다.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setRecordingParaIdx(pIdx);
    };

    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      const score = calculateSimilarity(originalText, resultText);
      setParaScores(prev => ({
        ...prev,
        [pIdx]: { text: resultText, score }
      }));
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        alert(`음성 인식 중 에러가 발생했습니다: ${event.error}`);
      }
      setRecordingParaIdx(null);
    };

    rec.onend = () => {
      setRecordingParaIdx(null);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.error(e);
      setRecordingParaIdx(null);
    }
  };

  // 로그인 상태 변화 시 커스텀 카테고리 로딩
  useEffect(() => {
    if (user) {
      getCustomCategories(user.uid).then(setCustomCategories);
    } else {
      setCustomCategories([]);
    }
  }, [user]);

  // 컴포넌트 마운트 시 브라우저 설정 로드 및 세션 기사 읽어오기
  useEffect(() => {
    // 로컬 스토리지에 저장된 마우스 오버 사전 검색 활성화 선호도 설정 로드
    const savedHover = localStorage.getItem('koreading_hover_lookup') === 'true';
    setHoverLookup(savedHover);

    // [신규 기능] 독서 뷰어 설정 로컬 스토리지 로드
    const savedSize = localStorage.getItem('koreading_font_size');
    if (savedSize) setFontSize(savedSize);
    const savedLine = localStorage.getItem('koreading_line_height');
    if (savedLine) setLineHeight(parseFloat(savedLine));
    const savedTheme = localStorage.getItem('koreading_reader_theme');
    if (savedTheme) setReaderTheme(savedTheme);

    // 게스트가 방금 임시 생성한 세션 상의 기사 로드
    const a = getGuestArticle();
    if (!a) { router.push('/library'); return; }
    setArticle(a);
    setSelectedSaveCategory('');

    // 외부 영역 클릭 시 미니 사전 툴팁 닫기
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.reading-word') && 
        !target.closest('.mini-tooltip-popup') &&
        !target.closest('.word-popup')
      ) {
        closePopup();
      }
    };
    document.addEventListener('click', handleGlobalClick);

    // 타이머 메모리 누수 방지용 언마운트 정리
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [router, closePopup]);

  // [신규 기능] 독서 뷰어 커스텀 설정 갱신 헬퍼 함수
  const updateFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('koreading_font_size', size);
  };
  const updateLineHeight = (line: number) => {
    setLineHeight(line);
    localStorage.setItem('koreading_line_height', line.toString());
  };
  const updateReaderTheme = (theme: string) => {
    setReaderTheme(theme);
    localStorage.setItem('koreading_reader_theme', theme);
  };

  // 🔊 TTS 한국어 목소리 음성 합성 재생 헬퍼
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      window.speechSynthesis.speak(utterance);
    }
  };

  // 백그라운드 단어 사전 조회 비동기 코어 함수

  /**
   * 한국어 단어를 클릭하거나 마우스 오버했을 때 동작하는 사전 조회 핵심 로직입니다.
   * 클릭한 좌표를 계산하여 해당 요소 바로 상단에 미니 플로팅 툴팁 사전을 오픈합니다.
   */
  const handleWordClick = (e: React.MouseEvent, word: string, sentence: string) => {
    if (!isKoreanWord(word)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + window.scrollY - 110,
      left: rect.left + window.scrollX + (rect.width / 2),
    });
    setShowAdvancedModal(false);
    fetchWordData(word, sentence);
  };

  // 마우스 오버 즉시 검색 핸들러 (250ms 디바운스 적용)
  const handleWordMouseEnter = (e: React.MouseEvent, word: string, sentence: string) => {
    if (!hoverLookup) return;
    if (!isKoreanWord(word)) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    const target = e.currentTarget;
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + window.scrollY - 110,
        left: rect.left + window.scrollX + (rect.width / 2),
      });
      setShowAdvancedModal(false);
      fetchWordData(word, sentence);
    }, 250);
  };

  // 마우스가 떠나면 대기 타이머 제거
  const handleWordMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // 팝업 오버레이 닫기


  // 단어 저장 버튼 클릭 이벤트
  const handleSaveWord = async () => {
    if (!wordData) return;
    // 비로그인 상태이므로 단어를 저장할 수 없음을 안내하고 가입 모달 노출
    if (!user) {
      clearWord();
      setShowLoginModal(true);
      return;
    }
    try {
      const wordToSave = wordData.dictionaryForm || wordData.word;
      // 로그인되어 있을 시 Firestore에 단어 저장
      await saveVocabulary(user.uid, {
        word: wordToSave,
        pronunciation: wordData.pronunciation,
        definition: wordData.definition,
        translation: wordData.translation,
        partOfSpeech: wordData.partOfSpeech,
        examples: wordData.examples || [],
        level: wordData.level,
        topic: selectedSaveCategory,
        articleTitle: article?.title || '',
      });
      setSavedWords(prev => {
        const next = new Set(prev);
        next.add(wordData.word);
        if (wordData.dictionaryForm) {
          next.add(wordData.dictionaryForm);
        }
        return next;
      });
      closePopup();
    } catch (e) { console.error(e); }
  };

  // 게스트는 관리자가 아니므로 deleteArticle 기능이 없습니다.
  // 아티클 삭제는 관리자 이메일로 로그인한 사용자만 read/[id]/page.tsx에서 수행할 수 있습니다.

  // '다 읽었어요' 클릭 시 게스트의 읽은 횟수를 1 증가시키고 로그인 유도 모달 토글
  const handleDoneReading = () => {
    incrementGuestReadCount();
    setReadingDone(true);
    setShowLoginModal(true);
  };

  // 가입 유도 모달 내 구글 로그인 연동 처리
  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      setShowLoginModal(false);
      router.push('/library'); // 로그인 완료 시 정식 라이브러리로 이동
    } catch { setSigningIn(false); }
  };

  if (!article) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  const topicInfo = TOPICS.find(t => t.id === article.topicCategory);
  const paragraphs = article.content?.split('\n').filter((p: string) => p.trim()) || [];
  const activeNativeLang = profile?.nativeLanguage || guestNativeLang || 'en';

  // 사용자의 로그인 여부 및 레벨에 따른 UI 언어 선택
  const getUiLang = (): 'en' | 'es' | 'ja' | 'zh' | 'ko' => {
    const level = profile?.level || getGuestLevel();
    if (!user) {
      if (level && ['C1', 'C2'].includes(level)) return 'ko';
      return activeNativeLang;
    }
    if (level && ['C1', 'C2'].includes(level)) {
      return 'ko'; // C1, C2 레벨은 한국어로
    }
    return activeNativeLang; // A1, A2, B1, B2 레벨은 설정한 언어로
  };

  const uiLang = getUiLang();
  const t = TRANSLATIONS[uiLang];

  return (
    <div 
      className={readerTheme === 'light' ? 'reader-theme-light' : readerTheme === 'sepia' ? 'reader-theme-sepia' : readerTheme === 'dark' ? 'reader-theme-dark' : ''} 
      style={{ 
        minHeight: '100vh', 
        padding: '40px 24px', 
        background: 'var(--bg-primary)', 
        color: 'var(--text-primary)',
        transition: 'background-color var(--transition-base), color var(--transition-base)' 
      }}
    >
      {/* 펄스 애니메이션이 가미된 유려한 사전 조회 스켈레톤용 CSS 스타일 주입 */}
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
        {/* 상단 빵부스러기(Breadcrumb) 경로 표시 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <a href="/library" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>📚 도서관</a>
          <span>›</span>
          <span style={{ color: 'var(--text-secondary)' }}>{article.title}</span>
        </div>

        {/* 아티클 메타 정보 영역 (레벨 배지, 토픽, 예측 독해시간, 생성 모델명) */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span className={`level-badge level-${article.level}`}>{article.level}</span>
            {topicInfo && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '3px 10px', borderRadius: '100px', border: '1px solid var(--border-subtle)' }}>
                {topicInfo.emoji} {topicInfo.label}
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏱ {article.estimatedMinutes}분</span>
            {article.generatorModel && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(217,119,6,0.1)', color: 'var(--accent-primary)', padding: '3px 10px', borderRadius: '100px', border: '1px solid rgba(217,119,6,0.3)', fontWeight: 600 }}>
                🤖 {article.generatorModel}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '12px', lineHeight: 1.4 }}>
            {article.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>{articleSummary(article, profile?.nativeLanguage || guestNativeLang)}</p>
        </div>

        {/* 🎨 대표 커버 맞춤 삽화 (Hero Cover Illustration) */}
        {article.imageUrls?.[0] && (
          <ArticleIllustration
            src={article.imageUrls[0]}
            alt={`${article.title} - 본문 상황도`}
            badgeText="🖼️ 본문 상황도 (Scene)"
            style={{ marginBottom: '24px', marginTop: '0px' }}
          />
        )}

        {/* 유저 인터랙션 제어 바 (마우스 호버 검색 On/Off 토글 지원) */}
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

        {/* AI가 선별한 아티클 핵심 중요 어휘 키 리스트 */}
        {article.keyVocabulary?.length > 0 && (
          <div className="card" style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>핵심 어휘</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {article.keyVocabulary.map((word: string, i: number) => (
                <button
                  key={i}
                  onClick={(e) => handleWordClick(e, word, article.content)}
                  onMouseEnter={(e) => handleWordMouseEnter(e, word, article.content)}
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

        {/* 독해 지문 본문 카드 (각 한국어 어휘에 인터랙티브 클릭 이벤트 및 바인딩 완료) */}
        {lookupError && <p role="alert">{lookupError}</p>}
        <ReaderBody paragraphs={paragraphs} article={article} fontSize={fontSize} lineHeight={lineHeight} savedWords={savedWords} recordingParaIdx={recordingParaIdx} paraScores={paraScores} onWordClick={handleWordClick} onWordEnter={handleWordMouseEnter} onWordLeave={handleWordMouseLeave} onSpeak={speakText} onTutor={handleOpenTutor} onMic={handleMicClick} />

        {/* 독해 완료 유도 버튼 툴바 영역 */}
        {!readingDone && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '60px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 게스트는 관리자가 아니디로 삭제 버튼을 표시하지 않습니다 */}

            <a href="/library" className="btn btn-ghost">{t.toLibrary}</a>
            <button id="mark-done-btn" onClick={handleDoneReading} className="btn btn-primary">
              {t.doneReading}
            </button>
          </div>
        )}
      </div>

      {/* 💬 미니 플로팅 툴팁 사전 */}
      {tooltipPosition && (loadingWord || (wordData && !showAdvancedModal)) && (
        <div
          className="mini-tooltip-popup"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {loadingWord ? (
            <div style={{ padding: '4px' }}>
              <div className="skeleton" style={{ width: '80px', height: '14px', marginBottom: '8px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '120px', height: '12px', borderRadius: '4px' }} />
            </div>
          ) : wordData && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {wordData.dictionaryForm || wordData.word}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={() => speakText(wordData.dictionaryForm || wordData.word)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                    title="발음 듣기"
                  >
                    🔊
                  </button>
                  <button
                    onClick={closePopup}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '6px' }}>
                {wordData.partOfSpeech} | CEFR {wordData.level}
              </div>
              
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4, fontFamily: 'Noto Sans KR, sans-serif' }}>
                {wordData.translation}
              </div>

              {user && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>카테고리 선택</label>
                  <select
                    value={selectedSaveCategory}
                    onChange={(e) => setSelectedSaveCategory(e.target.value)}
                    style={{
                      width: '100%',
                      fontSize: '0.7rem',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="">📁 미분류 (기본)</option>
                    {customCategories.map(c => (
                      <option key={c} value={c}>📁 {c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button
                  onClick={handleSaveWord}
                  disabled={savedWords.has(wordData.word)}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: savedWords.has(wordData.word) ? 'rgba(16,185,129,0.1)' : 'var(--accent-primary)',
                    border: '1px solid',
                    borderColor: savedWords.has(wordData.word) ? 'rgba(16,185,129,0.3)' : 'var(--accent-primary)',
                    color: savedWords.has(wordData.word) ? '#10b981' : 'white',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                >
                  {user ? (savedWords.has(wordData.word) ? '✓ 저장됨' : t.save) : t.login}
                </button>
                <button
                  onClick={() => setShowAdvancedModal(true)}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                >
                  {t.details}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2단계 점진적 조회 스켈레톤 사전 팝업창 (상세 오버레이) */}
      {showAdvancedModal && wordData && (
        <div className="word-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePopup(); }}>
          <div className="word-popup" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
            <>
              <div className="word-popup-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <div className="word-popup-word">{wordData.dictionaryForm || wordData.word}</div>
                    {wordData.dictionaryForm && wordData.dictionaryForm !== wordData.word && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'Noto Sans KR, sans-serif' }}>
                        (원문: {wordData.word})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <div className="word-popup-pronunciation">[{wordData.pronunciation}]</div>
                    <button
                      onClick={() => speakText(wordData.dictionaryForm || wordData.word)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: 0 }}
                      title="발음 듣기"
                    >
                      🔊
                    </button>
                  </div>
                </div>
                <button className="word-popup-close" onClick={closePopup}>✕</button>
              </div>

              <span className="word-popup-pos">{wordData.partOfSpeech}</span>

              {/* 2단계 백그라운드 Advanced 분석 호출 대기 중에는 미세 실선 박스로 안내 처리 */}
              {loadingAdvanced && !wordData.structure ? (
                <div style={{ marginBottom: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', border: '1px dotted var(--border-subtle)' }}>
                  <div className="skeleton" style={{ width: '45%', height: '12px', marginBottom: '10px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '85%', height: '16px', borderRadius: '4px' }} />
                </div>
              ) : wordData.structure ? (
                <div className="word-popup-section" style={{ background: 'rgba(217,119,6,0.06)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', border: '1px solid rgba(217,119,6,0.15)', marginBottom: '20px' }}>
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
                  🌐 {{ en: '영어', es: '스페인어', ja: '일본어', zh: '중국어' }[activeNativeLang] || '영어'} 번역
                </div>
                <div className="word-popup-translation">{wordData.translation}</div>
              </div>

              {/* 2단계 예문 로딩 상태 및 실데이터 렌더링 */}
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

              {user && (
                <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📁 저장할 카테고리 선택</label>
                  <select
                    value={selectedSaveCategory}
                    onChange={(e) => setSelectedSaveCategory(e.target.value)}
                    style={{
                      width: '100%',
                      fontSize: '0.9rem',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="">📁 미분류 (기본)</option>
                    {customCategories.map(c => (
                      <option key={c} value={c}>📁 {c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 단어 저장 단추 */}
              <button className="word-popup-save-btn" onClick={handleSaveWord}>
                {user ? (savedWords.has(wordData.word) ? '✓ 단어장에 저장됨' : t.saveToVocab) : t.loginToVocab}
              </button>
            </>
          </div>
        </div>
      )}

      {/* 비회원용 구글 계정 로그인 유도 모달 */}
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

            {/* 로그인 실행 버튼 (E2E 테스트 구동용 login-from-reading-btn ID 탑재) */}
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

      {/* ⚙️ 독해 뷰어 커스텀 설정 컨트롤러 */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
        className="reader-settings-btn"
        title="독해 뷰어 설정"
      >
        ⚙️
      </button>

      {showSettings && (
        <div className="reader-settings-panel" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>⚙️ 독해 뷰어 설정</h4>
            <button
              onClick={() => setShowSettings(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ✕
            </button>
          </div>

          {/* 테마 설정 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>리더 배경 테마</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'light', label: 'Paper', bg: '#fbfaf8', color: '#1c1917' },
                { id: 'sepia', label: 'Sepia', bg: '#fdf6e3', color: '#5c4326' },
                { id: 'dark', label: 'Dark', bg: '#1c1917', color: '#fbfaf8' },
              ].map(theme => (
                <button
                  key={theme.id}
                  onClick={() => updateReaderTheme(theme.id)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    background: theme.bg,
                    color: theme.color,
                    border: readerTheme === theme.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* 글자 크기 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>글자 크기</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'small', label: '가-' },
                { id: 'normal', label: '가' },
                { id: 'large', label: '가+' },
                { id: 'xlarge', label: '가++' },
              ].map(size => (
                <button
                  key={size.id}
                  onClick={() => updateFontSize(size.id)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    background: fontSize === size.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: fontSize === size.id ? 'white' : 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          {/* 줄 간격 */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>글 줄 간격</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: 1.8, label: '기본' },
                { value: 2.2, label: '넓게' },
                { value: 2.6, label: '아주넓게' },
              ].map(line => (
                <button
                  key={line.value}
                  onClick={() => updateLineHeight(line.value)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    background: lineHeight === line.value ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: lineHeight === line.value ? 'white' : 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {line.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <TutorPanel selected={tutorSelection} onClose={() => setTutorSelection(null)} language={profile?.nativeLanguage || guestNativeLang} level={profile?.level || article?.level || 'A1'} labels={t} />
    </div>
  );
}

