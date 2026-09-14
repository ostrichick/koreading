'use client';

import { Fragment, type MouseEvent } from 'react';
import { tokenizeKorean, isKoreanWord } from '@/lib/utils';

type WordHandler = (event: MouseEvent, word: string, context: string) => void;

interface Props {
  paragraphs: string[];
  fontSize: string;
  lineHeight: number;
  savedWords: Set<string>;
  onWordClick: WordHandler;
  onWordEnter: WordHandler;
  onWordLeave: () => void;
  onSpeak: (text: string) => void;
  onTutor: (index: number, text: string) => void;
  onMic: (index: number, text: string) => void;
  recordingParaIdx: number | null;
  paraScores: Record<number, { score: number; text: string }>;
}

const AVATAR_COLORS = [
  '#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#ef4444'
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function KakaoChatView(p: Props) {
  const fontSizes: Record<string, string> = {
    small: '0.9rem',
    normal: '1.05rem',
    large: '1.2rem',
    xlarge: '1.35rem',
  };
  const activeFontSize = fontSizes[p.fontSize] || '1.05rem';

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto 32px auto',
        borderRadius: 'var(--radius-lg, 24px)',
        overflow: 'hidden',
        border: '1px solid var(--border-medium)',
        background: '#b2c7da',
        boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0,0,0,0.1))',
      }}
    >
      {/* 카카오톡 상단 헤더 바 */}
      <div
        style={{
          background: '#a2b7ca',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          color: '#1e293b',
          fontWeight: 700,
          fontSize: '0.9rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💬</span>
          <span>한국어 실전 대화 단톡방</span>
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          👥 참여자 대화
        </div>
      </div>

      {/* 날짜 표시 구분선 */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
        <span
          style={{
            background: 'rgba(0, 0, 0, 0.16)',
            color: '#ffffff',
            fontSize: '0.72rem',
            padding: '3px 12px',
            borderRadius: '100px',
            fontWeight: 500,
          }}
        >
          📅 오늘의 대화
        </span>
      </div>

      {/* 메시지 리스트 영역 */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {p.paragraphs.map((paragraph, index) => {
          // [화자]: 내용 or 화자: 내용 패턴 추출
          const speakerMatch = paragraph.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/) || paragraph.match(/^([가-힣A-Za-z0-9_]{1,6}):\s*(.*)$/);
          
          let speaker = '';
          let textContent = paragraph;

          if (speakerMatch) {
            speaker = speakerMatch[1].trim();
            textContent = speakerMatch[2].trim();
          }

          // '나', '저', 'me' 이거나 화자가 특정된 경우
          const isMe = speaker === '나' || speaker === '저' || speaker.toLowerCase() === 'me';
          const isSystemNotice = !speaker && (paragraph.startsWith('(') || paragraph.startsWith('*'));

          // 시스템 공지형 메시지 (예: (10분 뒤 카페 앞))
          if (isSystemNotice) {
            return (
              <div key={index} style={{ textAlign: 'center', margin: '4px 0' }}>
                <span
                  style={{
                    background: 'rgba(0, 0, 0, 0.12)',
                    color: '#334155',
                    fontSize: '0.75rem',
                    padding: '2px 10px',
                    borderRadius: '8px',
                  }}
                >
                  {paragraph}
                </span>
              </div>
            );
          }

          const avatarColor = getAvatarColor(speaker || '친구');

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: isMe ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              {/* 상대방 프로필 아바타 (내가 아닐 때만 표시) */}
              {!isMe && (
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '14px',
                    background: avatarColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    flexShrink: 0,
                  }}
                >
                  {speaker ? speaker.slice(0, 2) : '대화'}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                }}
              >
                {/* 화자 이름 표시 (내가 아닐 때) */}
                {!isMe && speaker && (
                  <span style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '3px', fontWeight: 600 }}>
                    {speaker}
                  </span>
                )}

                {/* 말풍선과 부가 컨트롤(오디오/튜터/시간) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: '6px',
                  }}
                >
                  {/* 말풍선 본체 */}
                  <div
                    style={{
                      background: isMe ? '#fee500' : '#ffffff',
                      color: '#191919',
                      padding: '10px 14px',
                      borderRadius: isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      fontSize: activeFontSize,
                      lineHeight: p.lineHeight || 1.6,
                      wordBreak: 'break-word',
                      userSelect: 'text',
                    }}
                  >
                    {tokenizeKorean(textContent).map((token, i) =>
                      isKoreanWord(token) ? (
                        <button
                          type="button"
                          key={i}
                          className={`reading-word ${p.savedWords.has(token) ? 'saved' : ''}`}
                          style={{
                            font: 'inherit',
                            color: 'inherit',
                            border: 0,
                            background: 'transparent',
                            padding: '0 1px',
                            cursor: 'pointer',
                          }}
                          onClick={e => p.onWordClick(e, token, paragraph)}
                          onMouseEnter={e => p.onWordEnter(e, token, paragraph)}
                          onMouseLeave={p.onWordLeave}
                        >
                          {token}
                        </button>
                      ) : (
                        <Fragment key={i}>{token}</Fragment>
                      )
                    )}
                  </div>

                  {/* 음성 및 튜터 액션 버튼 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: 0.8 }}>
                    <button
                      type="button"
                      aria-label="Listen"
                      onClick={() => p.onSpeak(textContent)}
                      style={{
                        background: 'rgba(255,255,255,0.7)',
                        border: 'none',
                        borderRadius: '100px',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      🔊
                    </button>
                    <button
                      type="button"
                      aria-label="Tutor"
                      onClick={() => p.onTutor(index, textContent)}
                      style={{
                        background: 'rgba(255,255,255,0.7)',
                        border: 'none',
                        borderRadius: '100px',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      💬
                    </button>
                  </div>
                </div>

                {/* 음성 녹음 발음 일치도 점수 */}
                {p.paraScores[index] && (
                  <p role="status" style={{ fontSize: '0.75rem', color: '#047857', margin: '4px 0 0 0' }}>
                    발음 점수: {p.paraScores[index].score}%
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 카카오톡 하단 입력창 힌트 바 */}
      <div
        style={{
          background: '#ffffff',
          padding: '10px 16px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#94a3b8',
          fontSize: '0.8rem',
        }}
      >
        <span>💡 단어를 클릭하면 뜻과 사전이 나타납니다</span>
        <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
          대화 모드
        </span>
      </div>
    </div>
  );
}
