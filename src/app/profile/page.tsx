'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { createOrUpdateUser, getReadArticlesWithDates, getVocabulary } from '@/lib/db';
import { TOPICS } from '@/lib/gemini';
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

  const [readRecords, setReadRecords] = useState<any[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // [신규 기능] 어휘 통계 및 그래프 상태 훅
  const [vocabRecords, setVocabRecords] = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<{ category: string; count: number }[]>([]);

  // 비로그인 상태일 때는 로그인 유도 화면으로 넘기고, 로그인 유저라면 DB에서 가져온 초기 프로필 세팅을 채워 넣습니다.
  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (profile) {
      setSelectedLevel(profile.level);
      setSelectedLang(profile.nativeLanguage || 'en');
    }

    const loadStats = async () => {
      try {
        const records = await getReadArticlesWithDates(user.uid);
        setReadRecords(records);

        // [신규 기능] 어휘 단어 로드
        const vocabs = await getVocabulary(user.uid);
        setVocabRecords(vocabs);
        
        // 스트릭 계산
        const readDatesSet = new Set<string>();
        records.forEach(r => {
          if (r.readAt) {
            const date = typeof r.readAt.toDate === 'function'
              ? r.readAt.toDate()
              : new Date(r.readAt.seconds * 1000);
            
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            readDatesSet.add(`${y}-${m}-${d}`);
          }
        });
        
        let currentStreak = 0;
        if (readDatesSet.size > 0) {
          const today = new Date();
          const formatDateString = (dateObj: Date) => {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dStr = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${dStr}`;
          };

          let checkDate = new Date(today);
          let dateStr = formatDateString(checkDate);

          if (!readDatesSet.has(dateStr)) {
            checkDate.setDate(checkDate.getDate() - 1);
            dateStr = formatDateString(checkDate);
          }

          while (readDatesSet.has(dateStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
            dateStr = formatDateString(checkDate);
          }
        }
        setStreak(currentStreak);

        // 7일 주간 통계 가공
        const formatDateKey = (date: Date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        const today = new Date();
        const last7Days: any[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          last7Days.push({
            dateObj: d,
            dateKey: formatDateKey(d),
            label: `${d.getMonth() + 1}/${d.getDate()}`,
            readCount: 0,
            vocabCount: 0
          });
        }

        // 지문 읽은 날짜 매핑
        records.forEach(r => {
          if (r.readAt) {
            const date = typeof r.readAt.toDate === 'function'
              ? r.readAt.toDate()
              : new Date(r.readAt.seconds * 1000);
            const key = formatDateKey(date);
            const day = last7Days.find(d => d.dateKey === key);
            if (day) day.readCount++;
          }
        });

        // 단어 저장한 날짜 매핑
        vocabs.forEach(v => {
          if (v.savedAt) {
            const date = typeof v.savedAt.toDate === 'function'
              ? v.savedAt.toDate()
              : new Date(v.savedAt.seconds * 1000);
            const key = formatDateKey(date);
            const day = last7Days.find(d => d.dateKey === key);
            if (day) day.vocabCount++;
          }
        });

        setWeeklyStats(last7Days);

        // 카테고리 점유 분포 집계
        const catMap: Record<string, number> = {};
        vocabs.forEach(v => {
          const cat = v.topic || '기타';
          catMap[cat] = (catMap[cat] || 0) + 1;
        });

        const catList = Object.entries(catMap)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // top 5

        setCategoryDistribution(catList);

      } catch (err) {
        console.error('Failed to load read stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    loadStats();
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

        {/* 🔥 학습 스트릭 및 독서 잔디 카드 */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔥 {streak > 0 ? `${streak}일 연속 독서 중!` : '독서 스트릭을 시작해보세요!'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              누적 독서: {readRecords.length}개 텍스트
            </div>
          </div>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.5 }}>
            매일 한국어 글을 읽고 학습 스트릭을 이어나가 보세요. 꾸준한 독서가 한국어 실력 향상의 지름길입니다!
          </p>

          {loadingStats ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <div className="loading-spinner" style={{ width: '24px', height: '24px' }} />
            </div>
          ) : (
            (() => {
              const today = new Date();
              const dayOfWeek = today.getDay();
              const currentWeekSunday = new Date(today);
              currentWeekSunday.setDate(today.getDate() - dayOfWeek);
              
              const startDate = new Date(currentWeekSunday);
              startDate.setDate(currentWeekSunday.getDate() - 11 * 7); // 11주 전 일요일부터 시작

              const readDatesSet = new Set<string>();
              readRecords.forEach(r => {
                if (r.readAt) {
                  const date = typeof r.readAt.toDate === 'function'
                    ? r.readAt.toDate()
                    : new Date(r.readAt.seconds * 1000);
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, '0');
                  const d = String(date.getDate()).padStart(2, '0');
                  readDatesSet.add(`${y}-${m}-${d}`);
                }
              });

              const cells = [];
              for (let i = 0; i < 84; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);
                
                const y = currentDate.getFullYear();
                const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                const d = String(currentDate.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;
                const isRead = readDatesSet.has(dateStr);
                
                cells.push({
                  date: dateStr,
                  isRead,
                  label: `${y}년 ${m}월 ${d}일: ${isRead ? '독서 완료 📚' : '읽은 텍스트 없음 💨'}`
                });
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%', justifyContent: 'center' }}>
                    {/* 요일 라벨 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateRows: 'repeat(7, 12px)',
                      gap: '4px',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      textAlign: 'right',
                      paddingRight: '4px',
                      lineHeight: '12px'
                    }}>
                      <span>일</span>
                      <span></span>
                      <span>화</span>
                      <span></span>
                      <span>목</span>
                      <span></span>
                      <span>토</span>
                    </div>

                    {/* 잔디 그리드 */}
                    <div style={{
                      display: 'grid',
                      gridAutoFlow: 'column',
                      gridTemplateRows: 'repeat(7, 12px)',
                      gridTemplateColumns: 'repeat(12, 12px)',
                      gap: '4px'
                    }}>
                      {cells.map((cell, idx) => (
                        <div
                          key={idx}
                          title={cell.label}
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '2px',
                            background: cell.isRead ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            border: cell.isRead ? 'none' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            transition: 'transform 0.1s ease',
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 범례 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    maxWidth: '190px',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    marginTop: '12px'
                  }}>
                    <span>Less</span>
                    <div style={{ width: '10px', height: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }} />
                    <div style={{ width: '10px', height: '10px', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                    <span>More</span>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* 📊 나의 학습 대시보드 카드 */}
        <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 나의 학습 대시보드
          </h2>

          {loadingStats ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px' }}>
              <div className="loading-spinner" style={{ width: '24px', height: '24px' }} />
            </div>
          ) : (
            <>
              {/* 요약 카드 그리드 */}
              <div className="dashboard-stats-grid">
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-label">📚 누적 독서</div>
                  <div className="dashboard-stat-value">{readRecords.length}개</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-label">📝 저장 단어</div>
                  <div className="dashboard-stat-value">{vocabRecords.length}개</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-label">🔥 독서 스트릭</div>
                  <div className="dashboard-stat-value">{streak}일</div>
                </div>
              </div>

              {/* 7일 주간 통계 막대 그래프 */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                  📅 최근 7일 학습 성과
                </div>
                
                <div className="chart-canvas">
                  {weeklyStats.map((day, idx) => {
                    const maxVal = Math.max(...weeklyStats.map(d => Math.max(d.readCount, d.vocabCount)), 5);
                    const readHeight = (day.readCount / maxVal) * 140;
                    const vocabHeight = (day.vocabCount / maxVal) * 140;

                    return (
                      <div key={idx} className="chart-column">
                        {/* 마우스 오버 툴팁 */}
                        <div className="chart-bar-tooltip">
                          <div style={{ fontWeight: 700, marginBottom: '2px' }}>{day.dateKey}</div>
                          <div style={{ color: '#10b981' }}>• 독서: {day.readCount}회</div>
                          <div style={{ color: '#6366f1' }}>• 단어 저장: {day.vocabCount}개</div>
                        </div>

                        {/* 그래프 막대 묶음 */}
                        <div className="chart-bars-wrapper">
                          <div
                            className="chart-bar-single read"
                            style={{ height: `${Math.max(readHeight, day.readCount > 0 ? 8 : 0)}px` }}
                            title={`독서: ${day.readCount}회`}
                          />
                          <div
                            className="chart-bar-single vocab"
                            style={{ height: `${Math.max(vocabHeight, day.vocabCount > 0 ? 8 : 0)}px` }}
                            title={`단어 저장: ${day.vocabCount}개`}
                          />
                        </div>
                        
                        {/* 날짜 라벨 */}
                        <div className="chart-label-date">{day.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* 그래프 범례 */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '8px', background: '#10b981', borderRadius: '2px' }} />
                    <span>독서 지문</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '8px', background: '#6366f1', borderRadius: '2px' }} />
                    <span>어휘 저장</span>
                  </div>
                </div>
              </div>

              {/* 어휘 저장 카테고리 분포 */}
              {categoryDistribution.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    🗂️ 어휘 카테고리 분포 (Top 5)
                  </div>
                  <div className="category-share-list">
                    {categoryDistribution.map((item, idx) => {
                      const maxCount = Math.max(...categoryDistribution.map(d => d.count));
                      const percent = (item.count / maxCount) * 100;
                      const categoryLabel = TOPICS.find(t => t.id === item.category)?.label || item.category;

                      return (
                        <div key={idx} className="category-share-item">
                          <span className="category-share-label">
                            {categoryLabel}
                          </span>
                          <div className="category-share-bar-bg">
                            <div
                              className="category-share-bar-fill"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="category-share-count">
                            {item.count}개
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
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
