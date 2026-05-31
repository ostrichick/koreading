/**
 * @file route.ts (api/ai)
 * @description Next.js Edge-ready 서버 사이드 AI API 라우트입니다. 1순위로 Groq Llama 3.1 70B 엔진을 호출하며, 2순위 비상망으로 Gemini 2.5/1.5 Flash 폴백망을 가동하여 텍스트 생성, 레벨 테스트 출제, 정밀 문법 형태소 분석 및 예문 사전 검색을 대행 처리합니다.
 * @why AI 서비스들의 API 키 유출을 방지하고 백엔드 서버 단에서 쿼터 초과(429) 시 지능적으로 우회 및 교차 이중화 네트워크를 완성하기 위해 안전한 단일 엔드포인트 게이트웨이로 설계되었습니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CEFRLevel, NativeLanguage } from '@/lib/gemini';
import { TOPICS } from '@/lib/gemini';

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set!');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, level, topic, nativeLang, word, sentence, customApiKey } = body;

    // Use user-provided API key if available, otherwise fallback to the server environment key
    const activeApiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || '';
    if (!activeApiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key가 누락되었습니다. 도서관 설정에서 개인 API Key를 등록해 주세요.' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model25 = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const model15 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    /**
     * Helper to call AI with primary Groq Llama 3.1 70B and dynamic fallback to Gemini
     */
    const generateWithFallback = async (prompt: string, responseMimeType?: string) => {
      // 1. If GROQ_API_KEY is configured in the environment, use Groq Llama 3.3 70B as the primary engine!
      if (process.env.GROQ_API_KEY) {
        try {
          console.log('⚡ Calling primary Groq API: llama-3.3-70b-versatile');
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
            })
          });
          if (res.ok) {
            const data = await res.json();
            return data.choices[0].message.content;
          }
          const errText = await res.text();
          console.warn(`[Groq API warning status ${res.status}]: ${errText}`);
        } catch (groqErr) {
          console.warn('⚠️ Groq connection failed, falling back to Gemini...', groqErr);
        }
      }

      // 2. Fallback to Gemini 2.5-flash/1.5-flash (primary, daily quota: 20 on free tier)
      const config = responseMimeType ? { responseMimeType } : undefined;
      try {
        const result = await model25.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: config
        });
        return result.response.text();
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn(`[Gemini 2.5-flash error, trying fallback to 1.5-flash]: ${msg}`);
        
        // Try 2: Gemini 1.5-flash (fallback, daily quota: 1500)
        try {
          const result = await model15.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: config
          });
          return result.response.text();
        } catch (fallbackErr: any) {
          const fallbackMsg = fallbackErr?.message || String(fallbackErr);
          console.error(`❌ Gemini 1.5-flash fallback also failed: ${fallbackMsg}`);
          throw err;
        }
      }
    };

    if (action === 'generateArticle') {
      const levelConfig: Record<CEFRLevel, string> = {
        A1: 'Use only the most basic Korean words. Simple sentence structure (4-6 words per sentence). Simple present tense. The text must be detailed and comprehensive enough for beginner practice, having about 400-500 characters in Korean. Ensure it is written as a solid, cohesive paragraph of 4-6 sentences, not single-sentence lines.',
        A2: 'Use basic Korean vocabulary. Simple sentences of 6-10 words. Present, past, and basic future tenses. The text must be detailed and substantial, having about 600-800 characters in Korean, structured into 2-3 coherent paragraphs.',
        B1: 'Use intermediate vocabulary. Mix sentence structures. Include adjectives and adverbs. Detailed and substantial story or explanation, having about 900-1100 characters in Korean, structured into 3-4 coherent paragraphs.',
        B2: 'Use upper-intermediate vocabulary. Complex sentences. Various tenses and advanced grammar patterns. Highly detailed and informative, having about 1200-1400 characters in Korean, structured into 3-4 coherent paragraphs.',
        C1: 'Use advanced vocabulary including some idioms. Sophisticated and rich sentence structures. Very thorough and deeply informative, having about 1500-1700 characters in Korean, structured into 4-5 coherent paragraphs.',
        C2: 'Use native-level vocabulary. Complex academic, professional or literary style. Deeply exhaustive, rich, and sophisticated, having about 1800-2000 characters in Korean, structured into 4-5 coherent paragraphs.',
      };

      const topicLabel = TOPICS.find((t: { id: string; label: string }) => t.id === topic)?.label || topic;
      const langNote = nativeLang === 'es' ? 'Spanish' : 'English';

      const prompt = `You are a professional Korean language teacher creating reading material.

Write an engaging and culturally relevant Korean reading text about "${topicLabel}" for a CEFR ${level} learner.

CRITICAL HARD CONSTRAINTS (CRITICAL FOR LLAMA ACCURACY):
1. Write the "content" field ONLY in PURE KOREAN characters (한글). 
2. Absolutely DO NOT include any foreign letters, English, Spanish, Russian, Japanese, Chinese characters (한자), or any other alphabets in the "content" or "title" fields. Every single word in the body text must be pure Korean.
3. i+1 Principle Restriction: When challenging the learner (10% new vocabulary), use SLIGHTLY ADVANCED KOREAN WORDS (어려운 한국어 단어), NEVER foreign words or other languages. The entire text must read as natural, correct, 100% pure Korean.
4. Sentences structure constraint:
- ${levelConfig[level as CEFRLevel]}
5. Paragraph Structure Constraint: Write the text in proper paragraphs. Each paragraph MUST contain multiple naturally connected sentences (at least 3-4 sentences per paragraph, except possibly for very short A1/A2 texts which should still be structured as a solid paragraph of 4-6 sentences, not single-sentence lines separated by newlines). Absolutely do NOT write the text as single-sentence lines or put a newline after every single sentence.

Return a JSON object ONLY (no markdown):
{
  "title": "텍스트 제목 (Must be 100% pure Korean)",
  "content": "전체 텍스트 내용 (Must be 100% natural and pure Korean, structured into coherent paragraphs with multiple sentences each)",
  "summary": "One sentence summary in ${langNote}",
  "topicCategory": "${topic}",
  "level": "${level}",
  "estimatedMinutes": 2, // Estimate the reading time in minutes dynamically as an integer (e.g. 1, 2, 3, 4) based on the text level and length
  "keyVocabulary": ["word1", "word2", "word3", "word4", "word5"]
}`;

      const text = await generateWithFallback(prompt, 'application/json');
      return NextResponse.json(JSON.parse(text));

    } else if (action === 'lookupWord') {
      const { type } = body;
      const langName = nativeLang === 'es' ? 'Spanish' : 'English';

      if (type === 'basic') {
        const prompt = `You are a Korean dictionary expert.

Look up the Korean word: "${word}"
Context sentence: "${sentence}"

CRITICAL HARD CONSTRAINTS:
1. The "definition" field MUST be written in 100% PURE KOREAN characters (한글). Absolutely do NOT use Japanese (日本語), English, Chinese characters (漢字), or any other foreign languages in the "definition" field.
2. The "partOfSpeech" field must be written in Korean (e.g. 명사, 동사, 형용사, 부사, 조사, 어미).
3. The "translation" field must be in ${langName}.

Return JSON ONLY (no markdown):
{
  "word": "${word}",
  "pronunciation": "romanization",
  "partOfSpeech": "품사 in Korean",
  "definition": "Korean definition (Must be 100% pure Korean)",
  "translation": "Translation in ${langName}",
  "level": "CEFR level (A1/A2/B1/B2/C1/C2)"
}`;

        const text = await generateWithFallback(prompt, 'application/json');
        return NextResponse.json(JSON.parse(text));
      } else {
        const prompt = `You are a Korean grammar and linguistics expert.

Analyze the word: "${word}"
In the context sentence: "${sentence}"

CRITICAL HARD CONSTRAINTS:
1. The "structure" field MUST be written in 100% PURE KOREAN characters (한글). Absolutely do NOT use Japanese (日本語), English, Chinese characters (漢字), or any other foreign languages in the "structure" field.
2. The "korean" field in the "examples" array must be in 100% PURE KOREAN.
3. The "translation" field in the "examples" array must be in ${langName}.

Return JSON ONLY (no markdown):
{
  "structure": "How the word is formed/conjugated in Korean (e.g., for '다녀왔습니다', write '동사 다니다 + 오다 + -었습니다 / -습니다' showing grammatical particles, endings, auxiliary verbs, or compounds. Keep it concise, educational and clear in Korean, written strictly in pure Korean)",
  "examples": [
    {"korean": "example sentence 1 using the word in correct context", "translation": "translation in ${langName}"},
    {"korean": "example sentence 2", "translation": "translation 2"},
    {"korean": "example sentence 3", "translation": "translation 3"}
  ]
}`;

        const text = await generateWithFallback(prompt, 'application/json');
        return NextResponse.json(JSON.parse(text));
      }

    } else if (action === 'generateTest') {
      const prompt = `Create a Korean reading placement test with texts for 5 levels.

CRITICAL HARD CONSTRAINTS:
1. The "text" field MUST be in 100% PURE KOREAN. Absolutely no Japanese or other foreign characters.
2. Questions and options must be in English.

Return JSON ONLY (no markdown, no code blocks):
{
  "levels": [
    {
      "level": "A1",
      "text": "Short Korean text (50-100 chars)",
      "questions": [
        {"question": "Question in English", "options": ["A","B","C","D"], "correct": 0},
        {"question": "Second question", "options": ["A","B","C","D"], "correct": 1}
      ]
    }
  ]
}

Include levels: A1, A2, B1, B2, C1. Korean texts only in the text field.`;

      const text = await generateWithFallback(prompt, 'application/json');
      return NextResponse.json(JSON.parse(text));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error('Gemini API error:', message);
    return NextResponse.json(
      { error: 'AI request failed', detail: message, hasKey: !!process.env.GEMINI_API_KEY },
      { status: 500 }
    );
  }
}
