'use client';
import { useEffect, useRef, useState } from 'react';
import { callAI, type CEFRLevel, type NativeLanguage } from '@/lib/gemini';

interface Message { role: 'user' | 'model'; parts: { text: string }[] }
export interface TutorSelection { index: number; text: string }
interface Props {
  selected: TutorSelection | null; onClose: () => void;
  language: NativeLanguage; level: CEFRLevel;
  labels: { tutorTitle: string; tutorPlaceholder: string; tutorIntro: string; qTranslate: string; qGrammar: string; qVocab: string; qNuance: string };
}
export default function TutorPanel({ selected, onClose, language, level, labels }: Props) {
  const [input, setInput] = useState('');
  const [chats, setChats] = useState<Record<number, Message[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { generation.current++; setChats({}); setError(''); const state = generation; return () => { state.current++; }; }, [language, level]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [chats, selected]);
  const send = async (message: string) => {
    if (!selected || lock.current || !message.trim()) return;
    lock.current = true; setBusy(true); setError('');
    const epoch = generation.current;
    const index = selected.index;
    const history = chats[index] || [];
    const userMessage: Message = { role: 'user', parts: [{ text: message.trim() }] };
    try {
      const result = await callAI<{ text: string }>({ action: 'tutorChat', level, nativeLang: language, paragraph: selected.text.slice(0, 5000), userMessage: message.trim(), chatHistory: history.slice(-6).map(m => ({ ...m, parts: [{ text: m.parts[0].text.slice(0, 2500) }] })) });
      if (epoch === generation.current) {
        setChats(prev => ({ ...prev, [index]: [...history, userMessage, { role: 'model', parts: [{ text: result.text }] }] }));
        setInput('');
      }
    } catch (e) { if (epoch === generation.current) setError(e instanceof Error ? e.message : 'Please retry'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <aside className={`reader-tutor-sidebar ${selected ? 'open' : ''}`} aria-label={labels.tutorTitle} aria-hidden={!selected}>
    {selected && <>
      <div className="tutor-header"><h2>{labels.tutorTitle}</h2><button aria-label="Close tutor" onClick={onClose}>✕</button></div>
      <div className="tutor-messages" aria-live="polite">
        <p>{labels.tutorIntro}</p>
        <blockquote>{selected.text}</blockquote>
        <div className="tutor-quick-actions">{[labels.qTranslate, labels.qGrammar, labels.qVocab, labels.qNuance].map(label => <button key={label} className="tutor-quick-badge" disabled={busy} onClick={() => send(label)}>{label}</button>)}</div>
        {(chats[selected.index] || []).map((message, i) => <div key={i} className={`tutor-bubble ${message.role === 'user' ? 'user' : 'tutor'}`} style={{ whiteSpace: 'pre-wrap' }}>{message.parts[0].text}</div>)}
        {busy && <p role="status">답변을 준비하고 있습니다… / Preparing an answer…</p>}
        {error && <p role="alert">{error}</p>}
        <div ref={end} />
      </div>
      <form className="tutor-input-form" onSubmit={e => { e.preventDefault(); void send(input); }}>
        <textarea aria-label={labels.tutorPlaceholder} className="tutor-textarea" maxLength={1000} value={input} onChange={e => setInput(e.target.value)} placeholder={labels.tutorPlaceholder} />
        <button className="tutor-send-btn" disabled={busy || !input.trim()} type="submit" aria-label="Send question">➤</button>
      </form>
    </>}
  </aside>;
}
