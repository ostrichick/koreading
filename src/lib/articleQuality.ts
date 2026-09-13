import { articleSchema } from './schemas';
import { KOREAN_CURRICULUM } from './koreanCurriculum';
import type { CEFRLevel } from './gemini';
import type { z } from 'zod';
export class ArticleQualityError extends Error {}

export function validateArticleQuality(article: z.infer<typeof articleSchema>, level: CEFRLevel, topic: string) {
  if (article.level !== level || article.topicCategory !== topic) throw new ArticleQualityError('Article does not match request');
  if (/[A-Za-z\u4e00-\u9fff\u3040-\u30ff]/.test(article.title + article.content)) throw new ArticleQualityError('Non-Korean text in article');
  const bounds = KOREAN_CURRICULUM[level].lengthConstraint.match(/(\d+)~(\d+)/);
  if (bounds && (article.content.length < Number(bounds[1]) * 0.8 || article.content.length > Number(bounds[2]) * 1.2)) throw new ArticleQualityError('Article length outside curriculum tolerance');
  if (new Set(article.keyVocabulary).size !== 5) throw new ArticleQualityError('Duplicate vocabulary');
  // Exact surface forms are requested; this is a mechanical check, not a linguistic assessment.
  for (const word of article.keyVocabulary) {
    if (article.content.split(word).length - 1 < 2) throw new ArticleQualityError('Target vocabulary needs two occurrences');
  }
  if (!article.summaries) throw new ArticleQualityError('Missing multilingual summaries');
  const evidence = article.grammarEvidence || [];
  if (new Set(evidence.map(e => e.pattern)).size < 2 || evidence.some(e => !KOREAN_CURRICULUM[level].targetGrammar.includes(e.pattern) || !article.content.includes(e.quote))) {
    throw new ArticleQualityError('Missing verifiable target-grammar quotations');
  }
  return article;
}
