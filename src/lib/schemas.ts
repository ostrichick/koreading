import { z } from 'zod';

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const languages = ['en', 'es', 'ja', 'zh'] as const;
export const topics = ['fairy-tales', 'daily-life', 'culture', 'nature-travel', 'k-content', 'news', 'food', 'history'] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
// Korean text may include punctuation, numbers and whitespace, but not letters from other scripts.
// This is an alphabet check, not a CEFR or grammatical-correctness assessment.
export const koreanLettersOnly = (value: string) => [...value].every(char =>
  !/\p{L}/u.test(char) || /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/u.test(char));
const koreanText = (max: number) => text(max).refine(koreanLettersOnly, 'Korean-only field contains foreign letters');
const uniqueValues = (values: string[]) => new Set(values.map(value => value.normalize('NFC').toLocaleLowerCase())).size === values.length;
const common = { customApiKey: z.string().trim().max(256).optional(), nativeLang: z.enum(languages).default('en') };
const seriesContextSchema = z.object({
  seriesId: z.string().trim().min(1).max(128).regex(/^[\w-]+$/),
  seriesTitle: koreanText(200).optional(),
  episodeNumber: z.number().int().min(1).max(100),
  previousArticleId: z.string().trim().min(1).max(128).regex(/^[\w-]+$/).optional(),
  previousTitle: koreanText(200).optional(),
  previousContent: koreanText(5000).optional(),
  previousChoice: koreanText(500).optional(),
}).optional();
export const aiRequestSchema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('generateArticle'), level: z.enum(levels), topic: z.enum(topics), customKeyword: z.string().max(100).optional(), genre: z.enum(['random', 'essay', 'dialogue', 'column', 'story', 'kakaotalk', 'mystery', 'review']).default('random'), recentTitles: z.array(text(200)).max(10).default([]), seriesContext: seriesContextSchema }),
  z.object({ ...common, action: z.literal('lookupWord'), type: z.enum(['all', 'basic', 'advanced']).default('all'), word: text(50), sentence: text(1000) }),
  z.object({ ...common, action: z.literal('generateTest') }),
  z.object({ ...common, action: z.literal('tutorChat'), level: z.enum(levels), paragraph: text(5000), userMessage: text(1000), guidanceStage: z.enum(['hint', 'strong-hint', 'explanation']).default('hint'), chatHistory: z.array(z.object({ role: z.enum(['user', 'model']), parts: z.array(z.object({ text: text(2500) })).length(1) })).max(20).default([]) }),
  z.object({ ...common, action: z.literal('writingFeedback'), level: z.enum(levels), prompt: koreanText(1000), response: koreanText(2000) }),
]);
export const comprehensionQuestionSchema = z.object({
  kind: z.enum(['main', 'detail', 'vocabulary']),
  question: koreanText(500),
  options: z.array(koreanText(300)).length(4).refine(uniqueValues, 'Quiz options must be distinct'),
  correct: z.number().int().min(0).max(3),
  explanation: koreanText(1000),
  paragraphIndex: z.number().int().min(0).max(50),
});
export const comprehensionQuizSchema = z.array(comprehensionQuestionSchema).length(3)
  .refine(questions => new Set(questions.map(question => question.kind)).size === 3, 'Quiz must cover main, detail and vocabulary');
export const articleSchema = z.object({
  title: koreanText(200),
  content: koreanText(10000).refine(v => v.trim().length >= 80, 'Article too short'),
  summary: text(1000),
  summaries: z.object({ en: text(1000), es: text(1000), ja: text(1000), zh: text(1000) }).optional(),
  summaryLanguage: z.enum(languages).optional(), topicCategory: z.enum(topics), level: z.enum(levels),
  estimatedMinutes: z.number().int().min(1).max(60), keyVocabulary: z.array(koreanText(50)).min(1).max(10).refine(uniqueValues, 'Vocabulary must be unique'),
  hookQuote: koreanText(500).optional(),
  discussionPrompt: text(1000).optional(),
  genre: text(100).optional(),
  imagePrompts: z.array(text(2000)).max(2).optional(),
  grammarEvidence: z.array(z.object({ pattern: text(200), quote: koreanText(1000) })).min(2).max(3).optional(),
  comprehensionQuiz: comprehensionQuizSchema.optional(),
  continuationChoices: z.array(koreanText(500)).length(2).refine(uniqueValues, 'Continuation choices must be distinct').optional(),
  writingPrompt: koreanText(1000).optional(),
  seriesId: z.string().trim().min(1).max(128).regex(/^[\w-]+$/).optional(),
  seriesTitle: koreanText(200).optional(),
  episodeNumber: z.number().int().min(1).max(100).optional(),
  previousEpisodeId: z.string().trim().min(1).max(128).regex(/^[\w-]+$/).optional(),
  imageUrls: z.array(z.string().url().max(6000).refine(u => ['image.pollinations.ai', 'images.unsplash.com', 'upload.wikimedia.org'].includes(new URL(u).hostname) && new URL(u).protocol === 'https:')).max(2).optional(),
  generatorModel: z.string().max(100).optional(),
});
export const generatedArticleSchema = articleSchema.extend({
  comprehensionQuiz: comprehensionQuizSchema,
  discussionPrompt: text(1000),
  continuationChoices: z.array(koreanText(500)).length(2).refine(uniqueValues, 'Continuation choices must be distinct'),
  writingPrompt: koreanText(1000),
})
  .refine(article => {
    const paragraphCount = article.content.split('\n').filter(paragraph => paragraph.trim()).length;
    return article.comprehensionQuiz.every(question => question.paragraphIndex < paragraphCount);
  }, 'Quiz paragraph index must reference an existing non-empty paragraph');
export const reviewSchema = z.object({ articleId: text(128).regex(/^[\w-]+$/), rating: z.number().int().min(1).max(5), pros: z.string().trim().max(2000), cons: z.string().trim().max(2000) });
export const basicWordSchema = z.object({ word: text(50), dictionaryForm: koreanText(50), pronunciation: text(200), partOfSpeech: koreanText(100), definition: koreanText(1500), translation: text(1000), level: z.enum(levels) });
export const advancedWordSchema = z.object({ structure: koreanText(2500), examples: z.array(z.object({ korean: koreanText(1000), translation: text(1000) })).min(1).max(3) });
export const writingFeedbackSchema = z.object({
  meaningClear: z.boolean(),
  feedback: text(1200),
  correction: koreanText(1200).optional(),
  reason: text(1200),
  naturalExpression: koreanText(500).optional(),
});
export const placementSchema = z.object({ levels: z.array(z.object({ level: z.enum(levels), text: koreanText(2000), questions: z.array(z.object({ question: text(1000), options: z.array(text(500)).length(4).refine(uniqueValues, 'Answer options must be distinct'), correct: z.number().int().min(0).max(3) })).length(2) })).length(6) }).refine(data => data.levels.every((l, i) => l.level === levels[i]), 'Levels must be ordered A1 through C2');
export function parseModelJson(value: string) {
  return JSON.parse(value.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
}
