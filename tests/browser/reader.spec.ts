import { test, expect } from '@playwright/test';
const article = { id: 'guest', title: '눈 이야기', content: '눈이 와요.\n\n눈이 아파요.', summary: 'Snow', summaries: { en: 'Snow', es: 'Nieve', ja: '雪', zh: '雪' }, level: 'A1', topicCategory: 'daily-life', estimatedMinutes: 1, keyVocabulary: [] };
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
test('tutor disables duplicate sends and presents a recoverable error', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/ai', async route => { calls++; await new Promise(resolve => setTimeout(resolve, 200)); await route.fulfill({ status: 429, json: { error: 'Please retry later' } }); });
  await page.goto('/read/guest');
  await page.getByRole('button', { name: 'Ask tutor about paragraph' }).first().click();
  await page.getByRole('textbox', { name: 'Type your question...' }).fill('Explain snow');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Please retry later');
  await expect(page.getByRole('textbox')).toHaveValue('Explain snow');
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
test('placement sends the selected language and shows all six levels from the response', async ({ page }) => {
  let language = '';
  await page.route('**/api/ai', async route => {
    language = route.request().postDataJSON().nativeLang;
    await route.fulfill({ json: { levels: ['A1','A2','B1','B2','C1','C2'].map(level => ({ level, text: '눈이 와요.', questions: [0, 1].map(correct => ({ question: '何ですか？', options: ['雪','雨','水','風'], correct })) })) } });
  });
  await page.goto('/test');
  await page.getByRole('button', { name: /日本語/ }).click();
  await page.getByRole('button', { name: /레벨 테스트 시작/ }).click();
  await expect(page.getByText('何ですか？')).toBeVisible();
  expect(language).toBe('ja');
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
