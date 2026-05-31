import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CEFRLevel, NativeLanguage } from '@/lib/gemini';
import { TOPICS } from '@/lib/gemini';

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set!');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function POST(req: NextRequest) {
  try {
    const { action, level, topic, nativeLang, word, sentence } = await req.json();

    if (action === 'generateArticle') {
      const levelConfig: Record<CEFRLevel, string> = {
        A1: 'Use only the most basic Korean words. 3-5 word sentences. Very simple present tense only. About 150-200 characters.',
        A2: 'Use basic Korean vocabulary. Simple sentences 5-10 words. Present and past tense. About 250-350 characters.',
        B1: 'Use intermediate vocabulary. Mix sentence structures. Include adjectives and adverbs. About 400-600 characters.',
        B2: 'Use upper-intermediate vocabulary. Complex sentences okay. Various tenses and grammar patterns. About 600-800 characters.',
        C1: 'Use advanced vocabulary including some idioms. Sophisticated sentence structures. About 800-1000 characters.',
        C2: 'Use native-level vocabulary. Complex academic or literary style. About 1000-1200 characters.',
      };

      const topicLabel = TOPICS.find((t: { id: string; label: string }) => t.id === topic)?.label || topic;
      const langNote = nativeLang === 'es' ? 'Spanish' : 'English';

      const prompt = `You are a Korean language teacher creating reading material.

Write a Korean reading text about "${topicLabel}" for a CEFR ${level} learner.

Requirements:
- ${levelConfig[level as CEFRLevel]}
- Apply i+1 principle: 90% known vocabulary with ~10% new words to challenge learners
- Make it engaging and culturally relevant
- Write ONLY in Korean (no romanization)

Return a JSON object ONLY (no markdown):
{
  "title": "텍스트 제목 (Korean title)",
  "content": "전체 텍스트 내용 (full Korean text with newlines for paragraphs)",
  "summary": "One sentence summary in ${langNote}",
  "topicCategory": "${topic}",
  "level": "${level}",
  "estimatedMinutes": 3,
  "keyVocabulary": ["word1", "word2", "word3", "word4", "word5"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse article');
      return NextResponse.json(JSON.parse(jsonMatch[0]));

    } else if (action === 'lookupWord') {
      const langName = nativeLang === 'es' ? 'Spanish' : 'English';

      const prompt = `You are a Korean dictionary expert.

Look up the Korean word: "${word}"
Context sentence: "${sentence}"

Return JSON ONLY (no markdown):
{
  "word": "${word}",
  "pronunciation": "romanization",
  "partOfSpeech": "품사 in Korean",
  "definition": "Korean definition",
  "translation": "Translation in ${langName}",
  "examples": [
    {"korean": "example sentence 1", "translation": "translation 1"},
    {"korean": "example sentence 2", "translation": "translation 2"},
    {"korean": "example sentence 3", "translation": "translation 3"}
  ],
  "level": "CEFR level (A1/A2/B1/B2/C1/C2)"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse word lookup');
      return NextResponse.json(JSON.parse(jsonMatch[0]));

    } else if (action === 'generateTest') {
      const prompt = `Create a Korean reading placement test with texts for 5 levels.

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

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse test');
      return NextResponse.json(JSON.parse(jsonMatch[0]));
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
