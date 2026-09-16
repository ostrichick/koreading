/**
 * @file geminiModels.ts
 * @description Google Gemini 모델의 동적 버전 감지, 우선순위 정렬 및 용도별(글 생성/사전 검색) 모델 체인을 관리합니다.
 * @why 신규 고성능 모델(Gemini 3.8/3.7/3.6/3.5)을 최우선으로 투입하고 20 RPD 제한의 구버전(Gemini 2.5)은 후순위로 강등하여
 *      쿼터 소진(429) 문제를 원천 차단하고 상시 최고 품질의 한글 서사를 생성하기 위함입니다.
 */

export interface ModelTarget {
  id: string;
  name: string;
  version: number;
  isLite: boolean;
}

// 사전에 100% 검증된 정적 고성능 기본 체인 (API 조회 실패 또는 콜드스타트 시 즉각 사용)
export const DEFAULT_ARTICLE_MODELS: ModelTarget[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', version: 3.8, isLite: false },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', version: 3.7, isLite: false },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', version: 3.6, isLite: false },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', version: 3.5, isLite: false },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (500 RPD)', version: 3.5, isLite: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (500 RPD)', version: 3.1, isLite: true },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', version: 3.0, isLite: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fallback)', version: 2.5, isLite: false },
];

export const DEFAULT_DICTIONARY_MODELS: ModelTarget[] = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', version: 3.5, isLite: true },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite Latest', version: 3.0, isLite: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', version: 3.1, isLite: true },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', version: 3.6, isLite: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', version: 2.5, isLite: false },
];

/** 모델명에서 버전 번호 추출 (예: 'gemini-3.8-flash' -> 3.8, 'gemini-2.5-flash' -> 2.5) */
export function extractModelVersion(id: string): number {
  const match = id.match(/gemini-(\d+(?:\.\d+)?)/i);
  return match ? parseFloat(match[1]) : 1.0;
}

/** 고속 텍스트 생성 전용 모델인지 여부 판별 (Flash 계열만 허용, Pro/이미지/오디오 등 제외) */
export function isValidFlashModel(id: string): boolean {
  const lower = id.toLowerCase();
  if (!lower.includes('flash')) return false;
  // Pro, 404 모델(2.5-flash-lite), 특수 목적 모델 및 비텍스트 제외
  const exclusions = ['pro', 'tts', 'image', 'transcribe', 'robotics', 'computer-use', 'omni', 'embedding', 'customtools', 'gemini-2.5-flash-lite'];
  return !exclusions.some(ex => lower.includes(ex));
}

/** 사람이 읽기 쉬운 표시 이름 포맷팅 */
export function formatModelDisplayName(id: string): string {
  return id
    .replace('models/', '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// 1시간 단위 메모리 캐시 (Edge/Serverless 인스턴스 생명주기 동안 반복 네트워크 오버헤드 0)
let cachedArticleModels: ModelTarget[] = DEFAULT_ARTICLE_MODELS;
let cachedDictionaryModels: ModelTarget[] = DEFAULT_DICTIONARY_MODELS;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

/**
 * Google AI Studio API로부터 현재 계정에서 사용 가능한 모델 목록을 동적으로 가져와
 * 버전 및 체급(Flash vs Flash Lite) 순으로 자동 정렬된 우선순위 체인을 반환합니다.
 */
export async function getPrioritizedGeminiModels(apiKey: string): Promise<{
  articleModels: ModelTarget[];
  dictionaryModels: ModelTarget[];
}> {
  const now = Date.now();
  if (apiKey && now - lastCacheTime < CACHE_TTL_MS && cachedArticleModels.length > 0) {
    return {
      articleModels: cachedArticleModels,
      dictionaryModels: cachedDictionaryModels,
    };
  }

  if (!apiKey) {
    return {
      articleModels: DEFAULT_ARTICLE_MODELS,
      dictionaryModels: DEFAULT_DICTIONARY_MODELS,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5초 초과 시 캐시/기본값 즉시 반환

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { articleModels: cachedArticleModels, dictionaryModels: cachedDictionaryModels };
    }

    const data = await res.json();
    const rawList: string[] = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => m.name.replace(/^models\//, ''))
      .filter(isValidFlashModel);

    if (rawList.length === 0) {
      return { articleModels: cachedArticleModels, dictionaryModels: cachedDictionaryModels };
    }

    // 1. 아티클 생성용 모델 체인 구축
    // - 최신 Flash 모델(3.8 > 3.7 > 3.6 > 3.5)을 1순위 최상위 그룹에 배치
    // - 500 RPD의 3.5 Flash Lite 및 3.1 Flash Lite를 중간 안전망으로 배치
    // - 20 RPD 소진 위험이 있는 2.5 Flash 등 구버전은 최후방 폴백으로 배치
    const regularFlash: ModelTarget[] = [];
    const liteFlash: ModelTarget[] = [];
    const olderFlash: ModelTarget[] = [];
    const seenIds = new Set<string>();

    for (const id of rawList) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const ver = extractModelVersion(id);
      const isLite = id.includes('lite');
      const target: ModelTarget = {
        id,
        name: formatModelDisplayName(id),
        version: ver,
        isLite,
      };

      if (ver < 3.0) {
        olderFlash.push(target);
      } else if (isLite) {
        liteFlash.push(target);
      } else {
        regularFlash.push(target);
      }
    }

    // 정렬: 일반 플래그십 Flash 내림차순 -> 500 RPD Lite 내림차순 -> 구버전 폴백
    regularFlash.sort((a, b) => b.version - a.version);
    liteFlash.sort((a, b) => b.version - a.version);
    olderFlash.sort((a, b) => b.version - a.version);

    const articleChain = [...regularFlash, ...liteFlash, ...olderFlash];

    // 2. 사전 검색용 모델 체인: 초고속 응답성(600~800ms)의 Lite 모델 최우선 배치
    const dictChain = [...liteFlash, ...regularFlash, ...olderFlash];

    if (articleChain.length > 0) {
      cachedArticleModels = articleChain;
      cachedDictionaryModels = dictChain;
      lastCacheTime = now;
    }

    return {
      articleModels: cachedArticleModels,
      dictionaryModels: cachedDictionaryModels,
    };
  } catch {
    // 네트워크 지연/오류 시 사전에 준비된 고성능 체인으로 무중단 유지
    return {
      articleModels: cachedArticleModels,
      dictionaryModels: cachedDictionaryModels,
    };
  }
}
