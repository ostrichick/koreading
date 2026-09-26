'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { createOrUpdateUser, getReadArticlesWithDates, getVocabulary, getArticleProgressList, deleteUserAccount, type ArticleProgress } from '@/lib/db';
import { TOPICS } from '@/lib/gemini';
import type { CEFRLevel, NativeLanguage } from '@/lib/gemini';
import { deriveLearningProfile, readingCompletionStreak, currentCalendarWeekCount, currentCalendarWeekStudyDays } from '@/lib/learning';

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
  const { user, profile, loading, refreshProfile } = useAuth(); // AuthContext 인증 데이터 연동
  const router = useRouter();

  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | null>(null); // 선택된 한국어 레벨
  const [selectedLang, setSelectedLang] = useState<NativeLanguage>('en');    // 선택된 번역 모국어
  const [saving, setSaving] = useState(false);                               // 저장 처리 중 로딩 애니메이션 활성 상태
  const [saved, setSaved] = useState(false);                                 // 저장 완료 알럿 활성 상태
  const [weeklyReadingGoal, setWeeklyReadingGoal] = useState(3);

  const [readRecords, setReadRecords] = useState<any[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // [신규 기능] 어휘 통계 및 그래프 상태 훅
  const [vocabRecords, setVocabRecords] = useState<any[]>([]);
  const [progressRecords, setProgressRecords] = useState<(ArticleProgress & { articleId: string })[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<{ category: string; count: number }[]>([]);

  // 비로그인 상태일 때는 로그인 유도 화면으로 넘기고, 로그인 유저라면 DB에서 가져온 초기 프로필 세팅을 채워 넣습니다.
  useEffect(() => {
    if (loading) return; // 인증 상태 확인 중에는 리다이렉트하지 않음
    if (!user) { router.push('/login'); return; }
    if (profile) {
      setSelectedLevel(profile.level);
      setSelectedLang(profile.nativeLanguage || 'en');
      setWeeklyReadingGoal(Math.min(7, Math.max(1, profile.weeklyReadingGoal || 3)));
    }

    const loadStats = async () => {
      try {
        const [records, vocabs, progress] = await Promise.all([
          getReadArticlesWithDates(user.uid),
          getVocabulary(user.uid),
          getArticleProgressList(user.uid),
        ]);
        setReadRecords(records);
        setVocabRecords(vocabs);
        setProgressRecords(progress);
        
        const readDates = records.flatMap(record => {
          const readAt = record.readAt;
          if (!readAt) return [];
          return [typeof readAt.toDate === 'function' ? readAt.toDate() : new Date(readAt.seconds * 1000)];
        });
        setStreak(readingCompletionStreak(readDates));

        // 7일 주간 통계 가공
        const formatDateKey = (date: Date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        const today = new Date();
        type DayStat = { dateObj: Date; dateKey: string; label: string; readCount: number; vocabCount: number };
        const last7Days: DayStat[] = [];
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
  }, [user, profile, loading, router]);

  const learningDashboard = useMemo(() => {
    const toDate = (value: any): Date | null => value
      ? (typeof value.toDate === 'function' ? value.toDate() : typeof value.seconds === 'number' ? new Date(value.seconds * 1000) : null)
      : null;
    const readDates = readRecords.map(record => toDate(record.readAt)).filter((date): date is Date => !!date);
    const reviewDates = vocabRecords.map(record => toDate(record.lastReviewedAt)).filter((date): date is Date => !!date);
    const profileData = selectedLevel ? deriveLearningProfile(progressRecords, selectedLevel) : null;
    const skillLabels = { main: '핵심 내용 이해', detail: '세부 정보 찾기', vocabulary: '문맥 속 어휘' } as const;
    const skillCounts = {
      main: { right: 0, total: 0 }, detail: { right: 0, total: 0 }, vocabulary: { right: 0, total: 0 },
    };
    progressRecords.slice(0, 5).forEach(record => {
      if (!record.lastQuizBreakdown) return;
      (['main', 'detail', 'vocabulary'] as const).forEach(skill => {
        skillCounts[skill].total++;
        if (record.lastQuizBreakdown?.[skill]) skillCounts[skill].right++;
      });
    });
    const strongSkills = (Object.entries(skillCounts) as [keyof typeof skillCounts, { right: number; total: number }][])
      .filter(([, value]) => value.total >= 2 && value.right / value.total >= 0.75)
      .map(([skill]) => skillLabels[skill]);
    const weakSkills = (profileData?.weakSkills || []).map(skill => skillLabels[skill]);
    return {
      profileData,
      weekReads: currentCalendarWeekCount(readDates),
      weekReviews: currentCalendarWeekCount(reviewDates),
      studyDays: currentCalendarWeekStudyDays([...readDates, ...reviewDates]),
      strongSkills,
      weakSkills,
    };
  }, [readRecords, vocabRecords, progressRecords, selectedLevel]);

  // "설정 저장하기" 버튼을 클릭했을 때 구동하는 핸들러입니다.
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Firestore DB에 변경사항 영구 갱신
      await createOrUpdateUser(user.uid, {
        level: selectedLevel || undefined,
        nativeLanguage: selectedLang,
        weeklyReadingGoal,
      });
      // 최신 DB 레코드로 AuthContext profile 데이터 갱신
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('❌ 프로필 저장 실패:', err);
      alert('설정 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  // 학습 데이터 정리 후 Auth 계정을 삭제합니다.
  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm('정말로 계정을 탈퇴하시겠습니까? 저장된 모든 학습 데이터가 삭제되며 이 작업은 복구할 수 없습니다.');
    if (!confirmed) return;

    try {
      await deleteUserAccount(user);
      alert('회원 탈퇴가 완료되었습니다.');
      router.push('/');
    } catch (err: unknown) {
      console.error('❌ 회원 탈퇴 실패:', err);
      if ((err as { code?: string })?.code === 'auth/requires-recent-login') {
        alert('보안을 위해 다시 로그인한 후 회원 탈퇴를 시도해 주세요.');
      } else {
        alert('회원 탈퇴 처리 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
      }
    }
  };

  if (!user || loading) return <div className="loading-wrapper"><div className="loading-spinner" /></div>;
  if (!profile) return <main className="container" style={{ padding: 40 }}>
    <h1>프로필을 불러올 수 없습니다</h1>
    <p>삭제 중 오류가 발생했다면 계정 삭제를 다시 시도할 수 있습니다.</p>
    <button onClick={handleDeleteAccount}>계정 삭제 다시 시도</button>
    <Link href="/login">로그인 화면</Link>
  </main>;

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

        {/* R6: 이번 주 학습 진척과 다음 행동 */}
        <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: '0 0 6px' }}>이번 주 학습 진척</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '.82rem', lineHeight: 1.5 }}>월요일부터 일요일까지의 읽기·복습 기록을 기준으로 계산합니다.</p>
            </div>
            <label htmlFor="weekly-reading-goal" style={{ display: 'grid', gap: '4px', fontSize: '.78rem', fontWeight: 700 }}>
              주간 독서 목표
              <select
                id="weekly-reading-goal"
                value={weeklyReadingGoal}
                onChange={event => setWeeklyReadingGoal(Number(event.target.value))}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                {[1, 2, 3, 4, 5, 6, 7].map(goal => <option key={goal} value={goal}>{goal}개</option>)}
              </select>
            </label>
          </div>

          {loadingStats ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><div className="loading-spinner" style={{ width: '24px', height: '24px' }} /></div>
          ) : (
            <>
              <div className="dashboard-stats-grid" style={{ marginBottom: '18px' }}>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-label">이번 주 읽기</div>
                  <div className="dashboard-stat-value">{learningDashboard.weekReads} / {weeklyReadingGoal}</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-label">이번 주 복습 단어</div>
                  <div className="dashboard-stat-value">{learningDashboard.weekReviews}개</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-label">최근 이해도</div>
                  <div className="dashboard-stat-value">{learningDashboard.profileData?.recentComprehensionRate === null || learningDashboard.profileData?.recentComprehensionRate === undefined ? '기록 없음' : `${learningDashboard.profileData.recentComprehensionRate}%`}</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-label">이번 주 학습일</div>
                  <div className="dashboard-stat-value">{learningDashboard.studyDays}일</div>
                </div>
              </div>

              <div aria-label="주간 독서 목표 진행률" style={{ height: '10px', borderRadius: '999px', overflow: 'hidden', background: 'var(--bg-secondary)', marginBottom: '20px' }}>
                <div style={{ width: `${Math.min(100, Math.round((learningDashboard.weekReads / weeklyReadingGoal) * 100))}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 150ms ease' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}>
                  <strong style={{ display: 'block', marginBottom: '8px' }}>강점</strong>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem', lineHeight: 1.6 }}>
                    {learningDashboard.strongSkills.length ? learningDashboard.strongSkills.join(', ') : '학습 기록이 더 쌓이면 표시됩니다.'}
                  </div>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}>
                  <strong style={{ display: 'block', marginBottom: '8px' }}>보완할 영역</strong>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem', lineHeight: 1.6 }}>
                    {learningDashboard.weakSkills.length ? learningDashboard.weakSkills.join(', ') : '반복해서 어려워한 영역이 아직 없습니다.'}
                  </div>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}>
                  <strong style={{ display: 'block', marginBottom: '8px' }}>약한 문법</strong>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem', lineHeight: 1.6 }}>
                    {learningDashboard.profileData?.weakGrammarTags.length ? learningDashboard.profileData.weakGrammarTags.join(', ') : '반복해서 어려워한 문법이 아직 없습니다.'}
                  </div>
                </div>
              </div>

              <Link
                href={learningDashboard.weakSkills.includes('문맥 속 어휘') ? '/vocabulary' : '/library'}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {learningDashboard.weakSkills.includes('문맥 속 어휘')
                  ? '다음 행동: 오늘의 단어 복습하기'
                  : learningDashboard.weekReads < weeklyReadingGoal
                    ? '다음 행동: 이번 주 독서 목표 이어가기'
                    : '다음 행동: 추천 글 읽기'}
              </Link>
              <p style={{ color: 'var(--text-muted)', fontSize: '.72rem', margin: '8px 0 0', textAlign: 'center' }}>주간 목표 변경은 아래 ‘설정 저장하기’를 누르면 저장됩니다.</p>
            </>
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
                          <div style={{ color: '#d97706' }}>• 단어 저장: {day.vocabCount}개</div>
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
                    <div style={{ width: '12px', height: '8px', background: '#d97706', borderRadius: '2px' }} />
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
                  background: selectedLang === lang.value ? 'rgba(217,119,6,0.1)' : 'var(--bg-secondary)',
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
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>🎯 한국어 레벨 (클릭하여 변경)</div>
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
                  background: selectedLevel === level.value ? 'rgba(217,119,6,0.1)' : 'var(--bg-secondary)',
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

        {/* 저장 제출 단추 */}
        <button
          id="save-profile-btn"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '16px', marginBottom: '24px' }}
        >
          {saving ? '저장 중...' : saved ? '✅ 저장 완료!' : '설정 저장하기'}
        </button>

        {/* 계정 관리 / 회원 탈퇴 섹션 */}
        <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>
            ⚠️ 위험 지역 (계정 관리)
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            회원 탈퇴 시 저장된 어휘, 학습 기록 및 개인 설정이 모두 완전히 영구 삭제되며 복구할 수 없습니다.
          </p>
          <button
            onClick={handleDeleteAccount}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #ef4444',
              background: 'transparent',
              color: '#ef4444',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease'
            }}
          >
            회원 탈퇴하기
          </button>
        </div>
      </div>
    </div>
  );
}

