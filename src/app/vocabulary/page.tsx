'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getVocabulary, VocabularyEntry } from '@/lib/db';
import { TOPICS } from '@/lib/gemini';
import { getGuestLang, getGuestLevel } from '@/lib/storage';

// 다국어 번역 사전 정의
const TRANSLATIONS = {
  ko: {
    title: '📝 내 단어장',
    savedWords: '저장된 단어: ',
    wordUnit: '개',
    exportAnki: '📥 Anki용 CSV 내보내기',
    tabList: '📖 단어 목록',
    tabFlashcard: '🎴 플래시카드',
    tabQuiz: '🧩 미니 퀴즈',
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
  },
  en: {
    title: '📝 My Vocabulary',
    savedWords: 'Saved Words: ',
    wordUnit: '',
    exportAnki: '📥 Export CSV for Anki',
    tabList: '📖 Word List',
    tabFlashcard: '🎴 Flashcards',
    tabQuiz: '🧩 Mini Quiz',
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
  },
  es: {
    title: '📝 Mi Vocabulario',
    savedWords: 'Palabras guardadas: ',
    wordUnit: '',
    exportAnki: '📥 Exportar CSV para Anki',
    tabList: '📖 Lista de palabras',
    tabFlashcard: '🎴 Tarjetas',
    tabQuiz: '🧩 Mini cuestionario',
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
  },
  ja: {
    title: '📝 マイ単語帳',
    savedWords: '保存された単語: ',
    wordUnit: '個',
    exportAnki: '📥 Anki用CSV書き出し',
    tabList: '📖 単語一覧',
    tabFlashcard: '🎴 フラッシュカード',
    tabQuiz: '🧩 ミニクイズ',
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
  },
  zh: {
    title: '📝 我的单词本',
    savedWords: '已保存单词: ',
    wordUnit: '个',
    exportAnki: '📥 导出 Anki CSV',
    tabList: '📖 单词列表',
    tabFlashcard: '🎴 闪卡',
    tabQuiz: '🧩 迷你测试',
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
  }
};

// 사용자가 저장한 단어들을 목록 조회하고, 3D 플래시카드 및 미니 퀴즈 등으로 스마트 복습이 가능한 단어장(VocabularyPage) 컴포넌트입니다.
export default function VocabularyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // 사용자의 로그인 여부 및 레벨에 따른 UI 언어 선택
  const activeNativeLang = profile?.nativeLanguage || getGuestLang() || 'en';
  const getUiLang = (): 'en' | 'es' | 'ja' | 'zh' | 'ko' => {
    const level = profile?.level || getGuestLevel();
    if (!user) return activeNativeLang;
    if (level && ['C1', 'C2'].includes(level)) {
      return 'ko'; // C1, C2 레벨은 한국어로
    }
    return activeNativeLang; // A1, A2, B1, B2 레벨은 설정한 언어로
  };

  const uiLang = getUiLang();
  const t = TRANSLATIONS[uiLang];

  const [vocab, setVocab] = useState<VocabularyEntry[]>([]); // 유저가 등록한 단어장 원본 배열
  const [loading, setLoading] = useState(true);              // 로딩 중 상태 제어
  const [selectedTopic, setSelectedTopic] = useState<string>('all'); // 필터링을 위해 클릭된 현재 카테고리 주제
  const [selectedEntry, setSelectedEntry] = useState<VocabularyEntry | null>(null); // 목록 보기 팝업용 상세 단어 객체

  // [신규 기능 1] 탭 메뉴 상태 제어 ('list' | 'flashcard' | 'quiz')
  const [activeTab, setActiveTab] = useState<string>('list');

  // [신규 기능 2] 3D 플래시카드 관련 상태
  const [cardIdx, setCardIdx] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [shuffledVocab, setShuffledVocab] = useState<VocabularyEntry[]>([]);

  // [신규 기능 3] 미니 퀴즈 관련 상태
  const [quizQuestion, setQuizQuestion] = useState<VocabularyEntry | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  // 컴포넌트 마운트 시 로그인 여부를 검증하고, 유효한 계정이라면 Firestore에서 개인 단어장 데이터를 로딩합니다.
  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    getVocabulary(user.uid).then(v => {
      setVocab(v);
      setLoading(false);
    });
  }, [user, router]);

  // 사용자가 고른 상단 토픽 카테고리 필터에 맞추어 단어장 데이터를 필터링합니다.
  const filteredVocab = vocab.filter(entry =>
    selectedTopic === 'all' || entry.topic === selectedTopic
  );

  // 플래시카드 학습을 위해 필터링된 단어 목록을 초기화합니다.
  useEffect(() => {
    setShuffledVocab(filteredVocab);
    setCardIdx(0);
    setIsFlipped(false);
  }, [vocab, selectedTopic, activeTab]);

  // 플래시카드 활성화 시 퀴즈 초기화 및 탭 전환 대응
  useEffect(() => {
    if (activeTab === 'quiz' && filteredVocab.length >= 4) {
      generateQuiz();
    }
  }, [activeTab, selectedTopic]);

  // 저장되어 있는 단어들의 토픽 카테고리 ID들을 중복 없이 추출하여 필터 뱃지 리스트를 연산합니다.
  const topicsWithWords = ['all', ...Array.from(new Set(vocab.map(v => v.topic)))];

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
      const back = `${entry.definition}<br><em style="color: #6366f1; font-weight: 600;">${entry.translation}</em>${examplesHtml}`;
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

  // 🎴 플래시카드 무작위 셔플 기능
  const handleShuffleCards = () => {
    const shuffled = [...shuffledVocab].sort(() => Math.random() - 0.5);
    setShuffledVocab(shuffled);
    setCardIdx(0);
    setIsFlipped(false);
  };

  // 🧩 미니 퀴즈 문제 자동 생성기 (4지선다)
  const generateQuiz = () => {
    if (filteredVocab.length < 4) return;
    
    // 현재 필터링된 단어 중 정답 단어를 무작위 지정
    const answer = filteredVocab[Math.floor(Math.random() * filteredVocab.length)];
    
    // 오답용 풀 구성 (정답을 제외한 전체 단어 목록)
    const others = vocab.filter(v => v.id !== answer.id);
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
    
    const options = [answer.translation];
    for (let i = 0; i < Math.min(3, shuffledOthers.length); i++) {
      options.push(shuffledOthers[i].translation);
    }

    // 4개 선택지 무작위 셔플
    const shuffledOptions = options.sort(() => Math.random() - 0.5);

    setQuizQuestion(answer);
    setQuizOptions(shuffledOptions);
    setSelectedAnswer(null);
    setIsCorrect(null);
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
  if (loading) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container">
        {/* 상단 제목 헤더 및 안키 CSV 내보내기 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>{t.title}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {t.savedWords}<strong style={{ color: 'var(--text-primary)' }}>{vocab.length}{t.wordUnit}</strong>
            </p>
          </div>
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

        {/* [복습 모드 활성화를 위한 신규 탭 메뉴 바] */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '32px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'list', label: t.tabList },
            { id: 'flashcard', label: t.tabFlashcard },
            { id: 'quiz', label: t.tabQuiz }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
                {topicInfo ? `${topicInfo.emoji} ${topicInfo.label}` : t.allTopics}
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
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedEntry(entry)} // 클릭 시 상세 모달 오픈
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
          )
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
                        background: 'rgba(99,102,241,0.1)', border: 'none', color: 'var(--accent-primary)',
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
                      background: 'rgba(99,102,241,0.1)',
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
              <span className={`level-badge level-${selectedEntry.level}`}>{selectedEntry.level}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t.origin}{selectedEntry.articleTitle}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
