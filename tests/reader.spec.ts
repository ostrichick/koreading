import { test, expect } from '@playwright/test';
const article = {
  id: 'guest', title: '눈 이야기', content: '눈이 와요.\n\n눈이 아파요.', summary: 'Snow',
  summaries: { en: 'Snow', es: 'Nieve', ja: '雪', zh: '雪' }, level: 'A1', topicCategory: 'daily-life', estimatedMinutes: 1, keyVocabulary: [],
  discussionPrompt: '다음에는 무엇을 해 볼까요?',
  continuationChoices: ['친구와 눈사람을 만들어요.', '집에서 따뜻한 차를 마셔요.'],
  writingPrompt: '눈이 오는 날 하고 싶은 일을 한 문장으로 써 보세요.',
  comprehensionQuiz: [
    { kind: 'main', question: '글의 중심 내용은 무엇인가요?', options: ['눈 이야기', '비 이야기', '바람 이야기', '학교 이야기'], correct: 0, explanation: '글은 눈에 대한 두 가지 문장을 보여 줍니다.', paragraphIndex: 0 },
    { kind: 'detail', question: '두 번째 문단에서 어디가 아픈가요?', options: ['눈', '손', '발', '배'], correct: 0, explanation: '두 번째 문단에 눈이 아프다고 했습니다.', paragraphIndex: 1 },
    { kind: 'vocabulary', question: '와요와 가장 가까운 뜻은 무엇인가요?', options: ['옵니다', '갑니다', '잡니다', '먹습니다'], correct: 0, explanation: '와요는 오다의 활용형입니다.', paragraphIndex: 0 },
  ],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(value => {
    sessionStorage.setItem('koreading_guest_article', JSON.stringify(value));
    localStorage.setItem('koreading_native_lang', 'en');
    localStorage.setItem('koreading_level', 'A1');
  }, article);
});
test('guest reader handles out-of-order dictionary responses and caches each context', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let calls = 0;
  await page.route('**/api/ai', async route => {
    const body = route.request().postDataJSON(); calls++;
    const slow = body.sentence.includes('와요');
    await new Promise(resolve => setTimeout(resolve, slow ? 500 : 20));
    await route.fulfill({ json: { word: body.word, dictionaryForm: '눈', pronunciation: 'nun', partOfSpeech: '명사', definition: slow ? '하늘에서 내리는 것' : '보는 기관', translation: slow ? 'snow' : 'eye', level: 'A1', structure: '명사', examples: [{ korean: '눈이 와요.', translation: 'It snows.' }] } });
  });
  await page.goto('/read/guest');
  const words = page.getByRole('button', { name: '눈이', exact: true });
  await words.nth(0).click(); await words.nth(1).click();
  await expect(page.locator('.mini-tooltip-popup')).toContainText('eye');
  await page.waitForTimeout(650);
  await expect(page.locator('.mini-tooltip-popup')).toContainText('eye');
  await page.getByRole('heading', { name: '눈 이야기' }).click();
  await words.nth(0).click(); await expect(page.locator('.mini-tooltip-popup')).toContainText('snow');
  expect(calls).toBe(2); expect(errors).toEqual([]);
});
test('closing a dictionary while a request is pending does not reopen it', async ({ page }) => {
  await page.route('**/api/ai', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({ json: { word: '눈이', dictionaryForm: '눈', pronunciation: 'nun', partOfSpeech: '명사', definition: '눈', translation: 'snow', level: 'A1', structure: '명사', examples: [{ korean: '눈', translation: 'snow' }] } });
  });
  await page.goto('/read/guest');
  await page.getByRole('button', { name: '눈이', exact: true }).first().click();
  await page.getByRole('heading', { name: '눈 이야기' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.mini-tooltip-popup')).toHaveCount(0);
});
test('dictionary preserves basic meaning and explains missing advanced analysis', async ({ page }) => {
  await page.route('**/api/ai', route => route.fulfill({ json: {
    word: '눈이', dictionaryForm: '눈', pronunciation: 'nun', partOfSpeech: '명사',
    definition: '하늘에서 내리는 것', translation: 'snow', level: 'A1', _advancedUnavailable: true,
  } }));
  await page.goto('/read/guest');
  await page.getByRole('button', { name: '눈이', exact: true }).first().click();
  await expect(page.locator('.mini-tooltip-popup')).toContainText('snow');
  await page.getByRole('button', { name: /Details/ }).click();
  await expect(page.locator('.word-popup').getByRole('alert')).toContainText('Detailed analysis is temporarily unavailable.');
  await page.getByRole('button', { name: 'Close dictionary details' }).click();
  await expect(page.locator('.word-popup')).toHaveCount(0);
});
test('tutor disables duplicate sends and presents a recoverable error', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/ai', async route => { calls++; await new Promise(resolve => setTimeout(resolve, 200)); await route.fulfill({ status: 429, json: { error: 'Please retry later' } }); });
  await page.goto('/read/guest');
  await page.getByRole('button', { name: 'Ask tutor about paragraph' }).first().click();
  await page.getByRole('textbox', { name: 'Type your question...' }).fill('Explain snow');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeDisabled();
  await expect(page.locator('.reader-tutor-sidebar').getByRole('alert')).toContainText('Please retry later');
  await expect(page.getByRole('textbox', { name: 'Type your question...' })).toHaveValue('Explain snow');
  expect(calls).toBe(1);
});
test('library pagination and filter changes do not mix stale results', async ({ page }) => {
  await page.route('**/api/library?*', async route => {
    const query = new URL(route.request().url()).searchParams;
    const level = query.get('level');
    const next = query.has('cursor');
    await route.fulfill({ json: { articles: [{ ...article, id: next ? 'second' : 'first', title: level === 'B2' ? '중급 글' : next ? '다음 글' : '첫 글', level: level === 'B2' ? 'B2' : 'A1' }], cursor: !next && level === 'all' ? 'next-page' : null } });
  });
  await page.goto('/library');
  await expect(page.getByText('첫 글', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load more / 더 보기' }).click();
  await expect(page.getByText('다음 글', { exact: true })).toBeVisible();
  await expect(page.getByText('첫 글', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'B2', exact: true }).click();
  await expect(page.getByText('중급 글', { exact: true })).toBeVisible();
  await expect(page.getByText('첫 글', { exact: true })).toHaveCount(0);
});
test('disabled placement redirects to library without exposing an unvalidated assessment', async ({ page }) => {
  await page.goto('/test');
  await expect(page).toHaveURL(/\/library(?:\?|$)/);
  await expect(page.getByRole('button', { name: /레벨 테스트 시작/ })).toHaveCount(0);
});
test('public pages do not promote a disabled placement feature or index its URL', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('Level Test', { exact: true })).toHaveCount(0);
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'CEFR Level Test' })).toHaveCount(0);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).not.toContain('<loc>https://koreading.vercel.app/test</loc>');
});
test('vocabulary redirects unauthenticated visitors to sign in', async ({ page }) => {
  await page.goto('/vocabulary');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
test('mobile navigation exposes links and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation menu' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'About', exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.locator('#primary-navigation').getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
});
test('guest reader applies persisted dark theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('koreading_reader_theme', 'dark'));
  await page.goto('/read/guest');
  await expect(page.locator('.reader-theme-dark')).toBeVisible();
  await expect(page.locator('.reader-theme-dark')).toHaveCSS('background-color', 'rgb(28, 25, 23)');
});
test('guest reader completes the comprehension loop and returns to evidence', async ({ page }) => {
  await page.goto('/read/guest');
  await expect(page.getByRole('heading', { name: '읽은 내용을 확인해 보세요' })).toBeVisible();
  await page.getByLabel('눈 이야기', { exact: true }).check();
  await page.getByLabel('손', { exact: true }).check();
  await page.getByLabel('옵니다', { exact: true }).check();
  await page.getByRole('button', { name: '정답 확인' }).click();
  await expect(page.getByText('이해도 2 / 3')).toBeVisible();
  await expect(page.getByText('다시 확인해 보세요.')).toBeVisible();
  await page.getByRole('button', { name: '관련 문단 다시 보기' }).nth(1).click();
  await expect(page.locator('#reader-paragraph-1')).toBeFocused();
  await page.getByRole('button', { name: '어려워요' }).click();
  await expect(page.getByRole('button', { name: '어려워요' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '다시 풀기' }).click();
  await expect(page.getByRole('button', { name: '정답 확인' })).toBeDisabled();
});
test('guest reader tutor progresses from hint to stronger hint and full explanation without duplicating the question', async ({ page }) => {
  const stages: string[] = [];
  await page.route('**/api/ai', async route => {
    const body = route.request().postDataJSON();
    if (body.action !== 'tutorChat') return route.continue();
    stages.push(body.guidanceStage);
    await route.fulfill({ json: { text: `response-${body.guidanceStage}` } });
  });
  await page.goto('/read/guest');
  await page.getByRole('button', { name: 'Ask tutor about paragraph' }).first().click();
  await page.getByRole('textbox', { name: 'Type your question...' }).fill('Explain snow');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('response-hint')).toBeVisible();
  await page.getByRole('button', { name: 'Stronger hint' }).click();
  await expect(page.getByText('response-strong-hint')).toBeVisible();
  await page.getByRole('button', { name: 'Full explanation' }).click();
  await expect(page.getByText('response-explanation')).toBeVisible();
  await expect(page.locator('.tutor-bubble.user')).toHaveCount(1);
  expect(stages).toEqual(['hint', 'strong-hint', 'explanation']);
});
test('guest reader series choice persists into continuation context and re-enters the library', async ({ page }) => {
  await page.route('**/api/library?*', route => route.fulfill({ json: { articles: [], cursor: null } }));
  await page.goto('/read/guest');
  const firstChoice = page.getByRole('button', { name: /1\. 친구와 눈사람을 만들어요/ });
  await firstChoice.click();
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '이 선택으로 다음 화 만들기 →' }).click();
  await expect(page).toHaveURL(/\/library\?continue=1$/);
  const continuation = await page.evaluate(() => JSON.parse(sessionStorage.getItem('koreading_series_continuation') || '{}'));
  expect(continuation.previousChoice).toBe('친구와 눈사람을 만들어요.');
  expect(continuation.episodeNumber).toBe(2);
  expect(continuation.previousTitle).toBe('눈 이야기');
});
test('writing practice recovers from an AI error and lets the learner rewrite without persistent storage', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/ai', async route => {
    const body = route.request().postDataJSON();
    if (body.action !== 'writingFeedback') return route.continue();
    attempts++;
    if (attempts === 1) {
      await route.fulfill({ status: 503, json: { error: 'Temporary writing failure' } });
      return;
    }
    await route.fulfill({ json: {
      meaningClear: true,
      feedback: 'The meaning is clear and the sentence uses the topic well.',
      correction: '저는 눈이 오는 날 산책하고 싶어요.',
      reason: '조사를 넣으면 문장이 더 자연스럽습니다.',
      naturalExpression: '눈 오는 날에는 산책하고 싶어요.',
    } });
  });
  await page.goto('/read/guest');
  const draft = page.getByRole('textbox', { name: '한국어 쓰기 답변' });
  await draft.fill('저는 눈 오는 날 산책 싶어요.');
  await page.getByRole('button', { name: 'AI 피드백 받기' }).click();
  await expect(page.getByText('Temporary writing failure', { exact: true })).toBeVisible();
  await expect(draft).toHaveValue('저는 눈 오는 날 산책 싶어요.');
  await page.getByRole('button', { name: 'AI 피드백 받기' }).click();
  await expect(page.getByText('✓ 의미가 잘 전달됩니다')).toBeVisible();
  const rewrite = page.getByLabel('내 문장으로 다시 써보기');
  await expect(rewrite).toHaveValue('저는 눈 오는 날 산책 싶어요.');
  await rewrite.fill('저는 눈이 오는 날 산책하고 싶어요.');
  expect(await page.evaluate(() => Object.keys(localStorage).every(key => !key.toLowerCase().includes('writing')))).toBe(true);
});
test('TTS speed persists across reload and shadowing can reveal the original without speech recognition', async ({ page }) => {
  await page.addInitScript(() => {
    class MockUtterance {
      text: string; lang = ''; rate = 1; onend: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak(utterance: { onend?: (() => void) | null }) { setTimeout(() => utterance.onend?.(), 0); }, getVoices() { return []; } },
    });
  });
  await page.goto('/read/guest');
  const slow = page.getByRole('button', { name: '0.8×' });
  await slow.click();
  await expect(slow).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: '0.8×' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('koreading_tts_rate'))).toBe('0.8');

  const shadow = page.getByRole('button', { name: 'Shadow paragraph' }).first();
  await shadow.click();
  await expect(page.getByText(/🗣️ 버튼을 다시 누르면 원문을 볼 수 있습니다/).first()).toBeVisible();
  const reveal = page.getByRole('button', { name: 'Show original paragraph' }).first();
  await expect(reveal).toHaveAttribute('aria-pressed', 'true');
  await reveal.click();
  await expect(page.getByRole('button', { name: '눈이', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shadow paragraph' }).first()).toHaveAttribute('aria-pressed', 'false');
});
test('legacy guest reading remains usable when optional R1-R5 learning fields are absent', async ({ page }) => {
  await page.addInitScript(value => {
    sessionStorage.setItem('koreading_guest_article', JSON.stringify(value));
  }, { ...article, discussionPrompt: undefined, continuationChoices: undefined, writingPrompt: undefined, comprehensionQuiz: undefined });
  await page.goto('/read/guest');
  await expect(page.getByRole('heading', { name: '눈 이야기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '읽은 내용을 확인해 보세요' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '직접 써 보세요' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask tutor about paragraph' }).first()).toBeVisible();
});
test('mobile guest learning controls stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/read/guest');
  await expect(page.getByRole('heading', { name: '읽은 내용을 확인해 보세요' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  const writingBox = await page.getByRole('textbox', { name: '한국어 쓰기 답변' }).boundingBox();
  expect(writingBox).not.toBeNull();
  expect((writingBox?.x || 0) + (writingBox?.width || 0)).toBeLessThanOrEqual(391);
});
test('public reading HTML includes actual text and a unique canonical without JavaScript', async ({ browser, request }) => {
  const list = await request.get('/api/library?sort=newest');
  expect(list.ok()).toBeTruthy();
  const first = (await list.json()).articles[0];
  expect(first).toBeTruthy();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://localhost:3013/read/${first.id}`);
  await expect(page.getByRole('heading', { name: first.title, exact: true })).toBeVisible();
  expect(await page.locator('.reading-word').count()).toBeGreaterThan(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://koreading.vercel.app/read/${first.id}`);
  await context.close();
});
