'use client';

import React from 'react';

interface DiscussionPromptCardProps {
  prompt?: string;
  style?: React.CSSProperties;
}

export default function DiscussionPromptCard({ prompt, style = {} }: DiscussionPromptCardProps) {
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
    </div>
  );
}
