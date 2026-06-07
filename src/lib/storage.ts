// localStorage 및 sessionStorage를 사용하여 게스트 모드 데이터를 관리하는 유틸리티 파일입니다.

// 브라우저 저장소(Storage)에서 사용할 키값 상수 정의
export const STORAGE_KEYS = {
  LEVEL: 'koreading_level',                   // 게스트의 한국어 학습 레벨 (CEFR)
  NATIVE_LANG: 'koreading_native_lang',       // 게스트의 모국어 설정 (영어/스페인어/일본어/중국어)
  GUEST_ARTICLE: 'koreading_guest_article',   // 게스트가 현재 읽고 있는 AI 생성 아티클 (세션 스토리지)
  GUEST_READ_COUNT: 'koreading_guest_read_count', // 게스트가 읽은 누적 아티클 수
};

// 로컬 스토리지에서 게스트의 한국어 레벨을 조회합니다.
export function getGuestLevel() {
  if (typeof window === 'undefined') return null; // 서버 사이드 렌더링(SSR) 환경 대응
  return localStorage.getItem(STORAGE_KEYS.LEVEL) as import('./gemini').CEFRLevel | null;
}

// 로컬 스토리지에 게스트의 한국어 레벨을 저장합니다.
export function setGuestLevel(level: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LEVEL, level);
}

// 로컬 스토리지에서 게스트의 모국어 설정을 조회합니다. (기본값은 'en' - 영어)
export function getGuestLang(): import('./gemini').NativeLanguage {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem(STORAGE_KEYS.NATIVE_LANG) as import('./gemini').NativeLanguage) || 'en';
}

// 로컬 스토리지에 게스트의 모국어 설정을 저장합니다.
export function setGuestLang(lang: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.NATIVE_LANG, lang);
}

// 게스트가 생성한 아티클 객체를 세션 스토리지에 JSON 문자열로 저장합니다. (브라우저 종료 시 초기화)
export function saveGuestArticle(article: object) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEYS.GUEST_ARTICLE, JSON.stringify(article));
}

// 세션 스토리지에서 게스트가 읽던 아티클 객체를 파싱하여 조회합니다.
export function getGuestArticle() {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEYS.GUEST_ARTICLE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// 게스트의 누적 독해 횟수를 1 증가시키고 저장된 값을 반환합니다.
export function incrementGuestReadCount() {
  if (typeof window === 'undefined') return 0;
  const count = parseInt(localStorage.getItem(STORAGE_KEYS.GUEST_READ_COUNT) || '0') + 1;
  localStorage.setItem(STORAGE_KEYS.GUEST_READ_COUNT, String(count));
  return count;
}

// 게스트의 누적 독해 횟수를 조회합니다.
export function getGuestReadCount() {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEYS.GUEST_READ_COUNT) || '0');
}

