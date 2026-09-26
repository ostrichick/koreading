'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getVocabulary, 
  VocabularyEntry, 
  deleteVocabulary,
  getCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
  reviewVocabulary,
} from '@/lib/db';
import { TOPICS } from '@/lib/gemini';
import { getGuestLang, getGuestLevel } from '@/lib/storage';
import { shuffleArray } from '@/lib/utils';

// 다국어 번역 사전 정의
const TRANSLATIONS = {
  ko: {
    title: '📝 내 단어장',
    savedWords: '저장된 단어: ',
    wordUnit: '개',
    exportAnki: '📥 Anki용 CSV 내보내기',
    tabList: '📖 단어 목록',
    tabFlashcard: '🎴 플래시카드',
    tabReview: '🧠 오늘의 복습',
    tabQuiz: '🧩 미니 퀴즈',
    reviewToday: '오늘의 복습',
    reviewDue: '복습할 단어 {count}개',
    reviewEmpty: '오늘 복습할 단어가 없습니다. 새 글을 읽거나 내일 다시 확인해 보세요.',
    reviewReveal: '정답 보기',
    reviewAgain: '다시 볼래요',
    reviewRemembered: '알았어요',
    reviewComplete: '오늘의 복습 완료',
    reviewContext: '원문 문맥',
    allTopics: '전체',
    emptyTitle: '단어장이 비어 있어요',
    emptyDesc: '텍스트를 읽으면서 모르는 단어를 저장해보세요!',
    toLibrary: '도서관으로 가기',
    noFlashcardTitle: '학습할 단어가 없습니다',
    noFlashcardDesc: '단어장 단어가 비어 있거나, 필터링에 부합하는 단어가 없습니다.',
    listen: '발음 듣기',
    flipCard: '클릭하여 뒤집기 🔄',
    examplesTitle: '예문:',
    prev: '◀ 이전',
    next: '다음 ▶',
    shuffle: '🔀 카드 순서 섞기',
    quizNotEnoughTitle: '단어가 부족해요',
    quizNotEnoughDesc: '4지선다 퀴즈를 출제하기 위해서는 최소 4개 이상의 단어가 단어장에 저장되어야 합니다. (현재 저장 개수: {count}개)',
    quizTitle: '🎯 미니 퀴즈 맞추기',
    quizScore: '맞춘 문제: ',
    quizQuestionDesc: '의 뜻은 무엇일까요?',
    quizCorrect: '✓ 정답',
    quizIncorrect: '✗ 오답',
    quizNext: '다음 문제 풀기 ➔',
    definitionTitle: '📖 한국어 정의',
    translationTitle: '🌐 번역',
    examplesSectionTitle: '📝 예문',
    origin: '출처: ',
    deleteBtn: '삭제',
    deleteConfirm: '정말로 이 단어를 삭제하시겠습니까?',
    manageCategories: '📁 카테고리 관리',
    addCategory: '추가',
    newCategoryPlaceholder: '새 카테고리 이름 입력',
    categoryTitle: '📁 카테고리 관리',
  },
  en: {
    title: '📝 My Vocabulary',
    savedWords: 'Saved Words: ',
    wordUnit: '',
    exportAnki: '📥 Export CSV for Anki',
    tabList: '📖 Word List',
    tabFlashcard: '🎴 Flashcards',
    tabReview: '🧠 Today\'s Review',
    tabQuiz: '🧩 Mini Quiz',
    reviewToday: 'Today\'s Review',
    reviewDue: '{count} words due',
    reviewEmpty: 'No words are due today. Read something new or check again tomorrow.',
    reviewReveal: 'Show answer',
    reviewAgain: 'Review again',
    reviewRemembered: 'I remembered',
    reviewComplete: 'Today\'s review complete',
    reviewContext: 'Original context',
    allTopics: 'All',
    emptyTitle: 'Vocabulary is empty',
    emptyDesc: 'Save words you don\'t know while reading texts!',
    toLibrary: 'Go to Library',
    noFlashcardTitle: 'No words to study',
    noFlashcardDesc: 'No words in vocabulary or matches the filter.',
    listen: 'Listen',
    flipCard: 'Click to Flip 🔄',
    examplesTitle: 'Examples:',
    prev: '◀ Prev',
    next: 'Next ▶',
    shuffle: '🔀 Shuffle Cards',
    quizNotEnoughTitle: 'Not enough words',
    quizNotEnoughDesc: 'At least 4 words must be saved in the vocabulary to take a 4-choice quiz. (Current count: {count})',
    quizTitle: '🎯 Mini Quiz',
    quizScore: 'Score: ',
    quizQuestionDesc: 'What is the meaning of this word?',
    quizCorrect: '✓ Correct',
    quizIncorrect: '✗ Incorrect',
    quizNext: 'Next Question ➔',
    definitionTitle: '📖 Korean Definition',
    translationTitle: '🌐 Translation',
    examplesSectionTitle: '📝 Examples',
    origin: 'Source: ',
    deleteBtn: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this word?',
    manageCategories: '📁 Manage Categories',
    addCategory: 'Add',
    newCategoryPlaceholder: 'New category name',
    categoryTitle: '📁 Manage Categories',
  },
  es: {
    title: '📝 Mi Vocabulario',
    savedWords: 'Palabras guardadas: ',
    wordUnit: '',
    exportAnki: '📥 Exportar CSV para Anki',
    tabList: '📖 Lista de palabras',
    tabFlashcard: '🎴 Tarjetas',
    tabReview: '🧠 Repaso de hoy',
    tabQuiz: '🧩 Mini cuestionario',
    reviewToday: 'Repaso de hoy',
    reviewDue: '{count} palabras para repasar',
    reviewEmpty: 'No hay palabras pendientes hoy. Lee algo nuevo o vuelve mañana.',
    reviewReveal: 'Mostrar respuesta',
    reviewAgain: 'Repasar de nuevo',
    reviewRemembered: 'La recordé',
    reviewComplete: 'Repaso de hoy completado',
    reviewContext: 'Contexto original',
    allTopics: 'Todo',
    emptyTitle: 'El vocabulario está vacío',
    emptyDesc: '¡Guarda las palabras que no sepas mientras lees!',
    toLibrary: 'Ir a la biblioteca',
    noFlashcardTitle: 'No hay palabras para estudiar',
    noFlashcardDesc: 'No hay palabras en el vocabulario o que coincidan con el filtro.',
    listen: 'Escuchar',
    flipCard: 'Haz clic para voltear 🔄',
    examplesTitle: 'Ejemplos:',
    prev: '◀ Anterior',
    next: 'Siguiente ▶',
    shuffle: '🔀 Mezclar tarjetas',
    quizNotEnoughTitle: 'No hay suficientes palabras',
    quizNotEnoughDesc: 'Se deben guardar al menos 4 palabras en el vocabulario para realizar un cuestionario de 4 opciones. (Recuento actual: {count})',
    quizTitle: '🎯 Mini cuestionario',
    quizScore: 'Puntuación: ',
    quizQuestionDesc: '¿Cuál es el significado de esta palabra?',
    quizCorrect: '✓ Correcto',
    quizIncorrect: '✗ Incorrecto',
    quizNext: 'Siguiente pregunta ➔',
    definitionTitle: '📖 Definición en coreano',
    translationTitle: '🌐 Traducción',
    examplesSectionTitle: '📝 Ejemplos',
    origin: 'Origen: ',
    deleteBtn: 'Eliminar',
    deleteConfirm: '¿Realmente quieres eliminar esta palabra?',
    manageCategories: '📁 Gestionar categorías',
    addCategory: 'Añadir',
    newCategoryPlaceholder: 'Nuevo nombre de categoría',
    categoryTitle: '📁 Gestionar categorías',
  },
  ja: {
    title: '📝 マイ単語帳',
    savedWords: '保存された単語: ',
    wordUnit: '個',
    exportAnki: '📥 Anki用CSV書き出し',
    tabList: '📖 単語一覧',
    tabFlashcard: '🎴 フラッシュカード',
    tabReview: '🧠 今日の復習',
    tabQuiz: '🧩 ミニクイズ',
    reviewToday: '今日の復習',
    reviewDue: '復習する単語 {count}個',
    reviewEmpty: '今日復習する単語はありません。新しい文章を読むか、明日また確認してください。',
    reviewReveal: '答えを見る',
    reviewAgain: 'もう一度',
    reviewRemembered: '覚えていた',
    reviewComplete: '今日の復習完了',
    reviewContext: '元の文脈',
    allTopics: 'すべて',
    emptyTitle: '単語帳が空です',
    emptyDesc: 'テキストを読みながら知らない単語を保存しましょう！',
    toLibrary: '図書館へ行く',
    noFlashcardTitle: '学習する単語がありません',
    noFlashcardDesc: '単語帳に単語がないか、フィルターに一致する単語がありません。',
    listen: '発音を聞く',
    flipCard: 'クリックして裏返す 🔄',
    examplesTitle: '例文:',
    prev: '◀ 前へ',
    next: '次へ ▶',
    shuffle: '🔀 カードをシャッフル',
    quizNotEnoughTitle: '単語が不足しています',
    quizNotEnoughDesc: '4択クイズを出題するには、単語帳に少なくとも4つ以上の単語が保存されている必要があります。（現在の保存数：{count}個）',
    quizTitle: '🎯 ミニクイズ',
    quizScore: 'スコア: ',
    quizQuestionDesc: 'の意味は何でしょうか？',
    quizCorrect: '✓ 正解',
    quizIncorrect: '✗ 不正解',
    quizNext: '次の問題へ ➔',
    definitionTitle: '📖 韓国語의 정의',
    translationTitle: '🌐 翻訳',
    examplesSectionTitle: '📝 例文',
    origin: '出典: ',
    deleteBtn: '削除',
    deleteConfirm: '本当にこの単語を削除しますか？',
    manageCategories: '📁 カテゴリ管理',
    addCategory: '追加',
    newCategoryPlaceholder: '新しいカテゴリ名を入力',
    categoryTitle: '📁 カテゴリ管理',
  },
  zh: {
    title: '📝 我的单词本',
    savedWords: '已保存单词: ',
    wordUnit: '个',
    exportAnki: '📥 导出 Anki CSV',
    tabList: '📖 单词列表',
    tabFlashcard: '🎴 闪卡',
    tabReview: '🧠 今日复习',
    tabQuiz: '🧩 迷你测试',
    reviewToday: '今日复习',
    reviewDue: '有 {count} 个单词待复习',
    reviewEmpty: '今天没有需要复习的单词。可以阅读新文章或明天再来。',
    reviewReveal: '显示答案',
    reviewAgain: '再复习',
    reviewRemembered: '我记得',
    reviewComplete: '今日复习完成',
    reviewContext: '原文语境',
    allTopics: '全部',
    emptyTitle: '单词本为空',
    emptyDesc: '阅读文章时保存你不认识的单词吧！',
    toLibrary: '前往图书馆',
    noFlashcardTitle: '没有可学习的单词',
    noFlashcardDesc: '单词本中没有单词，或者没有符合筛选条件的单词。',
    listen: '听发音',
    flipCard: '点击翻转 🔄',
    examplesTitle: '例句:',
    prev: '◀ 上一步',
    next: '下一步 ▶',
    shuffle: '🔀 打乱卡片顺序',
    quizNotEnoughTitle: '单词量不足',
    quizNotEnoughDesc: '要进行四选一测试，单词本中至少需要保存4个以上的单词。（当前数量：{count}个）',
    quizTitle: '🎯 迷你测试',
    quizScore: '得分: ',
    quizQuestionDesc: '的意思是什么？',
    quizCorrect: '✓ 正确',
    quizIncorrect: '✗ 错误',
    quizNext: '下一题 ➔',
    definitionTitle: '📖 韩语定义',
    translationTitle: '🌐 翻译',
    examplesSectionTitle: '📝 例句',
    origin: '来源: ',
    deleteBtn: '删除',
    deleteConfirm: '确定要删除这个单词吗？',
    manageCategories: '📁 管理分类',
    addCategory: '添加',
    newCategoryPlaceholder: '输入新分类名称',
    categoryTitle: '📁 管理分类',
  }
};

export default function VocabularyPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const activeNativeLang = profile?.nativeLanguage || getGuestLang() || 'en';
  const getUiLang = (): 'en' | 'es' | 'ja' | 'zh' | 'ko' => {
    const level = profile?.level || getGuestLevel();
    if (!user) return activeNativeLang;
    if (level && ['C1', 'C2'].includes(level)) {
      return 'ko';
    }
    return activeNativeLang;
  };

  const uiLang = getUiLang();
  const t = TRANSLATIONS[uiLang];

  const [vocab, setVocab] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<VocabularyEntry | null>(null);

  const [activeTab, setActiveTab] = useState<string>('list');
  const [cardIdx, setCardIdx] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [shuffledVocab, setShuffledVocab] = useState<VocabularyEntry[]>([]);

  const [quizQuestion, setQuizQuestion] = useState<VocabularyEntry | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  const [reviewQueue, setReviewQueue] = useState<VocabularyEntry[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSession, setReviewSession] = useState({ remembered: 0, total: 0 });

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setCategoryError(false);
      try {
        const [wordsResult, categoriesResult] = await Promise.allSettled([
          getVocabulary(user.uid),
          getCustomCategories(user.uid),
        ]);
        if (cancelled) return;
        if (wordsResult.status === 'fulfilled') setVocab(wordsResult.value);
        else {
          console.error('단어장 불러오기 실패:', wordsResult.reason);
          setLoadError('단어장을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
        }
        if (categoriesResult.status === 'fulfilled') setCustomCategories(categoriesResult.value);
        else {
          console.error('카테고리 불러오기 실패:', categoriesResult.reason);
          setCategoryError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, user, router, retryKey]);

  // 단어 삭제 핸들러
  const handleDeleteWord = async (entryId: string) => {
    if (!user) return;
    if (confirm(t.deleteConfirm)) {
      try {
        await deleteVocabulary(user.uid, entryId);
        setVocab(prev => prev.filter(v => v.id !== entryId));
        if (selectedEntry?.id === entryId) {
          setSelectedEntry(null);
        }
      } catch (err) {
        console.error('단어 삭제 실패:', err);
      }
    }
  };

  // 커스텀 카테고리 추가 핸들러
  const handleAddCategory = async () => {
    if (!user || !newCategoryName.trim()) return;
    const catName = newCategoryName.trim();
    try {
      await addCustomCategory(user.uid, catName);
      setCustomCategories(prev => {
        if (!prev.includes(catName)) {
          return [...prev, catName];
        }
        return prev;
      });
      setNewCategoryName('');
    } catch (err) {
      console.error('카테고리 추가 실패:', err);
    }
  };

  // 커스텀 카테고리 삭제 핸들러
  const handleDeleteCategory = async (name: string) => {
    if (!user) return;
    if (confirm(`"${name}" 카테고리를 삭제하시겠습니까? (이 카테고리에 속한 단어들은 지워지지 않으며, 카테고리만 삭제됩니다)`)) {
      try {
        await deleteCustomCategory(user.uid, name);
        setCustomCategories(prev => prev.filter(c => c !== name));
        if (selectedTopic === name) {
          setSelectedTopic('all');
        }
      } catch (err) {
        console.error('카테고리 삭제 실패:', err);
      }
    }
  };


  const isUncategorized = useCallback((topic: string) => {
    return !topic || !customCategories.includes(topic);
  }, [customCategories]);

  // 사용자가 고른 상단 토픽 카테고리 필터에 맞추어 단어장 데이터를 필터링합니다.
  const filteredVocab = useMemo(() => {
    return vocab.filter(entry => {
      if (selectedTopic === 'all') return true;
      if (selectedTopic === '') return isUncategorized(entry.topic);
      return entry.topic === selectedTopic;
    });
  }, [vocab, selectedTopic, isUncategorized]);

  const isDueForReview = useCallback((entry: VocabularyEntry) => {
    if (!entry.nextReviewAt) return true; // Legacy entries become immediately reviewable.
    return entry.nextReviewAt.toMillis() <= Date.now();
  }, []);

  const dueVocab = useMemo(() => filteredVocab.filter(isDueForReview), [filteredVocab, isDueForReview]);

  const startReviewSession = () => {
    const due = filteredVocab.filter(isDueForReview).slice(0, 5);
    setReviewQueue(due);
    setReviewIdx(0);
    setReviewRevealed(false);
    setReviewSession({ remembered: 0, total: 0 });
    setActiveTab('review');
  };

  const reviewEntry = reviewQueue[reviewIdx] || null;
  const reviewPrompt = useMemo(() => {
    if (!reviewEntry?.sourceSentence) return '';
    const sourceWord = reviewEntry.sourceWord || reviewEntry.word;
    if (sourceWord && reviewEntry.sourceSentence.includes(sourceWord)) {
      return reviewEntry.sourceSentence.replace(sourceWord, '______');
    }
    if (reviewEntry.sourceSentence.includes(reviewEntry.word)) {
      return reviewEntry.sourceSentence.replace(reviewEntry.word, '______');
    }
    return reviewEntry.sourceSentence;
  }, [reviewEntry]);

  const handleReviewGrade = async (remembered: boolean) => {
    if (!user || !reviewEntry || reviewSaving) return;
    setReviewSaving(true);
    try {
      const result = await reviewVocabulary(user.uid, reviewEntry.id, remembered);
      setVocab(previous => previous.map(entry => entry.id === reviewEntry.id ? {
        ...entry,
        reviewIntervalDays: result.reviewIntervalDays,
        successCount: result.successCount,
        failureCount: result.failureCount,
        nextReviewAt: result.nextReviewAt,
      } : entry));
      setReviewSession(previous => ({
        remembered: previous.remembered + (remembered ? 1 : 0),
        total: previous.total + 1,
      }));
      setReviewIdx(index => index + 1);
      setReviewRevealed(false);
    } catch (error) {
      console.error('단어 복습 저장 실패:', error);
    } finally {
      setReviewSaving(false);
    }
  };

  // 플래시카드 무작위 셔플 기능 (Fisher-Yates 셔플)
  const handleShuffleCards = () => {
    setShuffledVocab(shuffleArray(shuffledVocab));
    setCardIdx(0);
    setIsFlipped(false);
  };

  // 🧩 미니 퀴즈 문제 자동 생성기 (4지선다, Fisher-Yates 셔플)
  const generateQuiz = useCallback(() => {
    if (filteredVocab.length < 4) return;
    
    // 현재 필터링된 단어 중 정답 단어를 무작위 지정
    const answer = filteredVocab[Math.floor(Math.random() * filteredVocab.length)];
    
    // 오답용 풀 구성 (정답을 제외한 전체 단어 목록)
    const others = vocab.filter(v => v.id !== answer.id);
    const shuffledOthers = shuffleArray(others);
    
    const options = [answer.translation];
    for (let i = 0; i < Math.min(3, shuffledOthers.length); i++) {
      options.push(shuffledOthers[i].translation);
    }

    // 4개 선택지 무작위 셔플
    const shuffledOptions = shuffleArray(options);

    setQuizQuestion(answer);
    setQuizOptions(shuffledOptions);
    setSelectedAnswer(null);
    setIsCorrect(null);
  }, [filteredVocab, vocab]);

  // 플래시카드 학습을 위해 필터링된 단어 목록을 초기화합니다.
  useEffect(() => {
    setShuffledVocab(filteredVocab);
    setCardIdx(0);
    setIsFlipped(false);
  }, [filteredVocab, activeTab]);

  // 플래시카드 활성화 시 퀴즈 초기화 및 탭 전환 대응
  useEffect(() => {
    if (activeTab === 'quiz' && filteredVocab.length >= 4) {
      generateQuiz();
    }
  }, [activeTab, filteredVocab.length, generateQuiz]);

  // 단어장의 카테고리 리스트 (전체, 미분류, 유저 커스텀 카테고리)
  const topicsWithWords = ['all', '', ...customCategories];

  // 🔊 TTS 한국어 발음 목소리 재생 기능
  const speakWord = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      window.speechSynthesis.speak(utterance);
    }
  };

  // 📥 Anki 호환용 CSV 파일 추출 및 즉시 다운로드 기능
  const exportToAnkiCSV = () => {
    if (vocab.length === 0) return;
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    
    let csvContent = '\uFEFF'; // MS Excel 등 한글 깨짐 방지용 UTF-8 BOM 주입
    vocab.forEach(entry => {
      const front = `${entry.word} [${entry.pronunciation}]<br><small>${entry.partOfSpeech}</small>`;
      const examplesHtml = entry.examples && entry.examples.length > 0 
        ? `<hr>${entry.examples.map(ex => `• ${ex.korean} : ${ex.translation}`).join('<br>')}`
        : '';
      const back = `${entry.definition}<br><em style="color: var(--accent-primary); font-weight: 600;">${entry.translation}</em>${examplesHtml}`;
      csvContent += `${escapeCsv(front)},${escapeCsv(back)}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `koreading_anki_${new Date().toLocaleDateString('sv')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🧩 퀴즈 정답 제출 이벤트 핸들러
  const handleSelectAnswer = (option: string) => {
    if (selectedAnswer !== null || !quizQuestion) return;
    setSelectedAnswer(option);
    
    const correct = option === quizQuestion.translation;
    setIsCorrect(correct);
    setQuizScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  // 단어 목록 다운로드 완료 대기 화면
  if (authLoading || loading || !user) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  if (loadError) return (
    <div className="container" role="alert" style={{ padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '16px' }}>{t.title}</h1>
      <p style={{ marginBottom: '20px' }}>{loadError}</p>
      <button type="button" className="btn btn-primary" onClick={() => setRetryKey(key => key + 1)}>Retry / 다시 시도</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container">
        {categoryError && (
          <div role="alert" className="card" style={{ marginBottom: '16px' }}>
            카테고리를 불러오지 못했습니다. 단어 목록은 이용할 수 있습니다. / Categories could not be loaded.
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: '12px' }} onClick={() => setRetryKey(key => key + 1)}>Retry / 다시 시도</button>
          </div>
        )}
        {/* 상단 제목 헤더 및 안키 CSV 내보내기 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>{t.title}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t.savedWords}<strong style={{ color: 'var(--text-primary)' }}>{vocab.length}{t.wordUnit}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.85rem',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {t.manageCategories}
            </button>
            {vocab.length > 0 && (
              <button
                onClick={exportToAnkiCSV}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.85rem',
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {t.exportAnki}
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className="card"
          onClick={startReviewSession}
          style={{ width: '100%', textAlign: 'left', marginBottom: '24px', padding: '18px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}
          aria-label={`${t.reviewToday}: ${t.reviewDue.replace('{count}', Math.min(dueVocab.length, 5).toString())}`}
        >
          <span>
            <strong style={{ display: 'block', marginBottom: '4px' }}>{t.reviewToday}</strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {dueVocab.length === 0 ? t.reviewEmpty : t.reviewDue.replace('{count}', Math.min(dueVocab.length, 5).toString())}
            </span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--accent-primary)', fontWeight: 900 }}>→</span>
        </button>

        {/* [복습 모드 활성화를 위한 신규 탭 메뉴 바] */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '32px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'list', label: t.tabList },
            { id: 'review', label: t.tabReview },
            { id: 'flashcard', label: t.tabFlashcard },
            { id: 'quiz', label: t.tabQuiz }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'review' ? startReviewSession() : setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2.5px solid var(--accent-primary)' : '2.5px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                padding: '12px 20px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 200ms ease',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 토픽 분류 뱃지 필터 바 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {topicsWithWords.map(topic => {
            let label = '';
            let count = 0;
            if (topic === 'all') {
              label = t.allTopics;
              count = vocab.length;
            } else if (topic === '') {
              label = uiLang === 'ko' ? '📁 미분류' : 
                      uiLang === 'ja' ? '📁 未分類' :
                      uiLang === 'zh' ? '📁 未分类' :
                      uiLang === 'es' ? '📁 Sin clasificar' :
                      '📁 Uncategorized';
              count = vocab.filter(v => isUncategorized(v.topic)).length;
            } else {
              label = `📁 ${topic}`;
              count = vocab.filter(v => v.topic === topic).length;
            }

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
                {label}
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

        {/* ─── 탭 1: 단어 목록 뷰 ─── */}
        {activeTab === 'list' && (
          filteredVocab.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <div className="empty-state-title">{t.emptyTitle}</div>
              <div className="empty-state-desc">{t.emptyDesc}</div>
              <a href="/library" className="btn btn-primary mt-4">{t.toLibrary}</a>
            </div>
          ) : (
            <div className="grid-4" style={{ '--grid-cols': '4' } as React.CSSProperties}>
              {filteredVocab.map(entry => {
                const topicInfo = TOPICS.find(t => t.id === entry.topic);
                return (
                  <div
                    key={entry.id}
                    className="card"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className={`level-badge level-${entry.level}`}>{entry.level}</span>
                        {entry.topic && customCategories.includes(entry.topic) && (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(217,119,6,0.1)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: '4px', color: 'var(--accent-primary)', fontWeight: 600 }}>📁 {entry.topic}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteWord(entry.id)}
                        aria-label={`${t.deleteBtn}: ${entry.word}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0 4px',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title={t.deleteBtn}
                      >
                        ✕
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      aria-label={`${entry.word} — ${entry.translation}`}
                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', color: 'inherit' }}
                    >
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
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ─── 오늘의 간격 반복 복습 ─── */}
        {activeTab === 'review' && (
          reviewQueue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🧠</div>
              <div className="empty-state-title">{t.reviewComplete}</div>
              <div className="empty-state-desc">{t.reviewEmpty}</div>
              <a href="/library" className="btn btn-primary mt-4">{t.toLibrary}</a>
            </div>
          ) : reviewIdx >= reviewQueue.length ? (
            <div className="card" style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', padding: '40px 28px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✓</div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{t.reviewComplete}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                {reviewSession.remembered} / {reviewSession.total}
              </p>
              <a href="/library" className="btn btn-primary" style={{ justifyContent: 'center' }}>{t.toLibrary}</a>
            </div>
          ) : reviewEntry ? (
            <div style={{ maxWidth: '620px', margin: '0 auto', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <span>{t.reviewToday}</span>
                <strong>{reviewIdx + 1} / {reviewQueue.length}</strong>
              </div>
              <div className="card" style={{ padding: '32px 26px', textAlign: 'center' }}>
                {reviewEntry.sourceSentence ? (
                  <>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 700, marginBottom: '12px' }}>{t.reviewContext}</div>
                    <p lang="ko" style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: '1.2rem', lineHeight: 1.9, margin: '0 0 18px' }}>{reviewPrompt}</p>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', margin: '0 0 18px' }}>{t.quizQuestionDesc}</p>
                )}

                {!reviewRevealed ? (
                  <button type="button" className="btn btn-primary" onClick={() => setReviewRevealed(true)}>{t.reviewReveal}</button>
                ) : (
                  <div role="status" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                    <h2 lang="ko" style={{ fontSize: '2rem', marginBottom: '6px' }}>{reviewEntry.word}</h2>
                    <p style={{ color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '8px' }}>{reviewEntry.translation}</p>
                    <p lang="ko" style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '18px' }}>{reviewEntry.definition}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <button type="button" className="btn btn-secondary" disabled={reviewSaving} onClick={() => void handleReviewGrade(false)}>{t.reviewAgain}</button>
                      <button type="button" className="btn btn-primary" disabled={reviewSaving} onClick={() => void handleReviewGrade(true)}>{t.reviewRemembered}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null
        )}

        {/* ─── 탭 2: 3D 플래시카드 학습 ─── */}
        {activeTab === 'flashcard' && (
          shuffledVocab.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎴</div>
              <div className="empty-state-title">{t.noFlashcardTitle}</div>
              <div className="empty-state-desc">{t.noFlashcardDesc}</div>
            </div>
          ) : (
            <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 3D 회전 카드 메인 컴포넌트 */}
              <div 
                className={`flashcard-container ${isFlipped ? 'is-flipped' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
                role="button"
                tabIndex={0}
                aria-label={`${shuffledVocab[cardIdx].word}: ${t.flipCard}`}
                aria-pressed={isFlipped}
                onKeyDown={e => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsFlipped(flipped => !flipped); }
                }}
              >
                <div className="flashcard-inner">
                  {/* 카드 앞면 (단어 + 로마자 발음 표기 + TTS 버튼) */}
                  <div className="flashcard-front">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', position: 'absolute', top: '20px' }}>
                      CEFR {shuffledVocab[cardIdx].level}
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '8px', color: 'var(--text-primary)' }}>
                      {shuffledVocab[cardIdx].word}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                      [{shuffledVocab[cardIdx].pronunciation}]
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); speakWord(shuffledVocab[cardIdx].word); }}
                      style={{
                        background: 'rgba(217,119,6,0.1)', border: 'none', color: 'var(--accent-primary)',
                        width: '44px', height: '44px', borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem'
                      }}
                      title={t.listen}
                    >
                      🔊
                    </button>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', position: 'absolute', bottom: '20px' }}>
                      {t.flipCard}
                    </div>
                  </div>

                  {/* 카드 뒷면 (품사 + 뜻 + 번역 + 예제 문장) */}
                  <div className="flashcard-back">
                    <span className="word-popup-pos" style={{ marginBottom: '10px' }}>{shuffledVocab[cardIdx].partOfSpeech}</span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '8px', textAlign: 'center' }}>
                      {shuffledVocab[cardIdx].translation}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px', fontFamily: 'Noto Sans KR, sans-serif', lineHeight: 1.5 }}>
                      {shuffledVocab[cardIdx].definition}
                    </p>
                    {shuffledVocab[cardIdx].examples && shuffledVocab[cardIdx].examples.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', width: '100%', textAlign: 'left' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>{t.examplesTitle}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 600 }}>
                          {shuffledVocab[cardIdx].examples[0].korean}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {shuffledVocab[cardIdx].examples[0].translation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 하단 카드 네비게이터 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  className="btn btn-secondary"
                  disabled={cardIdx === 0}
                  onClick={() => { setCardIdx(prev => prev - 1); setIsFlipped(false); }}
                  style={{ padding: '10px 16px' }}
                >
                  {t.prev}
                </button>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <strong>{cardIdx + 1}</strong> / {shuffledVocab.length}
                </div>
                <button
                  className="btn btn-secondary"
                  disabled={cardIdx === shuffledVocab.length - 1}
                  onClick={() => { setCardIdx(prev => prev + 1); setIsFlipped(false); }}
                  style={{ padding: '10px 16px' }}
                >
                  {t.next}
                </button>
              </div>

              {/* 무작위 카드 셔플 섞기 단추 */}
              <button 
                className="btn btn-secondary"
                onClick={handleShuffleCards}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {t.shuffle}
              </button>
            </div>
          )
        )}

        {/* ─── 탭 3: 미니 퀴즈 복습 뷰 ─── */}
        {activeTab === 'quiz' && (
          filteredVocab.length < 4 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🧩</div>
              <div className="empty-state-title">{t.quizNotEnoughTitle}</div>
              <div className="empty-state-desc">
                {t.quizNotEnoughDesc.replace('{count}', filteredVocab.length.toString())}
              </div>
              <a href="/library" className="btn btn-primary mt-4">{t.toLibrary}</a>
            </div>
          ) : (
            quizQuestion && (
              <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 퀴즈 헤더: 스코어 정보 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t.quizTitle}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                    {t.quizScore}{quizScore.correct} / {quizScore.total}
                  </span>
                </div>

                {/* 퀴즈 문제 카드 */}
                <div className="card text-center" style={{ padding: '40px 24px', position: 'relative' }}>
                  <span className={`level-badge level-${quizQuestion.level}`} style={{ position: 'absolute', top: '20px', left: '20px' }}>
                    {quizQuestion.level}
                  </span>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'Noto Sans KR, sans-serif', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {quizQuestion.word}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {t.quizQuestionDesc}
                  </p>
                </div>

                {/* 4지선다형 옵션 버튼 그룹 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {quizOptions.map((option, i) => {
                    const isSelected = selectedAnswer === option;
                    const isAnswerCorrect = option === quizQuestion.translation;
                    
                    let btnBorder = '1px solid var(--border-subtle)';
                    let btnBg = 'var(--bg-card)';
                    let btnColor = 'var(--text-primary)';

                    if (selectedAnswer !== null) {
                      if (isAnswerCorrect) {
                        btnBg = 'rgba(16,185,129,0.15)'; // 맞은 옵션은 녹색 배경
                        btnBorder = '1.5px solid #10b981';
                        btnColor = '#10b981';
                      } else if (isSelected) {
                        btnBg = 'rgba(239,68,68,0.15)';   // 고른 오답은 붉은색 배경
                        btnBorder = '1.5px solid #ef4444';
                        btnColor = '#ef4444';
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectAnswer(option)}
                        disabled={selectedAnswer !== null}
                        style={{
                          width: '100%',
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-md)',
                          background: btnBg,
                          border: btnBorder,
                          color: btnColor,
                          textAlign: 'left',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          cursor: selectedAnswer === null ? 'pointer' : 'default',
                          transition: 'all 150ms ease',
                          fontFamily: 'inherit',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>{option}</span>
                        {selectedAnswer !== null && isAnswerCorrect && <span>{t.quizCorrect}</span>}
                        {selectedAnswer !== null && isSelected && !isAnswerCorrect && <span>{t.quizIncorrect}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* 다음 문제 단추 */}
                {selectedAnswer !== null && (
                  <button
                    className="btn btn-primary"
                    onClick={generateQuiz}
                    style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
                  >
                    {t.quizNext}
                  </button>
                )}
              </div>
            )
          )
        )}
      </div>

      {/* 카테고리 관리 모달 */}
      {showCategoryModal && (
        <div
          className="word-popup-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCategoryModal(false); }}
        >
          <div className="word-popup" style={{ maxWidth: '450px', width: '90%' }}>
            <div className="word-popup-header">
              <div className="word-popup-word" style={{ fontSize: '1.25rem' }}>{t.categoryTitle}</div>
              <button className="word-popup-close" onClick={() => setShowCategoryModal(false)}>✕</button>
            </div>

            <div style={{ margin: '16px 0' }}>
              {/* 카테고리 추가 폼 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t.newCategoryPlaceholder}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory();
                  }}
                />
                <button
                  onClick={handleAddCategory}
                  className="btn btn-primary"
                  style={{ padding: '10px 16px', fontSize: '0.9rem' }}
                >
                  {t.addCategory}
                </button>
              </div>

              {/* 커스텀 카테고리 목록 */}
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customCategories.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', margin: '20px 0' }}>
                    생성된 커스텀 카테고리가 없습니다.
                  </p>
                ) : (
                  customCategories.map((cat, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>📁 {cat}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          padding: '4px',
                        }}
                        title={t.deleteBtn}
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 선택된 단어가 있을 때 화면 전체를 덮어 상세 정보를 정밀하게 제공하는 상세 팝업 모달 */}
      {selectedEntry && (
        <div
          className="word-popup-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEntry(null); }} // 오버레이 클릭 시 닫힘
        >
          <div className="word-popup">
            <div className="word-popup-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="word-popup-word">{selectedEntry.word}</div>
                  <button
                    onClick={() => speakWord(selectedEntry.word)}
                    style={{
                      background: 'rgba(217,119,6,0.1)',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      transition: 'all 0.2s ease',
                    }}
                    title={t.listen}
                  >
                    🔊
                  </button>
                </div>
                <div className="word-popup-pronunciation">[{selectedEntry.pronunciation}]</div>
              </div>
              <button className="word-popup-close" onClick={() => setSelectedEntry(null)}>✕</button>
            </div>

            <span className="word-popup-pos">{selectedEntry.partOfSpeech}</span>

            {/* 한국어 정의 */}
            <div className="word-popup-section">
              <div className="word-popup-section-title">{t.definitionTitle}</div>
              <div className="word-popup-definition">{selectedEntry.definition}</div>
            </div>

            {/* 번역 결과 */}
            <div className="word-popup-section">
              <div className="word-popup-section-title">{t.translationTitle}</div>
              <div className="word-popup-translation">{selectedEntry.translation}</div>
            </div>

            {/* 예문 및 번역 */}
            <div className="word-popup-section">
              <div className="word-popup-section-title">{t.examplesSectionTitle}</div>
              {selectedEntry.examples?.map((ex, i) => (
                <div key={i} className="word-popup-example">
                  <div className="word-popup-example-korean">{ex.korean}</div>
                  <div className="word-popup-example-translation">{ex.translation}</div>
                </div>
              ))}
            </div>

            {/* 레벨 배지 및 기사 출처 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`level-badge level-${selectedEntry.level}`}>{selectedEntry.level}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t.origin}{selectedEntry.articleTitle}
                </span>
                {selectedEntry.topic && !TOPICS.some(t => t.id === selectedEntry.topic) && (
                  <span style={{ fontSize: '0.75rem', background: 'var(--border-subtle)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>📁 {selectedEntry.topic}</span>
                )}
              </div>
              <button
                onClick={() => handleDeleteWord(selectedEntry.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent-primary)',
                  background: 'none',
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--accent-primary)';
                }}
              >
                🗑️ {t.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
