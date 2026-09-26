'use client';

import { useState } from 'react';
import { callAI, type CEFRLevel, type NativeLanguage, type WritingFeedbackResult } from '@/lib/gemini';

interface Props {
  prompt: string;
  level: CEFRLevel;
  language: NativeLanguage;
}

export default function WritingPracticeCard({ prompt, level, language }: Props) {
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedbackResult | null>(null);
  const [rewrite, setRewrite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (response: string) => {
    const clean = response.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await callAI<WritingFeedbackResult>({ action: 'writingFeedback', level, nativeLang: language, prompt, response: clean });
      setFeedback(result);
      setRewrite(clean);
    } catch (e) {
      setError(e instanceof Error ? e.message : '피드백을 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="writing-practice-title" style={{ marginBottom: 32, padding: '26px' }}>
      <div style={{ color: 'var(--accent-primary)', fontSize: '.78rem', fontWeight: 800, letterSpacing: '.08em', marginBottom: 6 }}>OUTPUT PRACTICE</div>
      <h2 id="writing-practice-title" style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>직접 써 보세요</h2>
      <p lang="ko" style={{ lineHeight: 1.7, margin: '0 0 16px', fontWeight: 650 }}>{prompt}</p>

      {!feedback ? (
        <>
          <textarea
            aria-label="한국어 쓰기 답변"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="여기에 직접 한국어로 써 보세요."
            style={{ width: '100%', resize: 'vertical', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit', lineHeight: 1.7 }}
          />
          <button type="button" className="btn btn-primary" disabled={busy || !draft.trim()} onClick={() => void submit(draft)} style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            {busy ? '피드백 확인 중…' : 'AI 피드백 받기'}
          </button>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{feedback.meaningClear ? '✓ 의미가 잘 전달됩니다' : '△ 의미를 조금 더 분명하게 만들 수 있어요'}</div>
            <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{feedback.feedback}</p>
          </div>
          {feedback.correction && (
            <div>
              <strong>한 곳만 고쳐보기</strong>
              <p lang="ko" style={{ margin: '6px 0', lineHeight: 1.7 }}>{feedback.correction}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{feedback.reason}</p>
            </div>
          )}
          {feedback.naturalExpression && <p style={{ margin: 0 }}><strong>더 자연스러운 표현:</strong> <span lang="ko">{feedback.naturalExpression}</span></p>}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <label htmlFor="writing-rewrite" style={{ display: 'block', fontWeight: 800, marginBottom: 8 }}>내 문장으로 다시 써보기</label>
            <textarea
              id="writing-rewrite"
              value={rewrite}
              onChange={e => setRewrite(e.target.value)}
              maxLength={2000}
              rows={4}
              style={{ width: '100%', resize: 'vertical', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit', lineHeight: 1.7 }}
            />
            <button type="button" className="btn btn-primary" disabled={busy || !rewrite.trim()} onClick={() => void submit(rewrite)} style={{ marginTop: 10 }}>
              {busy ? '확인 중…' : '다시 피드백 받기'}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" style={{ color: '#ef4444', marginTop: 12 }}>{error}</p>}
      <p style={{ color: 'var(--text-muted)', fontSize: '.75rem', margin: '12px 0 0' }}>작성한 문장은 이 연습 카드에서만 사용되며 학습 기록으로 저장하지 않습니다.</p>
    </section>
  );
}
