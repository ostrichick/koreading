'use client';

/**
 * @file page.tsx (test)
 * @description 신규 및 게스트 학습자의 한국어 독해 레벨을 진단하는 '인터랙티브 레벨테스트(Placement Test) 화면'입니다. 모국어를 설정한 후 단계를 밟아가며, 문제 오답률이 50%를 넘을 시 하위 레벨에서 즉각 조기 종료(Early Termination)되어 최종 추천 레벨을 진단 및 회원 프로필에 매핑합니다.
 * @why 학습자가 자신의 실제 실력에 맞지 않는 너무 쉽거나 어려운 텍스트로 인해 흥미를 잃지 않도록, 과학적인 독해력 측정 기준을 통해 맞춤형 레벨(A1~C2)의 시작점을 최단 시간에 지능적으로 제공하기 위해 존재합니다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { generatePlacementTest } from '@/lib/gemini';
import { createOrUpdateUser } from '@/lib/db';
import { setGuestLevel, setGuestLang, getGuestLang } from '@/lib/storage';
import type { NativeLanguage } from '@/lib/gemini';
import AlertModal from '@/components/AlertModal';

// CEFR 기반 레벨 타입 정의
type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// 텍스트 아래에 출제될 단일 질문 객체 인터페이스
interface Question {
  question: string; // 문제 질문 내용 (모국어로 번역되어 출력)
  options: string[];  // 보기 목록 (4지 선다형)
  correct: number;   // 정답인 보기의 인덱스 번호 (0 ~ 3)
}

// 레벨별 테스트 지문 구성
interface LevelTest {
  level: string;       // 질문 레벨 (A1, A2 등)
  text: string;        // 읽기 본문 한국어 텍스트
  questions: Question[]; // 본문에 귀속된 질문 목록
}

// AI로부터 수신한 전체 테스트 데이터셋 정의
interface TestData {
  levels: LevelTest[];
}

export default function TestPage() {
  const { user, refreshProfile } = useAuth(); // Auth 세션
  const router = useRouter();

  // 테스트 단계를 표현하는 상태 변수
  // intro: 모국어 선택 화면 | loading: AI 문제 생성 대기 | testing: 테스트 진행 | done: 결과 도출 및 저장 화면
  const [step, setStep] = useState<'intro' | 'lang' | 'loading' | 'testing' | 'done'>('intro');
  const [nativeLang, setNativeLang] = useState<NativeLanguage>(getGuestLang()); // 사용자가 선택한 모국어
  const [testData, setTestData] = useState<TestData | null>(null);             // 로드된 문제 데이터셋
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);                   // 현재 진척 중인 레벨의 인덱스
  const [answers, setAnswers] = useState<Record<string, number[]>>({});        // 각 레벨별 정불 판정 기록 (A1: [1, 0] 등)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);   // 현재 클릭한 임시 답안 인덱스
  const [currentQIdx, setCurrentQIdx] = useState(0);                           // 현재 레벨 내의 질문 일련번호
  const [resultLevel, setResultLevel] = useState<Level | null>(null);          // 최종 측정 완료된 학습자 레벨
  const [saving, setSaving] = useState(false);                                 // 저장 처리 로딩 유무

  // 알림 팝업 모달 상태 관리
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('알림');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'error' | 'warning' | 'success'>('info');

  // 모달 경고창을 화면에 토글하는 헬퍼 함수
  const triggerAlert = (message: string, title = '알림', type: 'info' | 'error' | 'warning' | 'success' = 'info') => {
    setAlertTitle(title);
    setAlertMsg(message);
    setAlertType(type);
    setAlertOpen(true);
  };

  // AI API(/api/ai)를 호출하여 맞춤형 레벨테스트 문제집을 생성합니다.
  const loadTest = async () => {
    setGuestLang(nativeLang); // 게스트 모국어 설정 반영
    setStep('loading');       // 로딩 화면 전환
    try {
      const data = await generatePlacementTest();
      setTestData(data);
      setStep('testing');      // 테스트 문제 화면 전환
    } catch (err: any) {
      setStep('intro');
      triggerAlert(`테스트 로딩 실패: ${err?.message || JSON.stringify(err)}`, '테스트 로딩 실패', 'error');
    }
  };

  // 현재 차례에 해당하는 레벨 테스트 객체를 꺼냅니다.
  const getCurrentLevel = () => testData?.levels[currentLevelIdx];

  // 보기 선지를 클릭했을 때 구동하는 정답 판별 및 흐름 처리 핸들러입니다.
  const handleAnswer = (optionIdx: number) => {
    if (selectedAnswer !== null) return; // 이미 보기를 선택해 결과를 대기 중인 상태라면 중복 연산 방지
    setSelectedAnswer(optionIdx);

    const level = getCurrentLevel();
    if (!level) return;

    const q = level.questions[currentQIdx];
    const isCorrect = optionIdx === q.correct; // 정답과 입력값 비교

    // 정답 기록(1: 맞춤, 0: 틀림)을 취합 및 업데이트
    const levelAnswers = answers[level.level] || [];
    const newAnswers = { ...answers, [level.level]: [...levelAnswers, isCorrect ? 1 : 0] };
    setAnswers(newAnswers);

    // 정답 피드백 색상을 보여주기 위해 0.8초 딜레이 타이머 작동
    setTimeout(() => {
      setSelectedAnswer(null); // 보기 선택 해제
      
      if (currentQIdx + 1 < level.questions.length) {
        // 아직 현재 지문에 질문이 남아있다면 다음 질문으로 진행
        setCurrentQIdx(prev => prev + 1);
      } else {
        // 현재 레벨의 모든 질문을 푼 경우, 통과 여부 검사 (해당 레벨 정답률 >= 50%)
        const currentLevelAnswers = newAnswers[level.level] || [];
        const score = currentLevelAnswers.reduce((a, b) => a + b, 0) / (currentLevelAnswers.length || 1);

        if (score < 0.5) {
          // [조기 종료 규칙] 만약 이번 레벨 통과 점수가 50% 미만이라면 즉각 테스트를 중지하고 결과를 매깁니다.
          const result = calculateLevel(newAnswers);
          setResultLevel(result);
          setStep('done');
        } else if (currentLevelIdx + 1 < (testData?.levels.length || 0)) {
          // 레벨을 성공적으로 넘겼고, 뒤에 상위 레벨 문제가 더 남아있다면 다음 레벨로 승급하여 계속 진행
          setCurrentLevelIdx(prev => prev + 1);
          setCurrentQIdx(0);
        } else {
          // 모든 최고 단계 레벨까지 전부 통과한 경우 종료
          const result = calculateLevel(newAnswers);
          setResultLevel(result);
          setStep('done');
        }
      }
    }, 800);
  };

  // 통과한 정답률 점수 기록들을 분석하여, 합격 기준을 충족한 가장 최상위의 한국어 레벨을 산출합니다.
  const calculateLevel = (allAnswers: Record<string, number[]>): Level => {
    const levels: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    let lastPassed = 0;
    for (let i = 0; i < levels.length - 1; i++) {
      const ans = allAnswers[levels[i]] || [];
      const score = ans.reduce((a, b) => a + b, 0) / (ans.length || 1);
      if (score >= 0.5) lastPassed = i + 1; // 50% 이상 맞췄다면 해당 레벨을 통과한 것으로 처리
    }
    return levels[Math.min(lastPassed, levels.length - 1)];
  };

  // 진단받은 결과를 영구 저장하고 도서관으로 넘어갑니다.
  const saveAndContinue = async () => {
    if (!resultLevel) return;
    setSaving(true);
    // 게스트용 로컬 스토리지에 레벨 및 모국어 기록
    setGuestLevel(resultLevel);
    setGuestLang(nativeLang);
    // 로그인된 정식 회원인 경우 Firestore의 사용자 문서 프로필 레벨 컬럼도 동시에 업데이트
    if (user) {
      await createOrUpdateUser(user.uid, { level: resultLevel, nativeLanguage: nativeLang });
      await refreshProfile();
    }
    setSaving(false);
    router.push('/library');
  };

  const totalLevels = testData?.levels.length || 5;
  const progress = testData ? ((currentLevelIdx * 2 + currentQIdx) / (totalLevels * 2)) * 100 : 0;
  const currentLevel = getCurrentLevel();

  // 레벨별 고유 배지 컬러 매핑
  const LEVEL_COLORS: Record<string, string> = {
    A1: '#10b981', A2: '#06b6d4', B1: '#818cf8', B2: '#a78bfa', C1: '#fbbf24', C2: '#fb7185',
  };

  // Step 1: 최초 인트로 및 모국어 선택 UI
  if (step === 'intro') return (
    <>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🌐</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '12px' }}>모국어를 선택해주세요</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>단어 번역에 사용됩니다</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '360px', margin: '0 auto 32px' }}>
            {[
              { value: 'en' as NativeLanguage, label: '🇺🇸 English' },
              { value: 'es' as NativeLanguage, label: '🇪🇸 Español' },
              { value: 'ja' as NativeLanguage, label: '🇯🇵 日本語' },
              { value: 'zh' as NativeLanguage, label: '🇨🇳 中文' },
            ].map(lang => (
              <button
                key={lang.value}
                onClick={() => setNativeLang(lang.value)}
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid',
                  borderColor: nativeLang === lang.value ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  background: nativeLang === lang.value ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  transition: 'all 200ms ease',
                  fontFamily: 'inherit',
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
          <button id="start-test-btn" onClick={loadTest} className="btn btn-primary btn-lg">
            레벨 테스트 시작 →
          </button>
          <p style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>로그인 없이 바로 시작합니다</p>
        </div>
      </div>
      <AlertModal
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMsg}
        type={alertType}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );

  // Step 2: AI 테스트 생성 대기 로딩 UI
  if (step === 'loading') return (
    <>
      <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>AI가 테스트를 준비하고 있습니다...</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>약 10~20초 소요</p>
      </div>
      <AlertModal
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMsg}
        type={alertType}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );

  // Step 3: 테스트 종료 및 판독된 한국어 레벨 확인 및 저장 UI
  if (step === 'done' && resultLevel) return (
    <>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '5rem', marginBottom: '24px' }}>🎉</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '16px' }}>테스트 완료!</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>당신의 한국어 읽기 레벨은:</p>
          <div style={{ fontSize: '5rem', fontWeight: 900, color: LEVEL_COLORS[resultLevel], marginBottom: '8px' }}>
            {resultLevel}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '1.1rem' }}>
            {{ A1: '입문', A2: '초급', B1: '중급', B2: '중상급', C1: '고급', C2: '최고급' }[resultLevel]}
          </div>
          <div className="card" style={{ marginBottom: '24px', textAlign: 'left', padding: '20px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
              이 레벨에 맞는 한국어 텍스트를 추천해 드릴게요.
              지금 바로 읽기를 시작할 수 있어요! (로그인 불필요)
            </p>
          </div>
          {/* E2E 테스트 클릭 단추를 위한 save-level-btn ID 포함 */}
          <button id="save-level-btn" onClick={saveAndContinue} disabled={saving} className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? '저장 중...' : '📚 읽기 시작하기 →'}
          </button>
        </div>
      </div>
      <AlertModal
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMsg}
        type={alertType}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );

  if (!currentLevel) return null;
  const currentQ = currentLevel.questions[currentQIdx];

  // Step 4: 인터랙티브 문제 풀이 카드 드로잉 화면
  return (
    <>
      <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
        <div className="container" style={{ maxWidth: '700px' }}>
          {/* 상단 진척도 바 */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>레벨 {currentLevelIdx + 1}/{totalLevels}</span>
              <span>질문 {currentQIdx + 1}/{currentLevel.questions.length}</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>

          {/* 지문 레벨 배지 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <span className={`level-badge level-${currentLevel.level}`}>{currentLevel.level}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>읽기 텍스트</span>
          </div>

          {/* 한국어 독해 텍스트 지문 */}
          <div className="card" style={{ marginBottom: '32px', lineHeight: 2.2, fontSize: '1.1rem' }}>
            <p className="korean-text">{currentLevel.text}</p>
          </div>

          {/* 오지선다 객관식 보기 리스트 */}
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>
              {currentQIdx + 1}. {currentQ.question}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentQ.options.map((option, idx) => {
                let bg = 'var(--bg-card)', border = 'var(--border-subtle)', color = 'var(--text-primary)';
                // 답변을 클릭해 판정이 진행 중일 때, 정답(녹색) 및 오답(분홍색) 하이라이트를 즉각 드로잉
                if (selectedAnswer !== null) {
                  if (idx === currentQ.correct) { bg = 'rgba(16,185,129,0.15)'; border = 'rgba(16,185,129,0.5)'; color = '#10b981'; }
                  else if (idx === selectedAnswer) { bg = 'rgba(244,63,94,0.15)'; border = 'rgba(244,63,94,0.5)'; color = '#fb7185'; }
                }
                return (
                  <button key={idx} onClick={() => handleAnswer(idx)} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 'var(--radius-md)', padding: '14px 20px', textAlign: 'left', color, cursor: selectedAnswer !== null ? 'default' : 'pointer', transition: 'all 200ms ease', fontSize: '0.9rem', fontFamily: 'inherit' }}>
                    {String.fromCharCode(65 + idx)}. {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <AlertModal
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMsg}
        type={alertType}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );
}

