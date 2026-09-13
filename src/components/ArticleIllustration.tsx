'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * @file ArticleIllustration.tsx
 * @description 한국어 읽기 아티클에 삽입되는 반응형 맞춤 AI 일러스트 컴포넌트입니다.
 * - Pollinations.ai / FLUX.1 고화질 이미지 비동기 로딩
 * - 로딩 중 세련된 펄스/쉬머 스켈레톤 UI 표시
 * - 이미지 로드 실패 시(네트워크 장애 등) 페이지 깨짐 없이 자연스럽게 숨김 처리(Graceful Fallback)
 * - 16:9 비율 유지, 라운드 모서리, 은은한 보더 및 AI 삽화 배지 제공
 */

import React, { useEffect, useState } from 'react';

interface ArticleIllustrationProps {
  src: string;
  alt: string;
  badgeText?: string;
  caption?: string;
  aspectRatio?: string;
  style?: React.CSSProperties;
}

export default function ArticleIllustration({
  src,
  alt,
  badgeText = '🎨 AI 맞춤 삽화',
  caption,
  aspectRatio = '16 / 9',
  style = {},
}: ArticleIllustrationProps) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => { setLoaded(false); setHasError(false); }, [src]);

  // 로드 실패 시(네트워크 문제 등) 사용자 경험을 해치지 않도록 조용히 렌더링을 생략합니다.
  if (hasError || !src) {
    return null;
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspectRatio,
        borderRadius: 'var(--radius-lg, 16px)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-md)',
        margin: '20px 0',
        transition: 'all 300ms ease',
        ...style,
      }}
    >
      {/* 1. 이미지 로딩 중 표시되는 스켈레톤 쉬머 애니메이션 */}
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: 'linear-gradient(110deg, var(--bg-card) 8%, var(--bg-secondary) 18%, var(--bg-card) 33%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s linear infinite',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            zIndex: 1,
          }}
        >
          <style>{`
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
          `}</style>
          <span style={{ fontSize: '1.5rem', opacity: 0.8 }}>🎨</span>
          <span style={{ fontWeight: 500 }}>주제 맞춤 일러스트를 불러오는 중...</span>
        </div>
      )}

      {/* 2. 실제 AI 일러스트 이미지 태그 */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 500ms ease-in-out',
        }}
      />

      {/* 3. 우측 하단 AI 삽화 표식 배지 (로딩 완료 시 표시) */}
      {loaded && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '12px',
            background: 'rgba(28, 25, 23, 0.75)',
            backdropFilter: 'blur(8px)',
            color: '#fbfaf8',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '100px',
            letterSpacing: '0.02em',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {badgeText}
        </div>
      )}

      {/* 4. 하단 캡션 (선택적) */}
      {caption && loaded && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '12px',
            background: 'rgba(28, 25, 23, 0.75)',
            backdropFilter: 'blur(8px)',
            color: '#f4f1ea',
            fontSize: '0.75rem',
            padding: '4px 12px',
            borderRadius: '6px',
            maxWidth: '70%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
