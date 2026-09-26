import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedCron } from '../src/lib/cronAuth';
import { aiRequestSchema, articleSchema, generatedArticleSchema, placementSchema, levels, parseModelJson } from '../src/lib/schemas';
import { recommendLevel, wordCacheKey, nextReviewIntervalDays, deriveLearningProfile, recommendReading, readingCompletionStreak, currentCalendarWeekCount, currentCalendarWeekStudyDays } from '../src/lib/learning';
import { boundedJson } from '../src/lib/readJson';
import { checkAiQuota } from '../src/lib/aiQuota';

test('cron refuses spoofed headers and absent secrets', () => {
  assert.equal(isAuthorizedCron(new Headers({ 'user-agent': 'vercel-cron' }), 'secret'), false);
  assert.equal(isAuthorizedCron(new Headers({ authorization: 'Bearer undefined' }), undefined), false);
  assert.equal(isAuthorizedCron(new Headers({ authorization: 'Bearer secret' }), 'secret'), true);
});
test('AI validates nested sizes, enumerations and actual types', () => {
  assert.equal(aiRequestSchema.safeParse({ action: 'generateTest', nativeLang: 'ja' }).success, true);
  assert.equal(aiRequestSchema.safeParse({ action: 'lookupWord', word: {}, sentence: '눈이 와요.' }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'generateArticle', level: 'A1', topic: 'food', recentTitles: Array(11).fill('title') }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'tutorChat', level: 'A1', paragraph: '글', userMessage: '질문', chatHistory: [{ role: 'model', parts: [{ text: 'x'.repeat(2501) }] }] }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'tutorChat', level: 'A1', paragraph: '글', userMessage: '질문', guidanceStage: 'strong-hint' }).success, true);
  assert.equal(aiRequestSchema.safeParse({ action: 'tutorChat', level: 'A1', paragraph: '글', userMessage: '질문', guidanceStage: 'answer-now' }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'generateArticle', level: 'A1', topic: 'food', seriesContext: { seriesId: 'series-1', episodeNumber: 2, previousChoice: '친구를 따라갑니다.' } }).success, true);
  assert.equal(aiRequestSchema.safeParse({ action: 'generateArticle', level: 'A1', topic: 'food', seriesContext: { seriesId: '../bad', episodeNumber: 2 } }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'writingFeedback', level: 'A2', prompt: '주인공의 행동을 한 문장으로 설명해 보세요.', response: '주인공은 시장에서 친구를 만났어요.', nativeLang: 'en' }).success, true);
  assert.equal(aiRequestSchema.safeParse({ action: 'writingFeedback', level: 'A2', prompt: 'Write in English', response: '주인공은 친구를 만났어요.' }).success, false);
});
test('six levels and valid answer indices are required', () => {
  const data = { levels: levels.map(level => ({ level, text: '눈이 와요.', questions: [0,1].map(correct => ({ correct, question: 'Question', options: ['a','b','c','d'] })) })) };
  assert.equal(placementSchema.safeParse(data).success, true);
  assert.equal(placementSchema.safeParse({ levels: data.levels.slice(1) }).success, false);
  data.levels[0].questions[0].correct = 4;
  assert.equal(placementSchema.safeParse(data).success, false);
});
test('placement does not grant an untested higher level', () => {
  assert.equal(recommendLevel({ A1: [1,1], A2: [1,0] }), 'A1');
  assert.equal(recommendLevel({ A1: [1,1], A2: [1,1] }), 'A2');
  assert.equal(recommendLevel({ A1: [0,0], C2: [1,1] }), 'A1');
});
test('cache distinguishes word senses and output languages', () => {
  assert.notEqual(wordCacheKey('물었어요', '길을 물었어요.', 'en'), wordCacheKey('물었어요', '개가 물었어요.', 'en'));
  assert.notEqual(wordCacheKey('눈', '눈이 와요.', 'en'), wordCacheKey('눈', '눈이 와요.', 'ja'));
});
test('spaced repetition advances on recall and resets to the shortest interval after a miss', () => {
  assert.equal(nextReviewIntervalDays(0, true), 1);
  assert.equal(nextReviewIntervalDays(1, true), 3);
  assert.equal(nextReviewIntervalDays(7, true), 14);
  assert.equal(nextReviewIntervalDays(90, true), 90);
  assert.equal(nextReviewIntervalDays(30, false), 1);
  assert.equal(nextReviewIntervalDays(Number.NaN, true), 1);
});
test('adaptive reading profile changes at most one level and only with enough recent evidence', () => {
  const high = Array.from({ length: 5 }, () => ({ lastQuizScore: 3, lastQuizTotal: 3, difficultyFeedback: 'easy' as const }));
  const low = Array.from({ length: 3 }, () => ({ lastQuizScore: 1, lastQuizTotal: 3, difficultyFeedback: 'hard' as const }));
  assert.equal(deriveLearningProfile(high, 'A2').estimatedLevel, 'B1');
  assert.equal(deriveLearningProfile(high, 'C2').estimatedLevel, 'C2');
  assert.equal(deriveLearningProfile(low, 'B1').estimatedLevel, 'A2');
  assert.equal(deriveLearningProfile([{ lastQuizScore: 3, lastQuizTotal: 3, difficultyFeedback: 'easy' }], 'A2').estimatedLevel, 'A2');
});
test('adaptive profile surfaces repeated weak skills and recommendation skips completed readings', () => {
  const profile = deriveLearningProfile([
    { lastQuizScore: 1, lastQuizTotal: 3, lastQuizBreakdown: { main: true, detail: false, vocabulary: false }, difficultyFeedback: 'hard', grammarTags: ['-는데'] },
    { lastQuizScore: 1, lastQuizTotal: 3, lastQuizBreakdown: { main: true, detail: false, vocabulary: false }, difficultyFeedback: 'hard', grammarTags: ['-는데'] },
  ], 'A2');
  assert.deepEqual(profile.weakSkills, ['detail', 'vocabulary']);
  assert.deepEqual(profile.weakGrammarTags, ['-는데']);
  const articles = [
    { id: 'done', level: 'A1', grammarEvidence: [{ pattern: '-는데' }] },
    { id: 'target', level: 'A1', grammarEvidence: [{ pattern: '-는데' }] },
    { id: 'far', level: 'B2', grammarEvidence: [] },
  ];
  assert.equal(recommendReading(articles, profile, ['done'])?.id, 'target');
});
test('weekly dashboard helpers use the local Monday-Sunday week and unique study days', () => {
  const now = new Date(2026, 8, 23, 12, 0, 0); // Wednesday
  const monday = new Date(2026, 8, 21, 9, 0, 0);
  const wednesday = new Date(2026, 8, 23, 10, 0, 0);
  const previousSunday = new Date(2026, 8, 20, 23, 0, 0);
  const nextMonday = new Date(2026, 8, 28, 0, 0, 0);
  assert.equal(currentCalendarWeekCount([monday, wednesday, previousSunday, nextMonday], now), 2);
  assert.equal(currentCalendarWeekStudyDays([monday, monday, wednesday, previousSunday], now), 2);
});
test('reading streak starts from today or yesterday, ignores duplicates and stops at the first gap', () => {
  const now = new Date(2026, 8, 23, 12, 0, 0);
  assert.equal(readingCompletionStreak([], now), 0);
  assert.equal(readingCompletionStreak([
    new Date(2026, 8, 23, 8),
    new Date(2026, 8, 23, 18),
    new Date(2026, 8, 22, 8),
    new Date(2026, 8, 21, 8),
    new Date(2026, 8, 19, 8),
  ], now), 3);
  assert.equal(readingCompletionStreak([
    new Date(2026, 8, 22, 8),
    new Date(2026, 8, 21, 8),
  ], now), 2);
});
test('valid short readings are not rejected for approximate curriculum targets', () => {
  const a = { title: '시장에 가요', content: '시장에 가요. 사과를 사요. '.repeat(8), summary: 'Market', level: 'A1', topicCategory: 'food', keyVocabulary: ['시장','사과'], estimatedMinutes: 1 };
  assert.equal(articleSchema.safeParse(a).success, true);
  assert.equal(articleSchema.safeParse({ ...a, content: '' }).success, false);
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
});
test('Korean-only fields reject other alphabets and duplicate vocabulary', () => {
  const valid = { title: '시장에 가요', content: '시장에 가요. 사과를 사요. '.repeat(8), summary: 'Market', level: 'A1', topicCategory: 'food', keyVocabulary: ['시장','사과'], estimatedMinutes: 1 };
  assert.equal(articleSchema.safeParse({ ...valid, content: 'Hello. '.repeat(16) }).success, false);
  assert.equal(articleSchema.safeParse({ ...valid, title: '시장 日本語' }).success, false);
  assert.equal(articleSchema.safeParse({ ...valid, keyVocabulary: ['시장', '시장'] }).success, false);
  assert.equal(articleSchema.safeParse(valid).success, true);
});
test('new generated readings require a three-part comprehension quiz while legacy articles stay valid', () => {
  const legacy = { title: '시장에 가요', content: '시장에 가요.\n사과를 사요.\n친구를 만나요.\n집에 돌아가요. '.repeat(3), summary: 'Market', level: 'A1', topicCategory: 'food', keyVocabulary: ['시장','사과'], estimatedMinutes: 1 };
  const quiz = [
    { kind: 'main', question: '글의 중심 내용은 무엇인가요?', options: ['시장에 간 이야기', '학교에 간 이야기', '산에 간 이야기', '바다에 간 이야기'], correct: 0, explanation: '시장에 가서 사과를 사는 이야기입니다.', paragraphIndex: 0 },
    { kind: 'detail', question: '무엇을 샀나요?', options: ['책', '사과', '신발', '우산'], correct: 1, explanation: '두 번째 문단에서 사과를 샀습니다.', paragraphIndex: 1 },
    { kind: 'vocabulary', question: '시장과 가장 가까운 뜻은 무엇인가요?', options: ['물건을 사고파는 곳', '공부하는 곳', '운동하는 곳', '잠을 자는 곳'], correct: 0, explanation: '시장에서는 여러 물건을 사고팝니다.', paragraphIndex: 0 },
  ] as const;
  assert.equal(articleSchema.safeParse(legacy).success, true);
  assert.equal(generatedArticleSchema.safeParse(legacy).success, false);
  const generated = { ...legacy, discussionPrompt: '당신이라면 무엇을 할까요?', continuationChoices: ['친구를 기다립니다.', '혼자 먼저 갑니다.'], writingPrompt: '본문의 단어 하나를 사용해서 문장을 만들어 보세요.', comprehensionQuiz: quiz };
  assert.equal(generatedArticleSchema.safeParse(generated).success, true);
  assert.equal(generatedArticleSchema.safeParse({ ...generated, comprehensionQuiz: quiz.slice(0, 2) }).success, false);
  assert.equal(generatedArticleSchema.safeParse({ ...generated, comprehensionQuiz: quiz.map(q => ({ ...q, kind: 'main' })) }).success, false);
  assert.equal(generatedArticleSchema.safeParse({ ...generated, comprehensionQuiz: quiz.map((q, i) => i === 0 ? { ...q, paragraphIndex: 99 } : q) }).success, false);
  assert.equal(generatedArticleSchema.safeParse({ ...generated, continuationChoices: ['같은 선택', '같은 선택'] }).success, false);
});
test('placement options must be distinct for each question', () => {
  const levelsData = levels.map(level => ({ level, text: '눈이 와요.', questions: [0, 1].map(correct => ({ question: 'What happened?', options: ['snow', 'rain', 'wind', 'sun'], correct })) }));
  assert.equal(placementSchema.safeParse({ levels: levelsData }).success, true);
  levelsData[0].questions[0].options = ['snow', ' snow ', 'wind', 'sun'];
  assert.equal(placementSchema.safeParse({ levels: levelsData }).success, false);
});
test('body limit applies even without a Content-Length header', async () => {
  await assert.rejects(boundedJson(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(25000) }) })), (e: unknown) => (e as {status:number}).status === 413);
});
test('local limit bounds concurrent requests and resets with the window', async () => {
  const now = 100000;
  const results = await Promise.all(Array.from({ length: 25 }, () => checkAiQuota('test-local', now)));
  assert.equal(results.filter(Boolean).length, 20);
  assert.equal(await checkAiQuota('test-local', now + 60000), true);
});
test('configured shared limiter does not fall back to local state when unavailable', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 503 });
  try { await assert.rejects(checkAiQuota('shared')); }
  finally { globalThis.fetch = original; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; }
});
