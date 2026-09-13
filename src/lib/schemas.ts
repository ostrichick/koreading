import { z } from 'zod';

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const languages = ['en', 'es', 'ja', 'zh'] as const;
export const topics = ['fairy-tales', 'daily-life', 'culture', 'nature-travel', 'k-content', 'news', 'food', 'history'] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
const common = { customApiKey: z.string().trim().max(256).optional(), nativeLang: z.enum(languages).default('en') };
export const aiRequestSchema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('generateArticle'), level: z.enum(levels), topic: z.enum(topics), customKeyword: z.string().max(100).optional(), genre: z.enum(['random', 'essay', 'dialogue', 'column', 'story']).default('random'), recentTitles: z.array(text(200)).max(10).default([]) }),
  z.object({ ...common, action: z.literal('lookupWord'), type: z.enum(['all', 'basic', 'advanced']).default('all'), word: text(50), sentence: text(1000) }),
  z.object({ ...common, action: z.literal('generateTest') }),
  z.object({ ...common, action: z.literal('tutorChat'), level: z.enum(levels), paragraph: text(5000), userMessage: text(1000), chatHistory: z.array(z.object({ role: z.enum(['user', 'model']), parts: z.array(z.object({ text: text(2500) })).length(1) })).max(20).default([]) }),
]);
export const articleSchema = z.object({
  title: text(200), content: text(10000), summary: text(1000),
  summaries: z.object({ en: text(1000), es: text(1000), ja: text(1000), zh: text(1000) }).optional(),
  summaryLanguage: z.enum(languages).optional(), topicCategory: z.enum(topics), level: z.enum(levels),
  estimatedMinutes: z.number().int().min(1).max(60), keyVocabulary: z.array(text(50)).length(5),
  imagePrompts: z.array(text(2000)).max(2).optional(),
  grammarEvidence: z.array(z.object({ pattern: text(200), quote: text(1000) })).min(2).max(3).optional(),
  imageUrls: z.array(z.string().url().max(6000).refine(u => new URL(u).hostname === 'image.pollinations.ai' && new URL(u).protocol === 'https:')).max(2).optional(),
  generatorModel: z.string().max(100).optional(),
});
export const reviewSchema = z.object({ articleId: text(128).regex(/^[\w-]+$/), rating: z.number().int().min(1).max(5), pros: z.string().trim().max(2000), cons: z.string().trim().max(2000) });
export const basicWordSchema = z.object({ word: text(50), dictionaryForm: text(50), pronunciation: text(200), partOfSpeech: text(100), definition: text(1500), translation: text(1000), level: z.enum(levels) });
export const advancedWordSchema = z.object({ structure: text(2500), examples: z.array(z.object({ korean: text(1000), translation: text(1000) })).min(1).max(3) });
export const placementSchema = z.object({ levels: z.array(z.object({ level: z.enum(levels), text: text(2000), questions: z.array(z.object({ question: text(1000), options: z.array(text(500)).length(4), correct: z.number().int().min(0).max(3) })).length(2) })).length(6) }).refine(data => data.levels.every((l, i) => l.level === levels[i]), 'Levels must be ordered A1 through C2');
export function parseModelJson(value: string) {
  return JSON.parse(value.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
}
