'use client';

/**
 * @file page.tsx (read/[id])
 * @description 로그인 상태의 사용자가 개별 도서관 텍스트를 읽고 인터랙티브 사전을 활용하는 '본문 독해 화면'입니다. 단어 오버/클릭 시 2단계 점진적 사전 조회(Double-Stage Progressive Lookup), iOS 스타일의 마우스 오버 즉시 검색 설정 토글, 다 읽음 체크 및 독자 별점/리뷰(Pros & Cons) 제출 및 실시간 조회 기능을 담고 있습니다.
 * @why 문맥 기반의 몰입감 넘치는 한국어 학습 경험을 제공하며, 다른 독자들과 평점/코멘트를 적극 공유하여 양질의 독서 커뮤니티 생태계를 조성하기 위해 존재합니다.
 */

import { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getArticleById, markArticleRead, saveVocabulary, getReadArticles, Article, saveReview, getReviews, Review, deleteArticle } from '@/lib/db';
import { lookupWordBasic, lookupWordAdvanced, TOPICS } from '@/lib/gemini';
import { getGuestLang } from '@/lib/storage';
import AlertModal from '@/components/AlertModal';
import { tokenizeKorean, isKoreanWord } from '@/lib/utils';

// 사전 조회 데이터를 담을 구조 인터페이스
interface WordData {
  word: string;
  dictionaryForm?: string;
  pronunciation: string;
  partOfSpeech: string;
  structure?: string;
  definition: string;
  translation: string;
  examples?: { korean: string; translation: string }[];
  level: string;
}



// 다국어 번역 사전 정의
const TRANSLATIONS = {
  ko: {
    deleteArticle: '🗑️ 텍스트 삭제 (품질 저하)',
    toLibrary: '← 도서관으로',
    markRead: '✅ 읽음으로 표시',
    markingRead: '저장 중...',
    save: '📚 저장',
    saving: '저장...',
    saved: '✓ 저장됨',
    details: '🔍 자세히',
    saveToVocab: '📚 단어장에 저장',
    savingToVocab: '저장 중...',
    savedToVocab: '✓ 단어장에 저장됨',
    loginToSave: '🔑 로그인하여 단어장에 저장',
    submitReview: '별점 및 평가 등록하기',
    submittingReview: '제출 중...',
  },
  en: {
    deleteArticle: '🗑️ Delete Text (Low Quality)',
    toLibrary: '← To Library',
    markRead: '✅ Mark as Read',
    markingRead: 'Saving...',
    save: '📚 Save',
    saving: 'Saving...',
    saved: '✓ Saved',
    details: '🔍 Details',
    saveToVocab: '📚 Save to Vocabulary',
    savingToVocab: 'Saving...',
    savedToVocab: '✓ Saved to Vocabulary',
    loginToSave: '🔑 Log in to Save',
    submitReview: 'Submit Rating & Review',
    submittingReview: 'Submitting...',
  },
  es: {
    deleteArticle: '🗑️ Eliminar texto (Baja calidad)',
    toLibrary: '← A la biblioteca',
    markRead: '✅ Marcar como leído',
    markingRead: 'Guardando...',
    save: '📚 Guardar',
    saving: 'Guardando...',
    saved: '✓ Guardado',
    details: '🔍 Detalles',
    saveToVocab: '📚 Guardar en vocabulario',
    savingToVocab: 'Guardando...',
    savedToVocab: '✓ Guardado en vocabulario',
    loginToSave: '🔑 Iniciar sesión para guardar',
    submitReview: 'Enviar calificación y reseña',
    submittingReview: 'Enviando...',
  },
  ja: {
    deleteArticle: '🗑️ テキスト削除 (品質低下)',
    toLibrary: '← 図書館へ',
    markRead: '✅ 既読にする',
    markingRead: '保存中...',
    save: '📚 保存',
    saving: '保存중...',
    saved: '✓ 保存済み',
    details: '🔍 詳細',
    saveToVocab: '📚 単語帳に保存',
    savingToVocab: '保存中...',
    savedToVocab: '✓ 単語帳に保存済み',
    loginToSave: '🔑 ログインして保存',
    submitReview: '評価とレビューを登録する',
    submittingReview: '送信中...',
  },
  zh: {
    deleteArticle: '🗑️ 删除文本 (质量低下)',
    toLibrary: '← 返回图书馆',
    markRead: '✅ 标记为已读',
    markingRead: '保存中...',
    save: '📚 保存',
    saving: '保存中...',
    saved: '✓ 已保存',
    details: '🔍 详情',
    saveToVocab: '📚 保存到单词本',
    savingToVocab: '保存中...',
    savedToVocab: '✓ 已保存到单词本',
    loginToSave: '🔑 登录以保存',
    submitReview: '提交评分与评价',
    submittingReview: '提交中...',
  }
};

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);                 // Next.js 동적 라우팅 파라미터 [id] 언팩
  const { user, profile } = useAuth();        // AuthContext 세션 정보 조회
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);              // 로드된 아티클 상태값
  const [loading, setLoading] = useState(true);                              // 아티클 로딩 스피너 제어
  const [wordData, setWordData] = useState<WordData | null>(null);            // 클릭 사전 단어 상태값
  const [loadingWord, setLoadingWord] = useState(false);                     // 기본 사전 검색용 스켈레톤 토글
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);             // 상세 사전 검색용 스켈레톤 토글
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());      // 단어장에 추가 완료된 한글 단어 뱃지 리스트
  const [savingWord, setSavingWord] = useState(false);                       // 단어장 Firestore 추가 API 락 제어
  const [savedToast, setSavedToast] = useState(false);                       // 화면 우측 하단 저장 성공 토스트 활성화 제어
  const [isRead, setIsRead] = useState(false);                               // 현재 사용자가 이 기사를 읽은 기록이 있는지 판별
  const [markingRead, setMarkingRead] = useState(false);                     // 완독 체크 중 로딩 상태

  // 마우스 오버 시 즉시 사전을 표출하는 토글을 위한 Refs 및 상태
  const [hoverLookup, setHoverLookup] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // [신규 기능] 툴팁 사전 및 독해 뷰어 커스텀 설정 상태 변수들
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [showAdvancedModal, setShowAdvancedModal] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<string>('normal');
  const [lineHeight, setLineHeight] = useState<number>(2.2);
  const [readerTheme, setReaderTheme] = useState<string>(() => {
    // SSR 환경 대응을 위한 다크 테마 디폴트 설정
    return 'dark';
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // 독자 평가 리뷰 작성 및 렌더링을 위한 상태들
  const [reviews, setReviews] = useState<Review[]>([]);                      // 기사에 등록된 리뷰 목록
  const [rating, setRating] = useState<number>(0);                           // 작성 중인 내 별점 (1 ~ 5)
  const [hoverRating, setHoverRating] = useState<number>(0);                 // 별점 마우스 호버 오버레이 점수
  const [pros, setPros] = useState('');                                      // 좋았던 점 텍스트
  const [cons, setCons] = useState('');                                      // 아쉬운 점 텍스트
  const [submittingReview, setSubmittingReview] = useState(false);           // 리뷰 작성 비동기 락
  const [hasReviewed, setHasReviewed] = useState(false);                     // 리뷰 작성 성공 뱃지

  // 알림 모달 상태 관리
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

  // 컴포넌트 마운트 및 ID 변경 시 Firestore로부터 아티클 상세 정보, 읽음 여부 및 리뷰 목록들을 일괄 로딩합니다.
  useEffect(() => {
    const savedHover = localStorage.getItem('koreading_hover_lookup') === 'true';
    setHoverLookup(savedHover);

    // [신규 기능] 독서 뷰어 설정 로컬 스토리지 로드
    const savedSize = localStorage.getItem('koreading_font_size');
    if (savedSize) setFontSize(savedSize);
    const savedLine = localStorage.getItem('koreading_line_height');
    if (savedLine) setLineHeight(parseFloat(savedLine));
    const savedTheme = localStorage.getItem('koreading_reader_theme');
    if (savedTheme) setReaderTheme(savedTheme);

    const load = async () => {
      const a = await getArticleById(id);
      if (!a) { router.push('/library'); return; }
      setArticle(a);
      
      // 유저가 로그인 상태라면 완독 이력 데이터를 DB에서 로드합니다.
      if (user) {
        const readIds = await getReadArticles(user.uid);
        setIsRead(readIds.includes(id));
      }
      
      // 기사별 한줄 평 목록 취득
      const list = await getReviews(id);
      setReviews(list);
      setLoading(false);
    };
    load();

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

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [id, user, router]);

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
  const fetchWordData = useCallback(async (word: string, sentence: string) => {
    setWordData(null);
    setLoadingWord(true);
    setLoadingAdvanced(false);
    try {
      const nativeLang = user ? (profile?.nativeLanguage || 'en') : getGuestLang();
      if (!nativeLang) return;
      
      const basicData = await lookupWordBasic(word, sentence, nativeLang);
      setWordData(basicData);
      setLoadingWord(false);

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
  const closePopup = () => {
    setWordData(null);
    setLoadingWord(false);
    setLoadingAdvanced(false);
    setTooltipPosition(null);
    setShowAdvancedModal(false);
  };

  // "내 단어장에 저장" 클릭 시 실행 핸들러
  const handleSaveWord = async () => {
    if (!user || !wordData || !article) {
      triggerAlert('단어를 저장하려면 로그인해야 합니다.', '로그인 필요', 'warning');
      router.push('/login');
      return;
    }
    setSavingWord(true);
    try {
      const wordToSave = wordData.dictionaryForm || wordData.word;
      // DB 유저 하부 서브컬렉션 vocabulary 테이블에 신규 레코드 생성
      await saveVocabulary(user.uid, {
        word: wordToSave,
        pronunciation: wordData.pronunciation,
        definition: wordData.definition,
        translation: wordData.translation,
        partOfSpeech: wordData.partOfSpeech,
        examples: wordData.examples || [],
        level: wordData.level,
        topic: article.topicCategory,
        articleTitle: article.title,
      });
      setSavedWords(prev => {
        const next = new Set(prev);
        next.add(wordData.word);
        if (wordData.dictionaryForm) {
          next.add(wordData.dictionaryForm);
        }
        return next;
      }); // 완료 뱃지 추가
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000); // 토스트 피드백 2초 표출
      closePopup();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingWord(false);
    }
  };

  // "읽음으로 표시" 핸들러
  const handleMarkRead = async () => {
    if (!user) {
      setIsRead(true);
      return;
    }
    setMarkingRead(true);
    await markArticleRead(user.uid, id); // Firestore readArticles 컬렉션에 추가
    setIsRead(true);
    setMarkingRead(false);
  };

  // 품질 저하 시 독서 화면에서 해당 텍스트를 영구 삭제하는 E2E 액션
  const handleDeleteArticle = async () => {
    const confirmDelete = window.confirm(
      '🚨 [테스트 기간 전용 액션]\n\n이 텍스트의 퀄리티가 너무 낮아 도서관에서 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 독자의 목록에서 완전히 제거됩니다.'
    );
    if (!confirmDelete) return;
    
    try {
      await deleteArticle(id); // Firestore 데이터 완전 삭제
      triggerAlert('텍스트가 성공적으로 삭제되었습니다. 도서관으로 이동합니다.', '삭제 완료', 'success');
      setTimeout(() => {
        router.push('/library');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      triggerAlert(`삭제 실패: ${err?.message || JSON.stringify(err)}`, '오류', 'error');
    }
  };

  // 사용자의 별점 및 코멘트 작성 서브밋 핸들러
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      triggerAlert('별점을 선택해주세요!', '평가 입력', 'warning');
      return;
    }
    setSubmittingReview(true);
    try {
      const name = user?.displayName || '게스트';
      // Firestore db.ts 내 saveReview 호출하여 리뷰 저장 및 상위 평점 집계 동시 수행
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
      
      // 신규 리뷰 적용을 위해 다시 리스트 갱신
      const list = await getReviews(id);
      setReviews(list);
      
      // 평점 합계 갱신을 위해 아티클 정보 재로드
      const updatedArticle = await getArticleById(id);
      if (updatedArticle) setArticle(updatedArticle);
    } catch (err) {
      console.error(err);
      triggerAlert('리뷰 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.', '리뷰 등록 실패', 'error');
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

  // 사용자의 로그인 여부 및 레벨에 따른 UI 언어 선택
  const getUiLang = (): 'en' | 'es' | 'ja' | 'zh' | 'ko' => {
    const level = profile?.level;
    if (!user) return activeNativeLang; // 비로그인은 모국어 설정에 맞게
    if (level && ['C1', 'C2'].includes(level)) {
      return 'ko'; // C1, C2 레벨은 한국어로
    }
    return activeNativeLang; // A1, A2, B1, B2 레벨은 설정한 언어로
  };

  const uiLang = getUiLang();
  const t = TRANSLATIONS[uiLang];

  return (
    <div 
      className={readerTheme === 'light' ? 'reader-theme-light' : readerTheme === 'sepia' ? 'reader-theme-sepia' : ''} 
      style={{ 
        minHeight: '100vh', 
        padding: '40px 24px', 
        background: 'var(--bg-primary)', 
        color: 'var(--text-primary)',
        transition: 'background-color var(--transition-base), color var(--transition-base)' 
      }}
    >
      {/* 펄스 애니메이션이 동반된 스켈레톤 로딩 스타일 인젝션 */}
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
        {/* 상단 탐색 네비게이션 빵부스러기 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <a href="/library" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>📚 도서관</a>
          <span>›</span>
          <span style={{ color: 'var(--text-secondary)' }}>{article.title}</span>
        </div>

        {/* 아티클 상세 정보 및 타이틀 요약 헤더 */}
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
            {article.generatorModel && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)', padding: '3px 10px', borderRadius: '100px', border: '1px solid rgba(99,102,241,0.3)', fontWeight: 600 }}>
                🤖 {article.generatorModel}
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

        {/* 설정 변경 제어 영역 (마우스 오버 사전 연동) */}
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

        {/* 지문 주요 단어 리스트업 영역 */}
        {article.keyVocabulary && article.keyVocabulary.length > 0 && (
          <div className="card" style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>
              핵심 어휘
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {article.keyVocabulary.map((word, i) => (
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
                    transition: 'all 150ms ease',
                  }}
                >
                  {savedWords.has(word) && '✓ '}{word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 독해 본문 내용 카드 영역 */}
        <div className="card" style={{ padding: '36px', marginBottom: '32px' }}>
          {paragraphs.map((paragraph, pIdx) => {
            const tokens = tokenizeKorean(paragraph);
            const cleanText = paragraph.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣.,!?'"~]/g, '');
            return (
              <p key={pIdx} style={{
                fontFamily: 'Noto Sans KR, sans-serif',
                fontSize: fontSize === 'small' ? '0.95rem' : fontSize === 'large' ? '1.3rem' : fontSize === 'xlarge' ? '1.5rem' : '1.1rem',
                lineHeight: lineHeight,
                marginBottom: '20px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'flex-start',
              }}>
                <button
                  onClick={() => speakText(cleanText)}
                  className="reader-para-play-btn"
                  title="이 문단 발음 듣기"
                  style={{ marginTop: '4px' }}
                >
                  🔊
                </button>
                <span style={{ flex: 1 }}>
                  {tokens.map((token, tIdx) => {
                    if (isKoreanWord(token)) {
                      const isSaved = savedWords.has(token);
                      return (
                        <span
                          key={tIdx}
                          className={`reading-word ${isSaved ? 'saved' : ''}`}
                          onClick={(e) => handleWordClick(e, token, paragraph)}
                          onMouseEnter={(e) => handleWordMouseEnter(e, token, paragraph)}
                          onMouseLeave={handleWordMouseLeave}
                          title="클릭/오버하여 뜻 보기"
                        >
                          {token}
                        </span>
                      );
                    }
                    return token;
                  })}
                </span>
              </p>
            );
          })}
        </div>

        {/* 독자 평가 평점 제출 카드 */}
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
              {/* 별점 선택 라디오형 버튼 */}
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
                        onMouseLeave={() => setHoverRating(Star => 0)} // 호버 아웃 시 복원
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

              {/* 좋았던 점 서술 영역 */}
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

              {/* 아쉬운 점 서술 영역 */}
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
                {submittingReview ? t.submittingReview : t.submitReview}
              </button>
            </form>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '32px 0' }} />

          {/* 독자 평가들의 리스트 뷰 영역 */}
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

        {/* 독해 완료 처리 버튼 바 */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '60px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* [품질 저하 테스트 전용 삭제 버튼] 레이아웃 흐름을 해치지 않도록 맨 좌측 배치 */}
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
              marginRight: 'auto',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
          >
            {t.deleteArticle}
          </button>

          <a href="/library" className="btn btn-ghost">{t.toLibrary}</a>
          {!isRead && (
            <button
              id="mark-read-btn"
              onClick={handleMarkRead}
              disabled={markingRead}
              className="btn btn-primary"
            >
              {markingRead ? t.markingRead : t.markRead}
            </button>
          )}
        </div>
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
              
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '6px' }}>
                {wordData.partOfSpeech} | CEFR {wordData.level}
              </div>
              
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4, fontFamily: 'Noto Sans KR, sans-serif' }}>
                {wordData.translation}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button
                  onClick={handleSaveWord}
                  disabled={savingWord || savedWords.has(wordData.word)}
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
                  {savingWord ? t.saving : savedWords.has(wordData.word) ? t.saved : t.save}
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
            {/* AI 데이터 바인딩 표출 */}
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

              {/* 2단계 백그라운드 Advanced 분석 호출 대기 상태 대응 */}
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

              {/* 2단계 예문 데이터 점진 바인딩 */}
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

              {/* 단어장에 저장 단추 */}
              <button
                className="word-popup-save-btn"
                onClick={handleSaveWord}
                disabled={savingWord || savedWords.has(wordData.word)}
              >
                {savingWord ? t.savingToVocab : savedWords.has(wordData.word) ? t.savedToVocab : t.saveToVocab}
              </button>
            </>
          </div>
        </div>
      )}

      {/* 저장 완료 미니 토스트 알림 */}
      {savedToast && (
        <div className="toast toast-success">
          ✓ 단어장에 저장되었습니다!
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
                { id: 'dark', label: 'Dark', bg: '#0a0e1a', color: '#f8fafc' },
                { id: 'light', label: 'Light', bg: '#f8fafc', color: '#0f172a' },
                { id: 'sepia', label: 'Sepia', bg: '#fdf6e3', color: '#5c4326' },
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

      {/* 공통 알림용 Alert Modal */}
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

