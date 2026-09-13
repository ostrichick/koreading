/**
 * @file route.ts (api/ai)
 * @description Next.js Edge-ready 서버 사이드 AI API 라우트입니다.
 * 1순위로 Groq (Gemma 2, Llama 3 등) 엔진을 호출하며, 2순위 비상망으로 Gemini 2.5/2.0/1.5 Flash 폴백망을 가동합니다.
 * 텍스트 생성, 레벨 테스트 출제, 정밀 문법 형태소 분석 및 예문 사전 검색을 처리합니다.
 * @why AI 서비스들의 API 키 유출을 방지하고 백엔드 서버 단에서 쿼터 초과(429) 시 지능적으로 우회 및 교차 이중화 네트워크를 완성하기 위해 안전한 단일 엔드포인트 게이트웨이로 설계되었습니다.
 * @perf Edge Runtime으로 배포되어 Vercel의 엣지 네트워크에서 콜드 스타트 없이 즉시 실행됩니다.
 */

// Edge Runtime: Vercel 엣지 네트워크에서 직접 실행 → 콜드 스타트 제거, 응답 지연 최소화
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CEFRLevel, NativeLanguage } from '@/lib/gemini';
import { TOPICS } from '@/lib/gemini';
import { getRandomSubTopic, getGenreInstruction } from '@/lib/topicSeeds';
import { getPedagogicalInstruction, getVisualAidDirectingInstruction } from '@/lib/koreanCurriculum';

// 서버 환경변수에 GEMINI_API_KEY가 설정되어 있지 않으면 에러 로그를 남깁니다.
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set!');
}

// IP 기반 간단 Rate Limiting (Edge 인메모리 맵: IP당 1분 내 20회 제한)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60 * 1000 });
    return false;
  }
  if (entry.count >= MAX_REQUESTS_PER_MINUTE) {
    return true;
  }
  entry.count++;
  return false;
}

/**
 * 클라이언트로부터 요청을 받아 AI 처리를 수행하는 메인 POST 핸들러 함수입니다.
 * 
 * @param req NextRequest 객체 (요청 바디에 action, level, topic, nativeLang, word, sentence, customApiKey 등이 포함되어 있음)
 * @returns 응답 JSON 객체
 */
export async function POST(req: NextRequest) {
  try {
    // ── 보안 체크 0: Rate Limiting ──
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: '요청 한도를 초과했습니다. 1분 후 다시 시도해 주세요. (Too Many Requests)' },
        { status: 429 }
      );
    }

    // ── 보안 체크 1: Content-Type 검증 ──
    // application/json 외의 요청은 거부하여 CSRF 및 폼 기반 공격을 차단합니다.
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid Content-Type' }, { status: 415 });
    }

    // 요청 바디에서 필요한 매개변수를 추출합니다.
    const body = await req.json();
    const { action, level, topic, nativeLang, word, sentence, customApiKey, paragraph, userMessage, chatHistory, customKeyword, genre, recentTitles } = body;

    // ── 보안 체크 2: action 허용 목록 검증 ──
    // 알 수 없는 action으로 서버 리소스를 소모하는 것을 방지합니다.
    const ALLOWED_ACTIONS = ['generateArticle', 'lookupWord', 'generateTest', 'tutorChat'] as const;
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // ── 보안 체크 3: 입력값 길이 제한 (프롬프트 인젝션 방지) ──
    if (word && word.length > 50) {
      return NextResponse.json({ error: 'word too long' }, { status: 400 });
    }
    if (sentence && sentence.length > 500) {
      return NextResponse.json({ error: 'sentence too long' }, { status: 400 });
    }
    if (userMessage && userMessage.length > 1000) {
      return NextResponse.json({ error: 'message too long' }, { status: 400 });
    }
    if (paragraph && paragraph.length > 5000) {
      return NextResponse.json({ error: 'paragraph too long' }, { status: 400 });
    }
    if (chatHistory && chatHistory.length > 20) {
      return NextResponse.json({ error: 'chat history too long' }, { status: 400 });
    }

    // 사용자가 직접 입력한 개인 API Key가 있다면 이를 최우선으로 사용하고, 없으면 서버 환경변수 키를 사용합니다.
    const activeApiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || '';
    if (!activeApiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key가 누락되었습니다. 도서관 설정에서 개인 API Key를 등록해 주세요.' },
        { status: 400 }
      );
    }


    // AI가 한글 전용 필드에 다른 외국어 문자나 한자를 절대 섞지 않도록 강제하는 공통 시스템 지침입니다.
    const systemInstruction = 'You are an expert Korean linguist and native language teacher. You must strictly follow all instructions. In any field designed for Korean (such as "content", "title", "definition", "structure", "korean" in examples), you MUST write strictly and 100% in pure Korean characters (한글) only. Absolutely NEVER include any foreign characters, Chinese characters (한자/漢字), Japanese (日本語/かな/カナ), English, Hindi, Vietnamese, or any other languages, symbols, or alphabets. Every single word in the Korean fields must be natural, correct, 100% pure Korean as written by a native speaker. Strictly follow this rule without exception.';
    
    // API 키를 주입하여 GoogleGenerativeAI 인스턴스를 초기화합니다.
    const genAI = new GoogleGenerativeAI(activeApiKey);
    
    // 2026년 현재 100% 가동 검증된 최신 고속 Gemini 모델 인스턴스들을 생성합니다.
    const model25 = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
    const model35 = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', systemInstruction });
    const model35lite = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite', systemInstruction });
    const modelFlashLiteLatest = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest', systemInstruction });

    // 폴백 대기용 헬퍼 함수
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    /** 
     * 에러 메시지를 확인하여 503(서버 과부하) 또는 429(요청 한도 초과) 등 재시도가 필요한 에러인지 판별합니다.
     */
    const isRetryableError = (msg: string) =>
      msg.includes('503') || msg.includes('429') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('Quota') || msg.includes('quota');

    /**
     * Groq 최신 모델을 우선 시도하고, 실패 시 초고속 Gemini 최신 모델군으로 전환(폴백)하는 헬퍼 함수입니다.
     * 주로 사전 검색(lookupWord) 및 레벨 테스트 생성(generateTest)에 사용됩니다.
     * 
     * @param prompt AI에 보낼 프롬프트 텍스트
     * @param responseMimeType 반환 데이터 타입 (예: 'application/json')
     */
    const generateWithFallback = async (prompt: string, responseMimeType?: string): Promise<{ text: string; modelUsed: string }> => {
      // 1. Groq 시도 (최대 3초 타임아웃으로 지연 방지)
      if (process.env.GROQ_API_KEY) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'qwen/qwen3.8-27b',
              temperature: 0.1,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: prompt }
              ],
              response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
            })
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            return { text: data.choices[0].message.content, modelUsed: 'Groq Qwen 3.8 27B' };
          }
        } catch (groqErr) {
          // Groq 실패 시 즉시 Gemini로 진입
        }
      }

      // 2. 초고속 검증된 Gemini 모델 체인 (단어 사전: 800ms대 Lite 모델 우선 가동)
      const config = {
        temperature: 0.1,
        responseMimeType: responseMimeType === 'application/json' ? 'application/json' : undefined
      };
      
      const geminiModels = [
        { model: model35lite, name: 'Gemini 3.5 Flash Lite' },
        { model: modelFlashLiteLatest, name: 'Gemini Flash Lite Latest' },
        { model: model25, name: 'Gemini 2.5 Flash' },
        { model: model35, name: 'Gemini 3.5 Flash' },
      ];
      
      for (const { model: m, name } of geminiModels) {
        try {
          const result = await m.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: config
          });
          return { text: result.response.text(), modelUsed: name };
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.warn(`[${name} error]: ${msg}`);
          if (isRetryableError(msg)) {
            await sleep(300);
            continue;
          }
          continue;
        }
      }
      throw new Error('모든 AI 모델이 현재 사용 불가능합니다.');
    };

    // ═══════════════════════════════════════════════════
    // 📰 1. 맞춤형 한국어 읽기 아티클 생성 (generateArticle)
    //      Groq 3종 + Gemini 5종 = 최대 8중 폴백 및 실시간 로깅 지원
    //      (1단계: Temperature 0.8 + 100종 동적 소재 풀 + 상투어 금지)
    //      (2단계: 장르/시점 다변화 + 기존 글 중복 방지)
    // ═══════════════════════════════════════════════════
    if (action === 'generateArticle') {
      // CEFR 레벨별 가이드라인 매핑
      const levelConfig: Record<CEFRLevel, string> = {
        A1: '가장 기초적인 한국어 어휘만 사용하십시오. 단순한 문장 구조 (문장당 4~6개 단어). 쉬운 현재 시제 위주. 텍스트 전체 길이는 약 400~500자 크기로 서술하십시오. 한 문장마다 끊어 쓰지 말고, 4~6개의 문장이 뭉친 하나의 탄탄한 문단으로 구성하십시오.',
        A2: '기초 한국어 어휘를 사용하십시오. 문장당 6~10개 단어로 구성된 명료한 문장. 현재, 과거 및 기초 미래 시제 사용. 전체 길이는 약 600~800자 크기로 상세히 서술하고, 2~3개의 정돈된 문단으로 구성하십시오.',
        B1: '중급 한국어 어휘를 사용하십시오. 다양한 연결어미와 문장 구조를 혼합하고 형용사와 부사를 다채롭게 사용하십시오. 전체 길이는 약 900~1100자 크기로 읽을거리가 많게 서술하고, 3~4개의 명확한 문단으로 구성하십시오.',
        B2: '중상급 한국어 어휘를 사용하십시오. 복잡한 문장 구조와 다양한 문법 패턴을 자유롭게 사용하십시오. 전체 길이는 약 1200~1400자 크기로 상세하고 깊이 있는 내용을 담아 3~4개의 문단으로 구성하십시오.',
        C1: '고급 한국어 어휘 및 일부 관용구, 숙어를 세련되게 활용하십시오. 복잡하고 품격 있는 문장 구조를 보여주십시오. 전체 길이는 약 1500~1700자 크기로 깊이 있고 포괄적인 전개를 보이며 4~5개의 문단으로 구성하십시오.',
        C2: '원어민 수준의 고급 학술, 문학, 언론 문체를 자유롭게 활용하십시오. 지극히 정교하고 심도 있는 문장을 구사하십시오. 전체 길이는 약 1800~2000자 크기로 매끄럽고 가치가 풍부하게 서술하고 4~5개의 문단으로 구성하십시오.',
      };

      const topicLabel = TOPICS.find((t: { id: string; label: string }) => t.id === topic)?.label || topic;
      const langMap: Record<string, string> = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
      const langNote = langMap[nativeLang] || 'English';

      // 1) 동적 세부 소재(Sub-topic Seed) 결정 (커스텀 입력 최우선, 없을 시 100종 풀에서 무작위 추출)
      let subtopicInstruction = '';
      if (customKeyword && typeof customKeyword === 'string' && customKeyword.trim()) {
        const cleanKeyword = customKeyword.trim().substring(0, 100);
        subtopicInstruction = `\n[학습자 지정 핵심 키워드/소재 (최우선 반영)]: 이번 글은 학습자가 요청한 "${cleanKeyword}"에 대해 깊이 있고 흥미롭게 다루어야 합니다. 이 소재를 글의 중심에 놓고 전개하십시오.`;
      } else {
        const randomSeed = getRandomSubTopic(topic);
        subtopicInstruction = `\n[이번 글의 구체적 추천 소재]: "${randomSeed}"\n- 일반적이거나 뻔한 총론 대신, 위 구체적인 소재와 생생한 상황을 바탕으로 독창적이고 흥미진진한 이야기를 전개하십시오.`;
      }

      // 2) 글의 장르 및 서술 스타일 가이드
      const genreInstruction = `\n[글의 장르 및 서술 스타일 지침]:\n${getGenreInstruction(genre)}`;

      // 3) 도서관 최근 글 중복 방지 지침 (Negative Prompting)
      let duplicateAvoidanceInstruction = '';
      if (recentTitles && Array.isArray(recentTitles) && recentTitles.length > 0) {
        const titleList = recentTitles
          .filter((t: any) => typeof t === 'string' && t.trim())
          .slice(0, 10)
          .map((t: string) => `- "${t.trim()}"`)
          .join('\n');
        if (titleList) {
          duplicateAvoidanceInstruction = `\n[기존 글 중복 절대 금지]: 도서관에 이미 다음 제목들의 글이 존재합니다. 아래 글들과 제목, 중심 소재, 사건 전개가 겹치지 않는 완전히 새로운 각도와 참신한 소재로 작성하십시오:\n${titleList}`;
        }
      }

      const pedagogicalGuide = getPedagogicalInstruction(level as CEFRLevel, topicLabel);
      const visualAidGuide = getVisualAidDirectingInstruction();

      // 프롬프트를 정교하게 구성합니다. (소설가 페르소나 탈피 -> KFL 한국어 교육학 전문 집필관)
      const prompt = `당신은 국립국어원 한국어 표준 교육과정 및 국제 한국어 교육학(KFL) 최고 권위자이자 한국어 독해 교재 전문 집필관입니다.
CEFR ${level} 레벨의 외국인 학습자가 실질적인 한국어 습득 효과(Comprehensible Input)를 온전히 누릴 수 있도록 "${topicLabel}" 주제의 체계적이고 유익한 교육용 독해 지문을 작성해 주세요.
${subtopicInstruction}
${genreInstruction}
${duplicateAvoidanceInstruction}
${pedagogicalGuide}
${visualAidGuide}

[절대 준수해야 하는 강한 제약 조건 (CRITICAL)]:
1. 100% 순수 한글 원칙: "title"과 "content" 필드는 반드시 100% 순수한 한글(한국어 문자)로만 작성해야 합니다.
2. 절대 본문("content")이나 제목("title")에 영어, 한자(漢字/简繁体字), 일본어, 외국어 번역 괄호 표기(예: '공부(study)하다', '건강(健康)')를 단 한 글자도 넣지 마십시오. 모든 단어는 100% 순수한 한글 단어로만 문장 속에 자연스럽게 녹여내야 합니다. 번역 설명용 외래 문자는 절대 금지입니다.
3. 한국어 교육학적 완성도:
   - 본문에 이번 레벨(${level})의 필수 목표 문법이 2~3개 이상 자연스럽게 사용되어야 합니다.
   - 5개의 핵심 어휘(keyVocabulary)는 본문 속에서 각각 최소 2회 이상 자연스럽게 반복(Recycled)되어야 합니다.
   - 어휘 난이도와 문장 길이는 반드시 CEFR ${level} 기준을 철저히 지키십시오. 뜬구름 잡는 추상적 소설이나 난해한 문학적 묘사를 금지합니다.

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호 없이 JSON만 반환):
{
  "title": "텍스트 제목 (100% 순수 한글, 학습자의 흥미를 끄는 명료한 제목)",
  "content": "전체 텍스트 내용 (선정된 목표 문법과 핵심 어휘가 2회 이상 반복되며 유기적으로 연결된 100% 순수 한글)",
  "summary": "${langNote}로 작성된 한 문장의 본문 요약",
  "topicCategory": "${topic}",
  "level": "${level}",
  "estimatedMinutes": 2, // 텍스트 난이도와 길이에 따라 예상 소요 시간(분)을 정수(예: 1, 2, 3, 4)로 동적 예측
  "keyVocabulary": ["핵심단어1", "핵심단어2", "핵심단어3", "핵심단어4", "핵심단어5"],
  "imagePrompts": [
    "A clear, educational textbook illustration showing the main scene of this story: [describe the specific situational scene and characters doing the action in Korea], clear composition, bright pleasant lighting, modern Korean language textbook graphic style, absolutely NO text or letters",
    "A close-up educational visual dictionary illustration focusing clearly on [describe the specific object or core hand action of 1-2 key vocabulary words], clearly demonstrating the item, uncluttered background, educational vector art style, absolutely NO text or words"
  ]
}`;

      // 교육적 일관성과 엄격한 어휘 통제를 위해 최적의 교육용 온도인 0.45로 설정합니다.
      const genConfig = { temperature: 0.45, responseMimeType: 'application/json' as const };
      
      // 사용자 브라우저 모달에 처리 경과 로그를 실시간 중계하기 위해 배열에 이력을 담아둡니다.
      const logs: string[] = [];
      let resultText: string | null = null;
      let modelUsed = '';

      // ── (1단계) Groq 다중 모델 시도 ──
      // Google API 서버와 완전 별도 인프라이므로, 구글 측 429나 503 에러 발생 시 최상의 즉시 대체 경로입니다.
      if (process.env.GROQ_API_KEY) {
        const groqModels = [
          { id: 'qwen/qwen3.8-27b', name: 'Groq Qwen 3.8 27B' },
          { id: 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
        ];
        
        for (const gm of groqModels) {
          if (resultText) break;
          logs.push(`⚡ ${gm.name} 모델에 연결 중...`);
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
              },
              body: JSON.stringify({
                model: gm.id,
                temperature: 0.45,
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
              })
            });
            clearTimeout(timeoutId);
            
            if (res.ok) {
              const data = await res.json();
              resultText = data.choices[0].message.content;
              modelUsed = gm.name;
              logs.push(`✅ ${gm.name} 모델로 생성 성공!`);
            } else {
              const errText = (await res.text()).substring(0, 100);
              logs.push(`⚠️ ${gm.name} 상태 (HTTP ${res.status}): ${errText}`);
            }
          } catch (e: any) {
            logs.push(`⚠️ ${gm.name} 전환: ${(e?.message || '').substring(0, 80)}`);
          }
        }
      }

      // ── (2단계) Gemini 5종 순차 폴백 체인 시도 ──
      // Groq가 없거나 모두 연결 실패 시 작동하며, 최신 활성 Gemini 모델들로 순차 전환합니다.
      if (!resultText) {
        const geminiChain = [
          { model: model25, name: 'Gemini 2.5 Flash' },
          { model: model35lite, name: 'Gemini 3.5 Flash Lite' },
          { model: modelFlashLiteLatest, name: 'Gemini Flash Lite Latest' },
          { model: model35, name: 'Gemini 3.5 Flash' },
        ];
        
        for (const { model: m, name } of geminiChain) {
          if (resultText) break;
          logs.push(`🔄 ${name} 모델로 생성 시도 중...`);
          try {
            const r = await m.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: genConfig
            });
            resultText = r.response.text();
            modelUsed = name;
            logs.push(`✅ ${name} 모델로 생성 성공!`);
          } catch (err: any) {
            const msg = err?.message || String(err);
            if (isRetryableError(msg)) {
              logs.push(`⏳ ${name} 서버 과부하 (503/429). 다음 모델로 전환...`);
              await sleep(500);
            } else {
              logs.push(`⚠️ ${name} 오류: ${msg.substring(0, 100)}`);
            }
          }
        }
      }

      // 최종 결과를 가공하여 응답합니다.
      if (resultText) {
        try {
          const parsed = JSON.parse(resultText);

          // 🎨 글의 주제와 문맥에 1:1로 직관 매칭되는 교재형 AI 삽화 2종 URL 자동 조합 (Pollinations.ai / FLUX.1)
          // 1. imagePrompts[0]: 대표 상황도 (본문의 장소, 인물 행동, 전체 맥락 시각화)
          // 2. imagePrompts[1]: 핵심 어휘 도해 (본문 keyVocabulary 사물 또는 핵심 동작 클로즈업)
          const prompts = Array.isArray(parsed.imagePrompts) && parsed.imagePrompts.length > 0
            ? parsed.imagePrompts
            : [];
          const seedBase = Math.floor(Math.random() * 900000) + 100000;

          const rawPrompt1 = prompts[0] && typeof prompts[0] === 'string' ? prompts[0].trim().replace(/[\r\n]+/g, ' ') : '';
          const prompt1 = rawPrompt1
            ? `${rawPrompt1}, modern Korean educational textbook illustration, bright and pleasant lighting, clean vector lines, highly detailed, no text, no words, no watermark`
            : `A modern Korean language textbook illustration showing a clear situational scene of ${topicLabel}: ${parsed.summary || ''}, bright lighting, clean educational illustration, no text, no words, no watermark`;

          const rawPrompt2 = prompts[1] && typeof prompts[1] === 'string' ? prompts[1].trim().replace(/[\r\n]+/g, ' ') : '';
          const vocabSample = Array.isArray(parsed.keyVocabulary) && parsed.keyVocabulary.length > 0
            ? parsed.keyVocabulary.slice(0, 2).join(', ')
            : topicLabel;
          const prompt2 = rawPrompt2
            ? `${rawPrompt2}, educational visual dictionary illustration, close-up focal point, vibrant colors, clean uncluttered background, no text, no words, no watermark`
            : `An educational visual dictionary close-up illustration clearly depicting ${vocabSample} in Korean daily life, sharp focus, clean background, educational graphic art, no text, no words, no watermark`;

          const imageUrls = [
            `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt1)}?width=960&height=540&seed=${seedBase}&nologo=true`,
            `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt2)}?width=960&height=540&seed=${seedBase + 17}&nologo=true`
          ];

          return NextResponse.json({
            ...parsed,
            imageUrls,
            imagePrompts: [prompt1, prompt2],
            generatorModel: modelUsed,
            _logs: logs
          });
        } catch {
          return NextResponse.json({ error: 'AI 응답 JSON 파싱 실패', _logs: logs }, { status: 500 });
        }
      } else {
        logs.push('💀 모든 AI 모델(Groq 3종 + Gemini 5종) 호출이 실패했습니다.');
        return NextResponse.json(
          { error: '현재 모든 AI 서버가 과부하 상태입니다. 1~2분 후에 다시 시도해 주세요.\n\n💡 개인 Gemini API Key를 등록하면 개인 쿼터를 사용하므로 성공률이 크게 높아집니다!', _logs: logs },
          { status: 503 }
        );
      }

    // ═══════════════════════════════════════════════════
    // 🔍 2. 독해 본문 단어 사전 검색 및 분석 (lookupWord)
    // ═══════════════════════════════════════════════════
    } else if (action === 'lookupWord') {
      const { type } = body;
      const langMap: Record<string, string> = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
      const langName = langMap[nativeLang] || 'English';

      const basicPrompt = `당신은 국립국어원 표준국어대사전 및 한국어 교육학 최고 권위자입니다.

한국어 단어: "${word}"
문맥 속 문장: "${sentence}"

[과업]:
주어진 한국어 단어 "${word}"를 문맥 속 문장 "${sentence}"에서 찾아 형태소와 문맥적 의미를 정밀 분석하고, 사전에서 검색할 수 있는 올바른 기본형(원형/lemma)을 도출하여 제공하십시오.

[⚠️ 한국어 불규칙 활용 및 다의어 정밀 구별 지침 (필수 준수)]:
한국어 용언(동사/형용사)의 불규칙 활용에 각별히 유의하십시오. 겉보기 형태가 같더라도 문맥적 의미에 따라 기본형이 완전히 다릅니다:
1. 'ㄷ' 불규칙 vs 'ㄹ' 규칙/탈락:
   - '물었어요', '물어보다', '물으니' (질문/의문 문맥) -> 반드시 기본형: '묻다' (절대 '물다'가 아님!)
   - '물었어요', '물어요' (이빨로 깨물거나 입에 무는 문맥) -> 기본형: '물다'
   - '들었어요', '들으니' (소리/음악을 청취하는 문맥) -> 반드시 기본형: '듣다' (절대 '들다'가 아님!)
   - '들었어요', '들다' (손에 물건을 쥐고 들어올리는 문맥) -> 기본형: '들다'
   - '걸었어요', '걸으니' (발로 걷는 보행 문맥) -> 반드시 기본형: '걷다' (절대 '걸다'가 아님!)
   - '걸었어요', '걸다' (벽에 매달거나 전화를 거는 문맥) -> 기본형: '걸다'
2. 'ㅂ' 불규칙:
   - '도왔어요', '도와' -> 기본형: '돕다'
   - '추워요', '더워요', '어려워요' -> 기본형: '춥다', '덥다', '어렵다'
3. 'ㅅ' 불규칙:
   - '지었어요' (집을 짓거나 미소를 짓는 문맥) -> 기본형: '짓다'
   - '나았어요' (병이 치료되거나 더 좋은 문맥) -> 기본형: '낫다'
4. '르' 불규칙:
   - '몰라요', '몰랐어요' -> 기본형: '모르다'
   - '빨라요', '빨랐어요' -> 기본형: '빠르다'
   - '불렀어요' -> 기본형: '부르다'

[절대 준수해야 하는 강한 제약 조건]:
1. 문맥 "${sentence}"에서 "${word}"의 의미(질문인지, 무는 것인지 등)를 반드시 먼저 파악한 후, 그 의미에 정확히 일치하는 사전적 기본형(원형)을 "dictionaryForm"에 작성하십시오.
2. "dictionaryForm", "definition", "translation" 간의 일관성:
   - 기본형 단어의 의미와 외국어 번역, 정의는 100% 일치해야 합니다. (예: 질문 문맥의 '물었어요' -> dictionaryForm: '묻다', translation: 'to ask', definition: '질문하다 / 궁금한 것을 말하다'. 절대 '물다(to bite)'와 혼동하거나 모순되어서는 안 됩니다.)
3. "definition" 필드는 반드시 100% 순수한 한국어 한글로만 작성해야 합니다. 절대 일본어, 영어, 한자(漢字), 또는 그 외의 외국어를 섞어서 작성하지 마십시오.
4. "partOfSpeech" field는 한국어 품사 용어(예: 명사, 동사, 형용사, 부사, 조사, 어미 등)를 사용하여 100% 한국어로만 작성하십시오.
5. "translation" 필드는 반드시 ${langName}로 작성해야 합니다.
6. "pronunciation", "partOfSpeech", "definition", "translation", "level" 등 모든 필드는 "dictionaryForm"에 해당하는 기본형 단어를 기준으로 작성하십시오.

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호나 추가 설명 없이 JSON만 반환):
{
  "word": "${word}",
  "dictionaryForm": "기본형 단어 (예: '묻다', '가다', '책' 등)",
  "pronunciation": "기본형 단어의 발음 로마자 표기",
  "partOfSpeech": "기본형 단어의 품사 (한국어로 작성)",
  "definition": "기본형 단어의 한국어 정의 (100% 순수 한글)",
  "translation": "기본형 단어의 ${langName} 번역",
  "level": "기본형 단어의 CEFR 레벨 (A1/A2/B1/B2/C1/C2 중 하나)"
}`;

      const advancedPrompt = `당신은 한국어 형태소 분석 및 언어학 전문가입니다.

분석할 한국어 단어: "${word}"
문맥 속 문장: "${sentence}"

[⚠️ 형태소 분석 시 불규칙 활용 정밀 주의]:
문맥 "${sentence}"의 의미를 기준으로 올바른 어간과 어미를 분해하십시오:
- 질문 문맥의 '물었어요': '동사 묻다 (ㄷ 불규칙) + 과거 시제 선어말 어미 -었- + 종결 어미 -어요' (절대 '물다'로 잘못 분석 금지)
- 깨무는 문맥의 '물었어요': '동사 물다 (ㄹ 규칙) + 과거 시제 선어말 어미 -었- + 종결 어미 -어요'
- 듣기 문맥의 '들었어요': '동사 듣다 (ㄷ 불규칙) + 과거 시제 선어말 어미 -었- + 종결 어미 -어요'
- 걷기 문맥의 '걸었어요': '동사 걷다 (ㄷ 불규칙) + 과거 시제 선어말 어미 -었- + 종결 어미 -어요'
- 돕기 문맥의 '도왔어요': '동사 돕다 (ㅂ 불규칙) + 과거 시제 선어말 어미 -았- + 종결 어미 -어요'

[절대 준수해야 하는 강한 제약 조건]:
1. "structure" 필드는 반드시 100% 순수한 한국어 한글로만 작성해야 합니다. 절대 일본어(예: 食べる), 영어, 한자(漢字), 또는 그 외의 외국어 문자를 섞어서 작성하지 마십시오.
2. "examples" 배열의 "korean" 필드는 반드시 100% 순수 한글로 된 올바른 예문으로만 작성되어야 합니다. (해당 기본형 단어의 의미와 일치하는 예문)
3. "examples" 배열의 "translation" 필드는 반드시 ${langName} 번역이어야 합니다.

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호나 추가 설명 없이 JSON만 반환):
{
  "structure": "문맥 의미에 부합하는 올바른 기본형 용언을 기준으로 형태소를 정밀 분석 (100% 순수 한글로만 작성)",
  "examples": [
    {"korean": "단어가 올바르게 사용된 한국어 예문 1", "translation": "${langName} 번역 1"},
    {"korean": "단어가 올바르게 사용된 한국어 예문 2", "translation": "${langName} 번역 2"},
    {"korean": "단어가 올바르게 사용된 한국어 예문 3", "translation": "${langName} 번역 3"}
  ]
}`;

      // ─── lookupWordAll: basic + advanced를 서버에서 병렬 실행 (1 RTT로 합산) ───
      // 기존 2번의 순차 API 호출을 서버에서 Promise.all로 동시 실행하여
      // 클라이언트의 왕복(RTT) 횟수를 2회 → 1회로 단축합니다.
      if (type === 'all') {
        const [basicResult, advancedResult] = await Promise.all([
          generateWithFallback(basicPrompt, 'application/json'),
          generateWithFallback(advancedPrompt, 'application/json'),
        ]);
        let basic, advanced;
        try {
          basic = JSON.parse(basicResult.text);
        } catch {
          // JSON이 코드블록으로 감싸져 있을 수 있으므로 추출 시도
          const match = basicResult.text.match(/```(?:json)?\s*([\s\S]*?)```/);
          basic = JSON.parse(match ? match[1].trim() : basicResult.text);
        }
        try {
          advanced = JSON.parse(advancedResult.text);
        } catch {
          const match = advancedResult.text.match(/```(?:json)?\s*([\s\S]*?)```/);
          advanced = JSON.parse(match ? match[1].trim() : advancedResult.text);
        }
        return NextResponse.json({ ...basic, ...advanced, _modelBasic: basicResult.modelUsed, _modelAdv: advancedResult.modelUsed });
      }

      // (하위 호환) 개별 basic / advanced 호출도 유지합니다.
      if (type === 'basic') {
        const { text } = await generateWithFallback(basicPrompt, 'application/json');
        try {
          return NextResponse.json(JSON.parse(text));
        } catch {
          const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          return NextResponse.json(JSON.parse(match ? match[1].trim() : text));
        }
      } else {
        const { text } = await generateWithFallback(advancedPrompt, 'application/json');
        try {
          return NextResponse.json(JSON.parse(text));
        } catch {
          const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          return NextResponse.json(JSON.parse(match ? match[1].trim() : text));
        }
      }

    // ═══════════════════════════════════════════════════
    // 📝 3. 독해 능력 측정용 다지선다 레벨 테스트 출제 (generateTest)
    // ═══════════════════════════════════════════════════
    } else if (action === 'generateTest') {
      const prompt = `5개 레벨의 한국어 독해 레벨 테스트 지문과 문제를 출제해 주세요.

[절대 준수해야 하는 강한 제약 조건]:
1. 각 레벨의 "text" field는 반드시 100% 순수한 한국어 한글로만 작성되어야 합니다. 절대 다른 외국어 문자나 한자가 포함되어서는 안 됩니다.
2. 질문("question")과 보기("options")는 영어로 작성해 주세요.

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호 없이 JSON만 반환):
{
  "levels": [
    {
      "level": "A1",
      "text": "짧은 한국어 지문 (50~100자 내외, 100% 순수 한글)",
      "questions": [
        {"question": "영어 질문", "options": ["보기A","보기B","보기C","보기D"], "correct": 0},
        {"question": "영어 질문 2", "options": ["보기A","보기B","보기C","보기D"], "correct": 1}
      ]
    }
  ]
}

A1, A2, B1, B2, C1 레벨을 모두 포함해 주세요.`;

      const { text } = await generateWithFallback(prompt, 'application/json');
      return NextResponse.json(JSON.parse(text));

    // ═══════════════════════════════════════════════════
    // 💬 4. 1:1 AI 튜터 문단별 코칭 대화 (tutorChat)
    // ═══════════════════════════════════════════════════
    } else if (action === 'tutorChat') {
      const langMap: Record<string, string> = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
      const langName = langMap[nativeLang] || 'English';

      let historyText = '';
      if (chatHistory && chatHistory.length > 0) {
        historyText = chatHistory.map((msg: any) => {
          const sender = msg.role === 'user' ? '학습자 (User)' : 'AI 튜터 (Tutor)';
          const text = msg.parts?.[0]?.text || msg.content || '';
          return `[${sender}]: ${text}`;
        }).join('\n\n');
      }

      const prompt = `당신은 외국인을 위한 전문 한국어 교육자이자 1:1 친밀한 AI 튜터입니다.
학습자가 독해 본문 중 다음 특정 단락에 대해 질문하고 있습니다.

[독해 대상 문단]
"""
${paragraph}
"""

[대상 학습자 정보]
- 학습자의 현재 한국어 수준: CEFR ${level}
- 학습자의 모국어: ${langName} (이 언어로 친절하게 설명해야 합니다. 단, 학습자 레벨이 C1, C2인 경우 전적으로 한국어로만 답변해 주세요.)

[이전 대화 내용]
${historyText || "(이전 대화 없음)"}

[학습자의 새로운 질문]
"${userMessage}"

[답변 가이드라인]
1. 질문에 초점을 맞추어 명쾌하고 직관적으로 답변해 주세요.
2. 초/중급 수준(A1~B2)의 학습자에게는 핵심 문법이나 단어를 설명할 때 사용자의 모국어(${langName})를 사용하여 알기 쉽게 풀어서 설명하세요.
3. 고급 수준(C1~C2)의 학습자에게는 한국어 실력 향상을 위해 100% 한국어로만 답변하십시오. 절대 영어 등 모국어를 섞지 마십시오.
4. 예시를 들 때는 실생활에서 유용하게 쓸 수 있는 자연스러운 한국어 문장 2~3개를 함께 제시해 주세요.
5. 마크다운 형식을 활용하여 가독성 있게 구조화된 답변을 작성해 주세요. (JSON 형식이 아닌 일반 텍스트 마크다운으로 답변을 생성하세요.)`;

      // tutorChat은 일반 텍스트 마크다운으로 답변하므로 responseMimeType을 지정하지 않습니다.
      const { text, modelUsed } = await generateWithFallback(prompt);
      return NextResponse.json({ text, generatorModel: modelUsed });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error('Gemini API error:', message);
    return NextResponse.json(
      { error: 'AI request failed', detail: message },
      { status: 500 }
    );
  }
}
