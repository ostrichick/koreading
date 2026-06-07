'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';

// 서비스 최상단 공통 헤더 및 탐색 메뉴 역할을 수행하는 네비게이션 바 컴포넌트입니다.
export default function NavBar() {
  const { user, profile, logout } = useAuth(); // 사용자 세션 및 프로필 데이터 로드
  const pathname = usePathname();              // 현재 활성화된 브라우저 주소 경로(URL)
  const router = useRouter();                  // Next.js 페이지 라우터
  const [menuOpen, setMenuOpen] = useState(false); // 프로필 드롭다운 메뉴 활성화 상태
  const menuRef = useRef<HTMLDivElement>(null);    // 드롭다운 메뉴 엘리먼트 참조값

  // 드롭다운 메뉴 바깥 영역을 클릭했을 때 메뉴를 자동으로 닫아주는 기능입니다.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 메뉴 창 바깥의 DOM을 클릭했다면 열린 메뉴 상태를 닫음(false)으로 토글합니다.
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 로그아웃 단추 클릭 시 구동할 이벤트 핸들러입니다.
  const handleLogout = async () => {
    await logout();      // AuthContext 로그아웃 처리
    router.push('/');    // 메인 랜딩 페이지로 이동
    setMenuOpen(false);  // 메뉴 닫기
  };

  // 게스트(비로그인)가 브라우저에 저장한 임시 학습 레벨 정보를 가져옵니다.
  const guestLevel = typeof window !== 'undefined' ? localStorage.getItem('koreading_level') : null;

  // 로그인 및 게스트 상태에 따라서 상단 네비게이션 메뉴 목록을 다이나믹하게 필터링합니다.
  // About 링크는 항상 표시하여 신뢰성 있는 사이트임을 Google 크롤러에게 보여줍니다.
  const navLinks = user
    ? [
        { href: '/library', label: '도서관' },
        { href: '/vocabulary', label: '내 단어장' },
        { href: '/about', label: 'About' },
      ]
    : guestLevel
    ? [
        { href: '/library', label: '도서관' },
        { href: '/about', label: 'About' },
      ]
    : [{ href: '/about', label: 'About' }];

  return (
    <nav className="nav">
      <div className="container nav-inner">
        {/* 서비스 로고 및 랜딩 홈 링크 */}
        <Link href="/" className="nav-logo">
          <Image src="/logo.png" alt="Koreading logo" width={32} height={32} style={{ borderRadius: '8px' }} />
          Koreading
        </Link>

        {/* 네비게이션 링크 그룹 */}
        <div className="nav-links">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              // 현재 머무르고 있는 페이지에 불이 들어오도록 active 클래스 바인딩
              className={`nav-link ${pathname === link.href ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}

          {/* 로그인 세션 존재 시 우측 상단 유저 아바타 드롭다운 표시 */}
          {user && profile ? (
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt="Profile"
                    width={36}
                    height={36}
                    className="nav-avatar"
                  />
                ) : (
                  // 프로필 이미지가 따로 존재하지 않는 구글 계정의 경우 첫 글자로 대체
                  <div className="nav-avatar-placeholder">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
              </button>

              {/* 드롭다운 하부 메뉴 구성 */}
              {menuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '48px',
                  right: 0,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px',
                  minWidth: '200px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                }}>
                  {/* 유저 성함 및 권장 레벨 정보 간략 요약 */}
                  <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      레벨: {profile.level || '미설정'}
                    </div>
                  </div>
                  {/* 상세 톱니바퀴 프로필 설정 버튼 및 로그아웃 버튼 */}
                  <div style={{ marginTop: '4px' }}>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      ⚙️ 프로필 설정
                    </Link>
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 12px',
                        color: 'var(--accent-rose)',
                        background: 'none',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,63,94,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      🚪 로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // 비로그인 상태이면서 로그인 관련 화면이 아닐 경우 시작하기 버튼 노출
            !pathname?.startsWith('/login') && (
              <Link href="/login" className="btn btn-primary btn-sm">
                시작하기
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}

