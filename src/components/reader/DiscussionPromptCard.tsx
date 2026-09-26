'use client';

import React from 'react';

interface DiscussionPromptCardProps {
  prompt?: string;
  choices?: string[];
  chosenIndex?: number | null;
  onChoose?: (index: number) => void;
  onContinue?: () => void;
  style?: React.CSSProperties;
}

export default function DiscussionPromptCard({ prompt, choices = [], chosenIndex = null, onChoose, onContinue, style = {} }: DiscussionPromptCardProps) {
  if (!prompt) return null;

  return (
    <div
      style={{
        marginTop: '24px',
        marginBottom: '32px',
        padding: '22px 24px',
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)',
        border: '1px solid rgba(217, 119, 6, 0.22)',
        borderRadius: 'var(--radius-lg, 16px)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 16px -2px rgba(217, 119, 6, 0.05)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '1.25rem' }}>🤔</span>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)', margin: 0 }}>
          생각해볼 거리 & 당신의 선택은?
        </h3>
      </div>
      <p style={{
        margin: 0,
        fontSize: '0.92rem',
        lineHeight: 1.65,
        color: 'var(--text-primary)',
        fontWeight: 500,
      }}>
        {prompt}
      </p>
      {choices.length === 2 && (
        <div style={{ display: 'grid', gap: '8px', marginTop: '16px' }}>
          {choices.map((choice, index) => (
            <button
              key={`${index}-${choice}`}
              type="button"
              className={`btn ${chosenIndex === index ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={chosenIndex === index}
              onClick={() => onChoose?.(index)}
              style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' }}
            >
              {index + 1}. {choice}
            </button>
          ))}
          {onContinue && chosenIndex !== null && (
            <button type="button" className="btn btn-primary" onClick={onContinue} style={{ justifyContent: 'center', marginTop: '4px' }}>
              이 선택으로 다음 화 만들기 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
