'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { createOrUpdateUser } from '@/lib/db';
import type { CEFRLevel, NativeLanguage } from '@/lib/gemini';

// 화면에 보여줄 6가지 CEFR 한국어 레벨 정보 정의
const LEVELS: { value: CEFRLevel; label: string; desc: string }[] = [
  { value: 'A1', label: 'A1 입문', desc: '처음 배우는 단계' },
  { value: 'A2', label: 'A2 초급', desc: '기초 표현 가능' },
  { value: 'B1', label: 'B1 중급', desc: '일상 대화 가능' },
  { value: 'B2', label: 'B2 중상급', desc: '복잡한 주제 이해' },
  { value: 'C1', label: 'C1 고급', desc: '유창하게 표현 가능' },
  { value: 'C2', label: 'C2 최고급', desc: '원어민 수준' },
];

// 사용자의 개인 설정을 편집할 수 있는 ProfilePage 컴포넌트입니다.
export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth(); // AuthContext 인증 데이터 연동
  const router = useRouter();

  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | null>(null); // 선택된 한국어 레벨
  const [selectedLang, setSelectedLang] = useState<NativeLanguage>('en');    // 선택된 번역 모국어
  const [saving, setSaving] = useState(false);                               // 저장 처리 중 로딩 애니메이션 활성 상태
  const [saved, setSaved] = useState(false);                                 // 저장 완료 알럿 활성 상태

  // 비로그인 상태일 때는 로그인 유도 화면으로 넘기고, 로그인 유저라면 DB에서 가져온 초기 프로필 세팅을 채워 넣습니다.
  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (profile) {
      setSelectedLevel(profile.level);
      setSelectedLang(profile.nativeLanguage || 'en');
    }
  }, [user, profile, router]);

  // "설정 저장하기" 버튼을 클릭했을 때 구동하는 핸들러입니다.
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    // Firestore DB에 변경사항 영구 갱신
    await createOrUpdateUser(user.uid, {
      level: selectedLevel || undefined,
      nativeLanguage: selectedLang,
    });
    // 최신 DB 레코드로 AuthContext profile 데이터 갱신
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000); // 2초 뒤 저장완료 문구 비활성화
  };

  // 사용자 세션이 완전히 판별될 때까지 임시 로딩 로직 제공
  if (!user || !profile) return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px' }}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '32px' }}>⚙️ 프로필 설정</h1>

        {/* 사용자 정보 간략 프로필 카드 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt="Profile"
              width={64}
              height={64}
              style={{ borderRadius: '50%', border: '2px solid var(--accent-primary)' }}
            />
          ) : (
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'var(--gradient-main)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 700,
            }}>
              {user.displayName?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{user.displayName}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{user.email}</div>
          </div>
        </div>

        {/* 번역에 노출될 모국어 설정 셀렉터 카드 (영어, 스페인어, 일본어, 중국어 4개 국어 지원) */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>🌐 모국어 설정</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { value: 'en' as NativeLanguage, label: '🇺🇸 English', desc: '영어로 번역' },
              { value: 'es' as NativeLanguage, label: '🇪🇸 Español', desc: '스페인어로 번역' },
              { value: 'ja' as NativeLanguage, label: '🇯🇵 日本語', desc: '일본어로 번역' },
              { value: 'zh' as NativeLanguage, label: '🇨🇳 中文', desc: '중국어로 번역' },
            ].map(lang => (
              <button
                key={lang.value}
                onClick={() => setSelectedLang(lang.value)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid',
                  borderColor: selectedLang === lang.value ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  background: selectedLang === lang.value ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {lang.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 한국어 학습 레벨 수동 설정 카드 */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>🎯 한국어 레벨</div>
            <a
              href="/test"
              style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none' }}
            >
              레벨 재테스트 →
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {LEVELS.map(level => (
              <button
                key={level.value}
                onClick={() => setSelectedLevel(level.value)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid',
                  borderColor: selectedLevel === level.value ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  background: selectedLevel === level.value ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease',
                  fontFamily: 'inherit',
                }}
              >
                <span className={`level-badge level-${level.value}`} style={{ marginBottom: '6px', display: 'block' }}>
                  {level.value}
                </span>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{level.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 저장 제출 단추 (E2E 테스트 연동용 save-profile-btn ID 탑재) */}
        <button
          id="save-profile-btn"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '16px' }}
        >
          {saving ? '저장 중...' : saved ? '✅ 저장 완료!' : '설정 저장하기'}
        </button>
      </div>
    </div>
  );
}
