'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { lookupWordAll, type NativeLanguage } from '@/lib/gemini';
import { advancedWordSchema, basicWordSchema } from '@/lib/schemas';
import { wordCacheKey } from '@/lib/learning';
import type { z } from 'zod';

export type WordData = z.infer<typeof basicWordSchema> & Partial<z.infer<typeof advancedWordSchema>>;
const schema = basicWordSchema.extend(advancedWordSchema.shape);
export function useWordLookup(language: NativeLanguage) {
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const sequence = useRef(0);
  const cache = useRef(new Map<string, WordData>());
  const pending = useRef(new Map<string, Promise<WordData>>());
  const clearWord = useCallback(() => { sequence.current++; setWordData(null); setLoadingWord(false); setLookupError(''); }, []);
  useEffect(() => { clearWord(); const state = sequence; return () => { state.current++; }; }, [language, clearWord]);
  const fetchWordData = useCallback(async (word: string, sentence: string) => {
    const id = ++sequence.current;
    // The same clipped context is used for both the request and cache identity.
    const context = sentence.slice(0, 1000);
    const key = wordCacheKey(word, context, language);
    setLoadingWord(true); setWordData(null); setLookupError('');
    try {
      let data = cache.current.get(key);
      if (!data) {
        try {
          const raw = sessionStorage.getItem(key);
          const saved = raw ? schema.safeParse(JSON.parse(raw)) : null;
          if (saved?.success) data = saved.data;
        } catch { /* Storage is optional. */ }
      }
      if (!data) {
        let promise = pending.current.get(key);
        if (!promise) {
          promise = lookupWordAll(word, context, language).then(value => schema.parse(value));
          pending.current.set(key, promise);
        }
        try { data = await promise; } finally { pending.current.delete(key); }
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* Storage is optional. */ }
      }
      if (cache.current.size >= 100) cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(key, data);
      if (id === sequence.current) setWordData(data);
    } catch {
      if (id === sequence.current) setLookupError('사전 조회에 실패했습니다. 단어를 다시 선택해 주세요. / Please select the word to retry.');
    } finally { if (id === sequence.current) setLoadingWord(false); }
  }, [language]);
  return { wordData, loadingWord, loadingAdvanced: false, lookupError, fetchWordData, clearWord };
}
