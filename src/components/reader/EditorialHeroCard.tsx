'use client';

import React from 'react';

interface EditorialHeroCardProps {
  hookQuote?: string;
  genre?: string;
  topicLabel?: string;
  topicEmoji?: string;
  estimatedMinutes?: number;
  level?: string;
  style?: React.CSSProperties;
}

const GENRE_DISPLAY: Record<string, { label: string; emoji: string }> = {
  kakaotalk: { label: '카톡 단톡방', emoji: '💬' },
  mystery: { label: '1분 미스터리', emoji: '🕵️' },
  review: { label: '솔직 맛집/일상 리뷰', emoji: '🍲' },
  story: { label: '단편 스토리', emoji: '🧚' },
  dialogue: { label: '생생한 대화문', emoji: '🗣️' },
  essay: { label: '감성 수필 / 일기', emoji: '📖' },
  column: { label: '매거진 칼럼', emoji: '📰' },
  random: { label: '스토리', emoji: '✨' },
};

export default function EditorialHeroCard({
  hookQuote,
  genre,
  topicLabel,
  topicEmoji,
  estimatedMinutes,
  level,
  style = {},
}: EditorialHeroCardProps) {
  const genreInfo = genre ? GENRE_DISPLAY[genre] : null;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg, 16px)',
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)',
        border: '1px solid rgba(217, 119, 6, 0.2)',
        padding: '24px 28px',
        marginBottom: '28px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.03)',
        ...style,
      }}
    >
      {/* 장식용 큰 따옴표 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-10px',
          right: '20px',
          fontSize: '5.5rem',
          lineHeight: 1,
          fontFamily: 'serif',
          color: 'var(--accent-primary)',
          opacity: 0.12,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        “
      </div>

      {/* 상단 태그 배지들 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {genreInfo && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(217, 119, 6, 0.14)',
              color: 'var(--accent-primary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '100px',
              border: '1px solid rgba(217, 119, 6, 0.3)',
            }}
          >
            <span>{genreInfo.emoji}</span>
            <span>{genreInfo.label}</span>
          </span>
        )}

        {topicLabel && (
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-card)',
              padding: '3px 10px',
              borderRadius: '100px',
              border: '1px solid var(--border-subtle)',
              fontWeight: 600,
            }}
          >
            {topicEmoji && <span style={{ marginRight: '4px' }}>{topicEmoji}</span>}
            {topicLabel}
          </span>
        )}

        {level && (
          <span className={`level-badge level-${level}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
            {level}
          </span>
        )}

        {estimatedMinutes && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ⏱️ {estimatedMinutes}분 읽기
          </span>
        )}
      </div>

      {/* 핵심 후크 문장 / 명대사 */}
      {hookQuote ? (
        <blockquote
          style={{
            margin: 0,
            paddingLeft: '14px',
            borderLeft: '3px solid var(--accent-primary)',
            fontSize: '1.15rem',
            fontWeight: 700,
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            fontFamily: '"Noto Serif KR", serif, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          &ldquo;{hookQuote}&rdquo;
        </blockquote>
      ) : (
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          지문을 읽고 주인공의 흥미진진한 이야기를 따라가 보세요!
        </p>
      )}
    </div>
  );
}
