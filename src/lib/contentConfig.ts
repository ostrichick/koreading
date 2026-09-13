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

