'use client';

import { useState } from 'react';
import type { ComprehensionQuestion, DifficultyFeedback } from '@/lib/db';

interface Props {
  questions: ComprehensionQuestion[];
  difficultyFeedback: DifficultyFeedback | null;
  onSubmit: (answers: number[], score: number) => Promise<void>;
  onDifficultyChange: (feedback: DifficultyFeedback) => Promise<void>;
  onReviewParagraph: (paragraphIndex: number) => void;
}

const KIND_LABELS: Record<ComprehensionQuestion['kind'], string> = {
  main: '핵심 내용',
  detail: '세부 내용',
  vocabulary: '핵심 어휘',
};

export default function ComprehensionQuizCard({ questions, difficultyFeedback, onSubmit, onDifficultyChange, onReviewParagraph }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (questions.length !== 3) return null;

  const handleSubmit = async () => {
    if (answers.some(answer => answer === null) || saving) return;
    const resolved = answers as number[];
    const nextScore = resolved.reduce((total, answer, index) => total + (answer === questions[index].correct ? 1 : 0), 0);
    setScore(nextScore);
    setSubmitted(true);
    setSaving(true);
    setSaveError('');
    try {
      await onSubmit(resolved, nextScore);
    } catch {
      setSaveError('결과는 확인할 수 있지만 학습 기록 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
    setScore(0);
    setSaveError('');
  };

  return (
    <section className="card" aria-labelledby="comprehension-quiz-title" style={{ marginBottom: 32, padding: '28px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ color: 'var(--accent-primary)', fontSize: '.78rem', fontWeight: 800, letterSpacing: '.08em', marginBottom: 6 }}>LEARNING CHECK</div>
        <h2 id="comprehension-quiz-title" style={{ fontSize: '1.25rem', margin: 0 }}>읽은 내용을 확인해 보세요</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', margin: '8px 0 0' }}>세 문항을 풀고, 틀린 문제는 근거가 있는 문단으로 바로 돌아갈 수 있습니다.</p>
      </div>

      <div style={{ display: 'grid', gap: 22 }}>
        {questions.map((question, questionIndex) => {
          const selected = answers[questionIndex];
          const correct = submitted && selected === question.correct;
          return (
            <fieldset key={`${question.kind}-${questionIndex}`} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 800, lineHeight: 1.6, marginBottom: 10 }}>
                <span style={{ color: 'var(--accent-primary)', fontSize: '.76rem', marginRight: 8 }}>{questionIndex + 1}. {KIND_LABELS[question.kind]}</span>
                {question.question}
              </legend>
              <div style={{ display: 'grid', gap: 8 }}>
                {question.options.map((option, optionIndex) => {
                  const isSelected = selected === optionIndex;
                  const isCorrectAnswer = submitted && optionIndex === question.correct;
                  const isWrongSelection = submitted && isSelected && optionIndex !== question.correct;
                  return (
                    <label key={optionIndex} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isCorrectAnswer ? '#10b981' : isWrongSelection ? '#ef4444' : isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      background: isCorrectAnswer ? 'rgba(16,185,129,.08)' : isWrongSelection ? 'rgba(239,68,68,.06)' : 'var(--bg-secondary)',
                      cursor: submitted ? 'default' : 'pointer',
                    }}>
                      <input
                        type="radio"
                        name={`quiz-${questionIndex}`}
                        value={optionIndex}
                        checked={isSelected}
                        disabled={submitted}
                        onChange={() => setAnswers(previous => previous.map((answer, index) => index === questionIndex ? optionIndex : answer))}
                      />
                      <span lang="ko">{option}</span>
                    </label>
                  );
                })}
              </div>
              {submitted && (
                <div role="status" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: correct ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)' }}>
                  <strong>{correct ? '정답입니다.' : '다시 확인해 보세요.'}</strong>
                  <div lang="ko" style={{ marginTop: 4, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{question.explanation}</div>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => onReviewParagraph(question.paragraphIndex)}>
                    관련 문단 다시 보기
                  </button>
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      {!submitted ? (
        <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }} disabled={answers.some(answer => answer === null) || saving} onClick={() => void handleSubmit()}>
          {saving ? '저장 중…' : '정답 확인'}
        </button>
      ) : (
        <div style={{ marginTop: 24 }}>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05rem', marginBottom: 12 }}>이해도 {score} / {questions.length}</div>
          {saveError && <p role="alert" style={{ color: '#ef4444', textAlign: 'center', fontSize: '.82rem' }}>{saveError}</p>}
          <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={reset}>다시 풀기</button>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 26, paddingTop: 20 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>이 글의 난이도는 어땠나요?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([
            ['easy', '쉬워요'],
            ['just-right', '적당해요'],
            ['hard', '어려워요'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm ${difficultyFeedback === value ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={difficultyFeedback === value}
              onClick={() => void onDifficultyChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
