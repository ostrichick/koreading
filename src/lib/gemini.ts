/**
 * @file gemini.ts
 * @description 클라이언트 브라우저 단에서 보안이 보장된 서버 사이드 AI API 라우트(/api/ai)를 호출하기 위한 클라이언트 전용 AI 비즈니스 로직 통신 래퍼(Wrapper)입니다.
 * @why 클라이언트 단에서 직접 API Key를 소유하거나 무거운 GoogleGenerativeAI SDK를 가져오는 행위를 방지하여, 보안 유출 리스크를 완전히 차단하고 네트워크 전송량을 최적화하기 위해 존재합니다.
 */

// CEFR(유럽공통참조기준) 기준 한국어 학습 레벨 정의
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// 사용자가 번역 결과를 받아볼 모국어(Native Language) 정의 (영어/스페인어/일본어/중국어)
export type NativeLanguage = 'en' | 'es' | 'ja' | 'zh';

// 각 한국어 레벨에 대한 설명 정보 매핑
export const LEVEL_DESCRIPTIONS: Record<CEFRLevel, string> = {
  A1: '완전 초급 (Complete Beginner)',
  A2: '초급 (Elementary)',
  B1: '중급 (Intermediate)',
  B2: '중상급 (Upper Intermediate)',
  C1: '고급 (Advanced)',
  C2: '최고급 (Mastery)',
};

// 사용자가 선택할 수 있는 8개의 아티클 주제 정의
export const TOPICS = [
  { id: 'fairy-tales', label: '한국 동화', emoji: '🧚', labelEn: 'Korean Fairy Tales' },
  { id: 'daily-life', label: '일상 이야기', emoji: '🏙️', labelEn: 'Daily Life' },
  { id: 'culture', label: '한국 문화', emoji: '🎭', labelEn: 'Korean Culture' },
  { id: 'nature-travel', label: '자연 & 여행', emoji: '🌿', labelEn: 'Nature & Travel' },
  { id: 'k-content', label: 'K-콘텐츠', emoji: '🎬', labelEn: 'K-Content' },
  { id: 'news', label: '쉬운 뉴스', emoji: '📰', labelEn: 'Easy News' },
  { id: 'food', label: '한국 음식', emoji: '🍜', labelEn: 'Korean Food' },
  { id: 'history', label: '역사 이야기', emoji: '📖', labelEn: 'History' },
];

/**
 * AI API(/api/ai)로 POST 요청을 보내는 공통 헬퍼 함수입니다.
 * 만약 사용자가 커스텀 API Key를 브라우저에 등록했다면 이를 함께 전송하여 개인 할당량을 사용합니다.
 */
export async function callAI<T = unknown>(body: object): Promise<T> {
  let customApiKey = '';
  if (typeof window !== 'undefined') {
    customApiKey = localStorage.getItem('koreading_custom_api_key') || '';
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, customApiKey }),
  });

  const text = await res.text();
  let parsed: { detail?: string; error?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`AI 서버 과부하 (HTTP ${res.status}): 일시적인 지연입니다. 잠시 후 다시 시도해 주세요.`);
    }
    throw new Error(`서버 응답 파싱 오류: ${text.substring(0, 100)}`);
  }

  if (!res.ok) throw new Error(parsed.detail || parsed.error || 'AI request failed');
  return parsed as unknown as T;
}

/**
 * 아티클 생성 시 사용자 맞춤성을 부여하기 위한 세부 옵션 인터페이스입니다.
 */
export interface GenerateArticleOptions {
  customKeyword?: string;
  genre?: string;
  recentTitles?: string[];
}

export type GeneratedArticle = {
  title: string; content: string; summary: string;
  summaries?: Partial<Record<NativeLanguage, string>>; summaryLanguage?: NativeLanguage;
  topicCategory: string; level: CEFRLevel; estimatedMinutes: number;
  keyVocabulary: string[]; hookQuote?: string; discussionPrompt?: string;
  genre?: string; imageUrls?: string[]; imagePrompts?: string[];
  generatorModel?: string; _logs?: string[]; error?: string;
};

/**
 * 지정된 레벨, 주제, 모국어 설정에 맞춰 한국어 독해 기사(아티클)를 AI를 통해 생성합니다.
 * onLog 콜백을 통해 AI 모델의 전환 과정이나 생성 중 상태 로그를 클라이언트에 실시간으로 전달합니다.
 */
export async function generateArticle(
  level: CEFRLevel,
  topic: string,
  nativeLang: NativeLanguage,
  optionsOrLog?: GenerateArticleOptions | ((message: string) => void),
  maybeOnLog?: (message: string) => void
): Promise<GeneratedArticle> {
  let options: GenerateArticleOptions = {};
  let onLog: ((message: string) => void) | undefined = undefined;

  if (typeof optionsOrLog === 'function') {
    onLog = optionsOrLog;
  } else if (optionsOrLog && typeof optionsOrLog === 'object') {
    options = optionsOrLog;
    onLog = maybeOnLog;
  }

  let customApiKey = '';
  if (typeof window !== 'undefined') {
    customApiKey = localStorage.getItem('koreading_custom_api_key') || '';
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generateArticle',
      level,
      topic,
      nativeLang,
      customApiKey,
      customKeyword: options.customKeyword,
      genre: options.genre,
      recentTitles: options.recentTitles,
    }),
  });

  const text = await res.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`AI 서버 과부하 (HTTP ${res.status}): 일시적인 지연입니다. 잠시 후 다시 시도해 주세요.`);
    }
    throw new Error(`서버 응답 파싱 오류: ${text.substring(0, 100)}`);
  }

  const logs = parsed._logs as string[] | undefined;
  if (logs && onLog) {
    for (const log of logs) {
      onLog(log);
    }
  }

  if (!res.ok) {
    const msg = String(parsed.detail || parsed.error || 'AI request failed');
    const err = new Error(msg);
    (err as unknown as { _logs: string[] })._logs = logs || [];
    throw err;
  }

  return parsed as unknown as GeneratedArticle;
}

export interface WordLookupResult {
  word: string;
  dictionaryForm: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  level: CEFRLevel;
  structure?: string;
  examples?: { korean: string; translation: string }[];
  _modelBasic?: string;
  _modelAdv?: string;
}

export interface PlacementTestResult {
  levels: {
    level: CEFRLevel;
    text: string;
    questions: { question: string; options: string[]; correct: number }[];
  }[];
}

/**
 * 단어를 클릭했을 때, 가장 기본적인 사전 정보(단어 뜻, 번역)를 빠르게 조회합니다.
 */
export async function lookupWordBasic(word: string, sentence: string, nativeLang: NativeLanguage): Promise<WordLookupResult> {
  return callAI<WordLookupResult>({ action: 'lookupWord', type: 'basic', word, sentence, nativeLang });
}

/**
 * 사용자가 단어 상세 보기(문법 분석, 품사, 어근, 예문 등)를 요청할 때 호출하는 고급 사전 분석 기능입니다.
 */
export async function lookupWordAdvanced(word: string, sentence: string, nativeLang: NativeLanguage): Promise<WordLookupResult> {
  return callAI<WordLookupResult>({ action: 'lookupWord', type: 'advanced', word, sentence, nativeLang });
}

/**
 * ⚡ 성능 최적화: basic + advanced 사전 조회를 서버에서 병렬 실행하여 단 1번의 API 호출로 반환합니다.
 * 기존 순차 2회 호출(basic → advanced) 대비 네트워크 왕복 횟수를 절반으로 줄입니다.
 */
export async function lookupWordAll(word: string, sentence: string, nativeLang: NativeLanguage): Promise<WordLookupResult> {
  return callAI<WordLookupResult>({ action: 'lookupWord', type: 'all', word, sentence, nativeLang });
}

/**
 * 신규 사용자를 위한 6단계 각 2문항 한국어 레벨 테스트(Placement Test) 문제집을 생성합니다.
 */
export async function generatePlacementTest(nativeLang: NativeLanguage = 'en'): Promise<PlacementTestResult> {
  return callAI<PlacementTestResult>({ action: 'generateTest', nativeLang });
}

