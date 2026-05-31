'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';

export default function NavBar() {
  const { user, profile, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/');
    setMenuOpen(false);
  };

  const guestLevel = typeof window !== 'undefined' ? localStorage.getItem('koreading_level') : null;
  const navLinks = user
    ? [
        { href: '/library', label: '도서관' },
        { href: '/vocabulary', label: '내 단어장' },
      ]
    : guestLevel
    ? [{ href: '/library', label: '도서관' }]
    : [];

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="nav-logo">
          <Image src="/logo.png" alt="Korider logo" width={32} height={32} style={{ borderRadius: '8px' }} />
          Korider
        </Link>

        <div className="nav-links">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}

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
                  <div className="nav-avatar-placeholder">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
              </button>

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
                  <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      레벨: {profile.level || '미설정'}
                    </div>
                  </div>
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
