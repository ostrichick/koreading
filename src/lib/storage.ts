// Guest mode utilities using localStorage / sessionStorage

export const STORAGE_KEYS = {
  LEVEL: 'koreading_level',
  NATIVE_LANG: 'koreading_native_lang',
  GUEST_ARTICLE: 'koreading_guest_article',
  GUEST_READ_COUNT: 'koreading_guest_read_count',
};

export function getGuestLevel() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.LEVEL) as import('./gemini').CEFRLevel | null;
}

export function setGuestLevel(level: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LEVEL, level);
}

export function getGuestLang(): import('./gemini').NativeLanguage {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem(STORAGE_KEYS.NATIVE_LANG) as import('./gemini').NativeLanguage) || 'en';
}

export function setGuestLang(lang: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.NATIVE_LANG, lang);
}

export function saveGuestArticle(article: object) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEYS.GUEST_ARTICLE, JSON.stringify(article));
}

export function getGuestArticle() {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEYS.GUEST_ARTICLE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function incrementGuestReadCount() {
  if (typeof window === 'undefined') return 0;
  const count = parseInt(localStorage.getItem(STORAGE_KEYS.GUEST_READ_COUNT) || '0') + 1;
  localStorage.setItem(STORAGE_KEYS.GUEST_READ_COUNT, String(count));
  return count;
}

export function getGuestReadCount() {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEYS.GUEST_READ_COUNT) || '0');
}
