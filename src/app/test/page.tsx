'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { generatePlacementTest } from '@/lib/gemini';
import { createOrUpdateUser } from '@/lib/db';

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface Question {
  question: string;
  options: string[];
  correct: number;
}

interface LevelTest {
  level: string;
  text: string;
  questions: Question[];
}

interface TestData {
  levels: LevelTest[];
}

export default function TestPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<'intro' | 'loading' | 'testing' | 'done'>('intro');
  const [testData, setTestData] = useState<TestData | null>(null);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [resultLevel, setResultLevel] = useState<Level | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  const loadTest = async () => {
    setStep('loading');
    try {
      const data = await generatePlacementTest();
      setTestData(data);
      setStep('testing');
    } catch (err) {
      console.error(err);
      setStep('intro');
      alert('테스트 로딩에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const getCurrentLevel = () => testData?.levels[currentLevelIdx];

  const handleAnswer = (optionIdx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optionIdx);

    const level = getCurrentLevel();
    if (!level) return;

    const q = level.questions[currentQIdx];
    const isCorrect = optionIdx === q.correct;
    const levelAnswers = answers[level.level] || [];
    const newAnswers = { ...answers, [level.level]: [...levelAnswers, isCorrect ? 1 : 0] };
    setAnswers(newAnswers);

    setTimeout(() => {
      setSelectedAnswer(null);
      if (currentQIdx + 1 < level.questions.length) {
        setCurrentQIdx(prev => prev + 1);
      } else {
        // Move to next level or finish
        if (currentLevelIdx + 1 < (testData?.levels.length || 0)) {
          setCurrentLevelIdx(prev => prev + 1);
          setCurrentQIdx(0);
        } else {
          // Calculate result
          const level = calculateLevel(newAnswers);
          setResultLevel(level);
          setShowResult(true);
          setStep('done');
        }
      }
    }, 800);
  };

  const calculateLevel = (allAnswers: Record<string, number[]>): Level => {
    const levels: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    let lastPassed = 0;
    for (let i = 0; i < levels.length - 1; i++) {
      const lvl = levels[i];
      const ans = allAnswers[lvl] || [];
      const score = ans.reduce((a, b) => a + b, 0) / (ans.length || 1);
      if (score >= 0.5) lastPassed = i + 1;
    }
    return levels[Math.min(lastPassed, levels.length - 1)];
  };

  const saveResult = async () => {
    if (!user || !resultLevel) return;
    setSaving(true);
    await createOrUpdateUser(user.uid, { level: resultLevel });
    await refreshProfile();
    setSaving(false);
    router.push('/library');
  };

  const currentLevel = getCurrentLevel();
  const totalLevels = testData?.levels.length || 5;
  const progress = testData ? ((currentLevelIdx * 2 + currentQIdx) / (totalLevels * 2)) * 100 : 0;

  const LEVEL_COLORS: Record<string, string> = {
    A1: '#10b981', A2: '#06b6d4', B1: '#818cf8', B2: '#a78bfa', C1: '#fbbf24', C2: '#fb7185',
  };

  if (step === 'intro') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🎯</div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '16px' }}>레벨 테스트</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '40px' }}>
          간단한 읽기 테스트로 당신의 한국어 수준을 파악합니다.
          A1부터 C1까지 각 레벨의 짧은 텍스트를 읽고 질문에 답해주세요.
          약 10분 정도 소요됩니다.
        </p>
        <div className="grid-3" style={{ marginBottom: '40px', gap: '12px' }}>
          {(['A1','A2','B1','B2','C1','C2'] as Level[]).map(lvl => (
            <div key={lvl} className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <span className={`level-badge level-${lvl}`}>{lvl}</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                {{
                  A1:'입문',A2:'초급',B1:'중급',B2:'중상급',C1:'고급',C2:'최고급'
                }[lvl]}
              </div>
            </div>
          ))}
        </div>
        <button id="start-test-btn" onClick={loadTest} className="btn btn-primary btn-lg">
          테스트 시작하기 →
        </button>
      </div>
    </div>
  );

  if (step === 'loading') return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
      <p style={{ color: 'var(--text-secondary)' }}>AI가 테스트를 준비하고 있습니다...</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>약 10-20초 소요</p>
    </div>
  );

  if (step === 'done' && resultLevel) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '5rem', marginBottom: '24px' }}>🎉</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '16px' }}>테스트 완료!</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>당신의 한국어 읽기 레벨은:</p>

        <div style={{
          fontSize: '5rem',
          fontWeight: 900,
          color: LEVEL_COLORS[resultLevel] || 'var(--accent-primary)',
          marginBottom: '8px',
          filter: 'drop-shadow(0 0 30px currentColor)',
        }}>
          {resultLevel}
        </div>

        <div style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '1.1rem' }}>
          {{
            A1:'입문 (Beginner)',
            A2:'초급 (Elementary)',
            B1:'중급 (Intermediate)',
            B2:'중상급 (Upper Intermediate)',
            C1:'고급 (Advanced)',
            C2:'최고급 (Mastery)',
          }[resultLevel]}
        </div>

        <div className="card" style={{ marginBottom: '24px', textAlign: 'left' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            이 레벨에 맞는 한국어 텍스트를 추천해 드릴게요.
            현재 수준보다 약간 높은 어휘가 포함된 i+1 원리의 텍스트로
            자연스럽게 실력을 향상시켜 보세요!
          </p>
        </div>

        <button
          id="save-level-btn"
          onClick={saveResult}
          disabled={saving}
          className="btn btn-primary btn-lg"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {saving ? '저장 중...' : '내 레벨 저장하고 시작하기 →'}
        </button>
      </div>
    </div>
  );

  if (!currentLevel) return null;
  const currentQ = currentLevel.questions[currentQIdx];

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container" style={{ maxWidth: '700px' }}>
        {/* Progress */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>레벨 {currentLevelIdx + 1}/{totalLevels}</span>
            <span>질문 {currentQIdx + 1}/{currentLevel.questions.length}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Level badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <span className={`level-badge level-${currentLevel.level}`}>{currentLevel.level}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>읽기 텍스트</span>
        </div>

        {/* Text */}
        <div className="card" style={{ marginBottom: '32px', lineHeight: 2.2, fontSize: '1.1rem' }}>
          <p className="korean-text" style={{ color: 'var(--text-primary)' }}>
            {currentLevel.text}
          </p>
        </div>

        {/* Question */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>
            {currentQIdx + 1}. {currentQ.question}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentQ.options.map((option, idx) => {
              let bg = 'var(--bg-card)';
              let border = 'var(--border-subtle)';
              let color = 'var(--text-primary)';

              if (selectedAnswer !== null) {
                if (idx === currentQ.correct) {
                  bg = 'rgba(16,185,129,0.15)';
                  border = 'rgba(16,185,129,0.5)';
                  color = '#10b981';
                } else if (idx === selectedAnswer) {
                  bg = 'rgba(244,63,94,0.15)';
                  border = 'rgba(244,63,94,0.5)';
                  color = '#fb7185';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 20px',
                    textAlign: 'left',
                    color,
                    cursor: selectedAnswer !== null ? 'default' : 'pointer',
                    transition: 'all 200ms ease',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                  }}
                >
                  {String.fromCharCode(65 + idx)}. {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
