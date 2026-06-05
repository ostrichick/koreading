/**
 * @file gemini.ts
 * @description 클라이언트 브라우저 단에서 보안이 보장된 서버 사이드 AI API 라우트(/api/ai)를 호출하기 위한 클라이언트 전용 AI 비즈니스 로직 통신 래퍼(Wrapper)입니다.
 * @why 클라이언트 단에서 직접 API Key를 소유하거나 무거운 GoogleGenerativeAI SDK를 가져오는 행위를 방지하여, 보안 유출 리스크를 완전히 차단하고 네트워크 전송량을 최적화하기 위해 존재합니다.
 */

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type NativeLanguage = 'en' | 'es' | 'ja' | 'zh';

export const LEVEL_DESCRIPTIONS: Record<CEFRLevel, string> = {
  A1: '완전 초급 (Complete Beginner)',
  A2: '초급 (Elementary)',
  B1: '중급 (Intermediate)',
  B2: '중상급 (Upper Intermediate)',
  C1: '고급 (Advanced)',
  C2: '최고급 (Mastery)',
};

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

async function callAI(body: object) {
  let customApiKey = '';
  if (typeof window !== 'undefined') {
    customApiKey = localStorage.getItem('koreading_custom_api_key') || '';
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, customApiKey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'AI request failed');
  return data;
}

export async function generateArticle(
  level: CEFRLevel,
  topic: string,
  nativeLang: NativeLanguage,
  onLog?: (message: string) => void
) {
  let customApiKey = '';
  if (typeof window !== 'undefined') {
    customApiKey = localStorage.getItem('koreading_custom_api_key') || '';
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generateArticle', level, topic, nativeLang, customApiKey }),
  });

  const data = await res.json();

  // 서버에서 수집된 로그를 콜백으로 전달
  if (data._logs && onLog) {
    for (const log of data._logs) {
      onLog(log);
    }
  }

  if (!res.ok) {
    const err = new Error(data.detail || data.error || 'AI request failed');
    (err as any)._logs = data._logs || [];
    throw err;
  }

  return data;
}

export async function lookupWordBasic(word: string, sentence: string, nativeLang: NativeLanguage) {
  return callAI({ action: 'lookupWord', type: 'basic', word, sentence, nativeLang });
}

export async function lookupWordAdvanced(word: string, sentence: string, nativeLang: NativeLanguage) {
  return callAI({ action: 'lookupWord', type: 'advanced', word, sentence, nativeLang });
}

export async function generatePlacementTest() {
  return callAI({ action: 'generateTest' });
}
