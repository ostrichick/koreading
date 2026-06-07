'use client';

/**
 * @file AlertModal.tsx
 * @description 코레딩(Koreading) 앱 전역에서 발생하는 에러 및 알림을 마우스 드래그 및 [📋 내용 복사] 버튼을 통해 복사 가능한 형태로 표출하는 프리미엄 모달 팝업 컴포넌트입니다.
 * @why 브라우저 기본 alert() 창이 텍스트 드래그를 차단하여, 429 쿼터 초과 에러 등 상세 디버그 로그를 스크린샷 캡처해야만 했던 번거로움을 완전히 해결하기 위해 존재합니다.
 */

import { useState } from 'react';

// AlertModal 컴포넌트가 부모 컴포넌트로부터 전달받는 속성(Props) 인터페이스 정의
interface AlertModalProps {
  isOpen: boolean;               // 모달 표시 여부
  title?: string;                // 모달 상단 타이틀 (기본값: '알림')
  message: string;               // 화면에 보여줄 알림/에러 메시지 본문
  onClose: () => void;           // 닫기 버튼 또는 바깥 배경 클릭 시 구동할 핸들러
  type?: 'info' | 'error' | 'warning' | 'success'; // 알림의 심각도 수준 및 디자인 테마
}

export default function AlertModal({
  isOpen,
  title = '알림',
  message,
  onClose,
  type = 'info'
}: AlertModalProps) {
  // 복사 버튼 클릭 시 "복사완료" 텍스트 토글을 위한 로컬 상태
  const [copied, setCopied] = useState(false);

  // 모달이 비활성화 상태이면 렌더링하지 않습니다.
  if (!isOpen) return null;

  // 알림 메시지 본문을 클립보드에 복사하는 비동기 함수
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // 2초 후 다시 기본 문구로 롤백
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  // 알림 유형(Type)에 맞는 알맞은 아이콘 이모지를 반환합니다.
  const getTypeIcon = () => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return '💡';
    }
  };

  // 알림 유형에 매칭되는 흐릿한 광원 외곽선 색상을 반환합니다.
  const getBorderColor = () => {
    switch (type) {
      case 'error': return 'rgba(239, 68, 68, 0.3)';
      case 'warning': return 'rgba(245, 158, 11, 0.3)';
      case 'success': return 'rgba(16, 185, 129, 0.3)';
      default: return 'rgba(99, 102, 241, 0.3)';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
      }}
      // 모달 바깥 배경 영역을 클릭해도 모달이 닫히도록 설정
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-card)',
          border: '1px solid',
          borderColor: getBorderColor(),
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          userSelect: 'text', // 드래그 복사가 가능하도록 유저 셀렉트 활성화
          WebkitUserSelect: 'text',
          MozUserSelect: 'text',
          msUserSelect: 'text',
          animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes modalSlideIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          .alert-modal-msg-area {
            word-break: break-all;
            white-space: pre-wrap;
            user-select: text !important;
            -webkit-user-select: text !important;
          }
        `}</style>

        {/* 상단 헤더 영역 (아이콘 + 제목 + 닫기 ✕ 단추) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '1.4rem' }}>{getTypeIcon()}</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              padding: '4px',
              transition: 'color 150ms ease'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ✕
          </button>
        </div>

        {/* 메시지 내용 영역 (상세 에러 스택/JSON 분석에 적합하도록 코딩 전용 monospace 폰트 사용) */}
        <div
          className="alert-modal-msg-area"
          style={{
            fontSize: '0.925rem',
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: '24px',
            maxHeight: '300px',
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            fontFamily: 'Consolas, Monaco, monospace',
          }}
        >
          {message}
        </div>

        {/* 하단 푸터 영역 (내용 복사 단추 및 확인 닫기 단추) */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: 'auto' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--border-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
          >
            {copied ? '✓ 복사완료' : '📋 내용 복사'}
          </button>
          
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 700,
              transition: 'opacity 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

