/**
 * @file geminiModels.ts
 * @description Google Gemini 모델의 동적 버전 감지, 우선순위 정렬 및 용도별(글 생성/사전 검색) 모델 체인을 관리합니다.
 * @why Select candidate Flash models from the model catalog for the current API key.
 *      Runtime availability, response times and provider quotas are not guaranteed.
 */

export interface ModelTarget {
  id: string;
  name: string;
  version: number;
  isLite: boolean;
}

// Google Generative Language API /v1beta/models 응답의 최소 타입 정의
interface GenericModelInfo {
  name?: string;
  supportedGenerationMethods?: string[];
}

interface ModelListResponse {
  models?: GenericModelInfo[];
}

// Fallback candidates when a per-key listing is unavailable (not confirmed live quotas).
export const DEFAULT_ARTICLE_MODELS: ModelTarget[] = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', version: 3.5, isLite: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', version: 3.1, isLite: true },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', version: 3.5, isLite: false },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', version: 3.6, isLite: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fallback)', version: 2.5, isLite: false },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', version: 3.0, isLite: false },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', version: 3.8, isLite: false },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', version: 3.7, isLite: false },
];

export const DEFAULT_DICTIONARY_MODELS: ModelTarget[] = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', version: 3.5, isLite: true },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', version: 3.1, isLite: true },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite Latest', version: 3.0, isLite: true },
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

// Model availability is credential-specific. Never reuse a personal key's catalog for another key.
const modelCache = new Map<string, { articleModels: ModelTarget[]; dictionaryModels: ModelTarget[]; updatedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
const MAX_CACHED_KEYS = 32;

/**
 * Google AI Studio API로부터 현재 계정에서 사용 가능한 모델 목록을 동적으로 가져와
 * 안정성(속도/가용성) 및 체급(Flash vs Flash Lite) 순으로 자동 정렬된 우선순위 체인을 반환합니다.
 */
export async function getPrioritizedGeminiModels(apiKey: string, signal?: AbortSignal): Promise<{
  articleModels: ModelTarget[];
  dictionaryModels: ModelTarget[];
}> {
  signal?.throwIfAborted();
  if (!apiKey) {
    return {
      articleModels: DEFAULT_ARTICLE_MODELS,
      dictionaryModels: DEFAULT_DICTIONARY_MODELS,
    };
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  const cacheKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) return cached;
  const fallback = cached || { articleModels: DEFAULT_ARTICLE_MODELS, dictionaryModels: DEFAULT_DICTIONARY_MODELS };

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(3000)]) : AbortSignal.timeout(3000),
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    signal?.throwIfAborted();

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json() as ModelListResponse;
    signal?.throwIfAborted();
    const rawModels = data.models || [];
    const rawList: string[] = rawModels
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name?.replace(/^models\//, '') ?? '')
      .filter(isValidFlashModel);

    if (rawList.length === 0) {
      return fallback;
    }

    // Article candidates: preference order only; provider latency/quota can change.
    const stableFast: ModelTarget[] = [];
    const highQuotaLite: ModelTarget[] = [];
    const previewFlagship: ModelTarget[] = [];
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
      } else if (id === 'gemini-3.6-flash' || id === 'gemini-3.5-flash') {
        stableFast.push(target);
      } else if (isLite) {
        highQuotaLite.push(target);
      } else {
        previewFlagship.push(target);
      }
    }

    // 정렬
    stableFast.sort((a, b) => b.version - a.version); // 3.6 > 3.5
    highQuotaLite.sort((a, b) => b.version - a.version); // 3.5 Lite > 3.1 Lite
    previewFlagship.sort((a, b) => b.version - a.version); // 3.8 > 3.7
    olderFlash.sort((a, b) => b.version - a.version); // 2.5

    // The API route limits how many of these candidates it attempts per request.
    const articleChain = [
      ...highQuotaLite.filter(m => m.id === 'gemini-3.5-flash-lite'),
      ...highQuotaLite.filter(m => m.id === 'gemini-3.1-flash-lite'),
      ...stableFast.filter(m => m.id === 'gemini-3.5-flash'),
      ...stableFast.filter(m => m.id === 'gemini-3.6-flash'),
      ...olderFlash,
      ...highQuotaLite.filter(m => m.id !== 'gemini-3.5-flash-lite' && m.id !== 'gemini-3.1-flash-lite'),
      ...stableFast.filter(m => m.id !== 'gemini-3.5-flash' && m.id !== 'gemini-3.6-flash'),
      ...previewFlagship
    ];

    // Dictionary candidates: Lite models first; no latency guarantee.
    const dictChain = [...highQuotaLite, ...stableFast, ...previewFlagship, ...olderFlash];

    const result = { articleModels: articleChain, dictionaryModels: dictChain, updatedAt: Date.now() };
    if (modelCache.size >= MAX_CACHED_KEYS) modelCache.delete(modelCache.keys().next().value!);
    modelCache.set(cacheKey, result);
    return result;
  } catch {
    signal?.throwIfAborted();
    // A failure for one credential must never fall back to another credential's catalog.
    return fallback;
  }
}
