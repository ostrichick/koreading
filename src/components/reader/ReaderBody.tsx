'use client';
import { Fragment, type MouseEvent } from 'react';
import { tokenizeKorean, isKoreanWord } from '@/lib/utils';
import ArticleIllustration from '@/components/ArticleIllustration';
import KakaoChatView from '@/components/reader/KakaoChatView';

type WordHandler = (event: MouseEvent, word: string, context: string) => void;
interface Props {
  paragraphs: string[];
  article: { title: string; genre?: string; imageUrls?: string[] };
  fontSize: string; lineHeight: number; savedWords: Set<string>;
  recordingParaIdx: number | null;
  paraScores: Record<number, { score: number; text: string }>;
  onWordClick: WordHandler; onWordEnter: WordHandler; onWordLeave: () => void;
  onSpeak: (text: string) => void;
  onTutor: (index: number, text: string) => void;
  onMic: (index: number, text: string) => void;
}
export default function ReaderBody(p: Props) {
  // 카톡 단톡방 장르이거나, 화자 대화 패턴([이름]: ...)이 다수 감지될 경우 카톡 비주얼 UI로 전환 (대안 2)
  const isChatStyle =
    p.article.genre === 'kakaotalk' ||
    p.paragraphs.filter(line => /^\[[^\]]+\]/.test(line.trim()) || /^[가-힣A-Za-z0-9_]{1,6}:/.test(line.trim())).length >= Math.max(2, Math.floor(p.paragraphs.length * 0.4));

  if (isChatStyle) {
    return (
      <KakaoChatView
        paragraphs={p.paragraphs}
        fontSize={p.fontSize}
        lineHeight={p.lineHeight}
        savedWords={p.savedWords}
        onWordClick={p.onWordClick}
        onWordEnter={p.onWordEnter}
        onWordLeave={p.onWordLeave}
        onSpeak={p.onSpeak}
        onTutor={p.onTutor}
        onMic={p.onMic}
        recordingParaIdx={p.recordingParaIdx}
        paraScores={p.paraScores}
      />
    );
  }

  return <div className="card" style={{ padding: 'clamp(16px, 4vw, 36px)', marginBottom: 32 }}>
    {p.paragraphs.map((paragraph, index) => <Fragment key={index}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button aria-label="Listen to paragraph" className="reader-para-play-btn" onClick={() => p.onSpeak(paragraph)}>🔊</button>
          <button aria-label="Ask tutor about paragraph" className="reader-para-tutor-btn" onClick={() => p.onTutor(index, paragraph)}>💬</button>
          <button aria-label={p.recordingParaIdx === index ? 'Stop recording' : 'Practice speaking'} className={`reader-para-mic-btn ${p.recordingParaIdx === index ? 'recording' : ''}`} onClick={() => p.onMic(index, paragraph)}>🎙️</button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p lang="ko" style={{ lineHeight: p.lineHeight, fontSize: ({ small: '0.95rem', normal: '1.1rem', large: '1.3rem', xlarge: '1.5rem' } as Record<string, string>)[p.fontSize] || '1.1rem', margin: 0 }}>
            {tokenizeKorean(paragraph).map((token, i) => isKoreanWord(token)
              ? <button type="button" key={i} className={`reading-word ${p.savedWords.has(token) ? 'saved' : ''}`} style={{ font: 'inherit', color: 'inherit', border: 0, background: 'transparent', padding: 0 }} onClick={e => p.onWordClick(e, token, paragraph)} onMouseEnter={e => p.onWordEnter(e, token, paragraph)} onMouseLeave={p.onWordLeave}>{token}</button>
              : <Fragment key={i}>{token}</Fragment>)}
          </p>
          {p.paraScores[index] && <p role="status" style={{ fontSize: '.85rem' }}>음성 인식 문장 일치도: {p.paraScores[index].score}% — {p.paraScores[index].text}</p>}
        </div>
      </div>
      {p.article.imageUrls?.[1] && index === Math.max(0, Math.floor(p.paragraphs.length / 2) - 1) && <ArticleIllustration src={p.article.imageUrls[1]} alt={`${p.article.title} - 핵심 어휘 시각 자료`} />}
    </Fragment>)}
  </div>;
}
