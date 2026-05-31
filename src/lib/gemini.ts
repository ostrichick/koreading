// Client-side wrapper that calls the secure server-side API route

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type NativeLanguage = 'en' | 'es';

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
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'AI request failed');
  return data;
}

export async function generateArticle(level: CEFRLevel, topic: string, nativeLang: NativeLanguage) {
  return callAI({ action: 'generateArticle', level, topic, nativeLang });
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
