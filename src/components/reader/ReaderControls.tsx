'use client';

import React, { useState, useEffect } from 'react';

interface ReaderControlsProps {
  content: string;
  fontSize: 'normal' | 'large' | 'xlarge';
  onFontSizeChange: (size: 'normal' | 'large' | 'xlarge') => void;
}

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  content,
  fontSize,
  onFontSizeChange,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [ttsSupported, setTtsSupported] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setTtsSupported(true);
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel(); // Clear any ongoing speech
    const cleanText = content.replace(/[#*`_~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.85; // Slightly slower for language learners

    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find((v) => v.lang.startsWith('ko'));
    if (koreanVoice) utterance.voice = koreanVoice;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const nextFontSize = () => {
    if (fontSize === 'normal') onFontSizeChange('large');
    else if (fontSize === 'large') onFontSizeChange('xlarge');
    else onFontSizeChange('normal');
  };

  const fontLabel = fontSize === 'normal' ? '보통' : fontSize === 'large' ? '크게' : '아주 크게';

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: 'var(--bg-card, rgba(255, 255, 255, 0.8))',
      padding: '6px 12px',
      borderRadius: '12px',
      border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.1))',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* TTS Audio Button */}
      {ttsSupported && (
        <button
          type="button"
          onClick={handleToggleSpeech}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isPlaying ? '#10b981' : 'transparent',
            color: isPlaying ? '#ffffff' : 'var(--text-primary, #333)',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
          title={isPlaying ? '음성 중지' : '한국어 원어민 발음으로 기사 듣기'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
          <span>{isPlaying ? '듣기 중지' : '본문 듣기'}</span>
        </button>
      )}

      <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle, #e5e7eb)' }} />

      {/* Font Size Adjuster Button */}
      <button
        type="button"
        onClick={nextFontSize}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'transparent',
          color: 'var(--text-primary, #333)',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 500,
        }}
        title="글자 크기 변경"
      >
        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>가</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>{fontLabel}</span>
      </button>
    </div>
  );
};
