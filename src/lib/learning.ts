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
export function articleSummary(article: { summary: string; summaryLanguage?: string; summaries?: Partial<Record<typeof languages[number], string>> }, language: typeof languages[number]) {
  return article.summaries?.[language] || (article.summaryLanguage === language ? article.summary : '');
}
export function reviewAggregate(old: { ratingCount?: number; ratingSum?: number; averageRating?: number }, previous: number | undefined, rating: number) {
  const count = (old.ratingCount || 0) + (previous === undefined ? 1 : 0);
  const sum = (old.ratingSum ?? (old.averageRating || 0) * (old.ratingCount || 0)) - (previous || 0) + rating;
  return { ratingCount: count, ratingSum: sum, averageRating: count ? Math.round(sum / count * 10) / 10 : 0 };
}
