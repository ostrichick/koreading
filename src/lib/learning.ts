import { levels, type languages } from './schemas';
import type { CEFRLevel } from './gemini';

export function recommendLevel(answers: Record<string, number[]>): CEFRLevel {
  let result: CEFRLevel = 'A1';
  for (const level of levels) {
    const scores = answers[level] || [];
    if (scores.length !== 2 || scores.some(s => s !== 1)) break;
    result = level;
  }
  return result;
}
export function wordCacheKey(word: string, sentence: string, language: string) {
  return `koreading_word_v2_${JSON.stringify([word.trim(), sentence.trim(), language])}`;
}

const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 90] as const;

/**
 * Small, deterministic spaced-repetition schedule used by the private vocabulary store.
 * A miss returns the word to the shortest interval; a hit advances to the next interval.
 */
export function nextReviewIntervalDays(currentDays: number, remembered: boolean): number {
  if (!remembered) return 1;
  const safeCurrent = Number.isFinite(currentDays) && currentDays >= 0 ? currentDays : 0;
  return REVIEW_INTERVALS.find(days => days > safeCurrent) ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

export type QuizBreakdown = { main: boolean; detail: boolean; vocabulary: boolean };
export type LearningDifficulty = 'easy' | 'just-right' | 'hard';
export interface LearningSignal {
  level?: string;
  topicCategory?: string;
  lastQuizScore?: number;
  lastQuizTotal?: number;
  lastQuizBreakdown?: QuizBreakdown;
  difficultyFeedback?: LearningDifficulty;
  grammarTags?: string[];
}
export interface AdaptiveLearningProfile {
  declaredLevel: CEFRLevel;
  estimatedLevel: CEFRLevel;
  recentComprehensionRate: number | null;
  preferredDifficulty: LearningDifficulty;
  weakSkills: ('main' | 'detail' | 'vocabulary')[];
  weakGrammarTags: string[];
  sampleSize: number;
}

/** Conservative one-step adaptation from recent observed learning signals. */
export function deriveLearningProfile(signals: LearningSignal[], declaredLevel: CEFRLevel): AdaptiveLearningProfile {
  const recent = signals.slice(0, 5);
  const quizSignals = recent.filter(signal => typeof signal.lastQuizScore === 'number' && signal.lastQuizTotal === 3);
  const rates = quizSignals.map(signal => Math.max(0, Math.min(1, (signal.lastQuizScore || 0) / 3)));
  const average = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : null;
  const difficulty = recent.map(signal => signal.difficultyFeedback).filter((value): value is LearningDifficulty => !!value);
  const count = (value: LearningDifficulty) => difficulty.filter(item => item === value).length;
  const preferredDifficulty: LearningDifficulty = count('hard') > count('just-right') && count('hard') >= count('easy')
    ? 'hard'
    : count('easy') > count('just-right') && count('easy') > count('hard') ? 'easy' : 'just-right';

  let shift = 0;
  if (quizSignals.length >= 3 && average !== null && average >= 0.85 && count('easy') >= 2) shift = 1;
  else if ((quizSignals.length >= 2 && average !== null && average < 0.6) || count('hard') >= 3) shift = -1;
  const declaredIndex = levels.indexOf(declaredLevel);
  const estimatedLevel = levels[Math.max(0, Math.min(levels.length - 1, declaredIndex + shift))] as CEFRLevel;

  const weakSkillCounts = { main: 0, detail: 0, vocabulary: 0 };
  const grammarCounts = new Map<string, number>();
  for (const signal of recent) {
    if (signal.lastQuizBreakdown) {
      if (!signal.lastQuizBreakdown.main) weakSkillCounts.main++;
      if (!signal.lastQuizBreakdown.detail) weakSkillCounts.detail++;
      if (!signal.lastQuizBreakdown.vocabulary) weakSkillCounts.vocabulary++;
    }
    const struggled = signal.difficultyFeedback === 'hard'
      || (typeof signal.lastQuizScore === 'number' && signal.lastQuizScore <= 1);
    if (struggled) for (const tag of signal.grammarTags || []) grammarCounts.set(tag, (grammarCounts.get(tag) || 0) + 1);
  }
  const weakSkills = (Object.entries(weakSkillCounts) as ['main' | 'detail' | 'vocabulary', number][])
    .filter(([, misses]) => misses >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill);
  const weakGrammarTags = [...grammarCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag);

  return {
    declaredLevel,
    estimatedLevel,
    recentComprehensionRate: average === null ? null : Math.round(average * 100),
    preferredDifficulty,
    weakSkills,
    weakGrammarTags,
    sampleSize: recent.length,
  };
}

export function recommendReading<T extends { id: string; level: string; grammarEvidence?: { pattern: string }[] }>(
  articles: T[],
  profile: AdaptiveLearningProfile,
  completedArticleIds: string[],
): T | null {
  const targetIndex = levels.indexOf(profile.estimatedLevel);
  return [...articles]
    .filter(article => !completedArticleIds.includes(article.id))
    .sort((a, b) => {
      const score = (article: T) => {
        const levelIndex = levels.indexOf(article.level as CEFRLevel);
        const levelDistance = levelIndex < 0 ? 9 : Math.abs(levelIndex - targetIndex);
        const grammarBoost = (article.grammarEvidence || []).some(item => profile.weakGrammarTags.includes(item.pattern)) ? 2 : 0;
        return 20 - levelDistance * 5 + grammarBoost;
      };
      return score(b) - score(a);
    })[0] || null;
}

export function readingCompletionStreak(dates: Date[], now = new Date()): number {
  const keys = new Set(dates.map(date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`));
  if (!keys.size) return 0;
  const key = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!keys.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (keys.has(key(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Current local Monday-Sunday calendar week. */
export function currentCalendarWeekCount(dates: Date[], now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return dates.filter(date => date >= start && date < end).length;
}

export function currentCalendarWeekStudyDays(dates: Date[], now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return new Set(dates.filter(date => date >= start && date < end).map(date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`)).size;
}
export function articleSummary(article: { summary: string; summaryLanguage?: string; summaries?: Partial<Record<typeof languages[number], string>> }, language: typeof languages[number]) {
  return article.summaries?.[language] || (article.summaryLanguage === language ? article.summary : '');
}
export function reviewAggregate(old: { ratingCount?: number; ratingSum?: number; averageRating?: number }, previous: number | undefined, rating: number) {
  const count = (old.ratingCount || 0) + (previous === undefined ? 1 : 0);
  const sum = (old.ratingSum ?? (old.averageRating || 0) * (old.ratingCount || 0)) - (previous || 0) + rating;
  return { ratingCount: count, ratingSum: sum, averageRating: count ? Math.round(sum / count * 10) / 10 : 0 };
}
