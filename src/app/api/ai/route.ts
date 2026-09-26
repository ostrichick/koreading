import { boundedJson } from '@/lib/readJson';
import { aiQuotaIdentity, checkAiQuota } from '@/lib/aiQuota';
import { AiDeadlineError, createAiBudget, withinSignal } from '@/lib/aiBudget';
import { aiRequestSchema, generatedArticleSchema, basicWordSchema, advancedWordSchema, placementSchema, writingFeedbackSchema, parseModelJson } from '@/lib/schemas';
/**
 * @file route.ts (api/ai)
 * @description Node.js AI API: 글은 Gemini 우선/Groq 대체, 사전·테스트·튜터는 조건부 Groq 우선/Gemini 대체.
 * 텍스트 생성, 레벨 테스트 출제, 정밀 문법 형태소 분석 및 예문 사전 검색을 처리합니다.
 * @why API Key를 서버에서 보호하고 요청 횟수·공급자 시도·요청 시간을 제한하며 제한을 우회하지 않는 폴백을 제공하기 위해 단일 엔드포인트로 처리합니다.
 * @perf Vercel Serverless(Node.js) 런타임으로 배포되어 Gemini 모델 리스트 동기화 및 폴백 네트워크를 안정적으로 구동합니다.
 */

// Node.js Runtime: Gemini SDK 폴백 체인 및 예외 처리의 안정성 확보 (Edge Runtime 폐기 예정 경고 해소)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CEFRLevel, NativeLanguage } from '@/lib/gemini';
import { TOPICS } from '@/lib/gemini';
import { getRandomSubTopic, getGenreInstruction } from '@/lib/topicSeeds';
import { getPedagogicalInstruction } from '@/lib/koreanCurriculum';
import { getPrioritizedGeminiModels } from '@/lib/geminiModels';
import { getRealKoreanPhoto } from '@/lib/koreanVisuals';

export async function POST(req: NextRequest) {
  // The deadline includes request parsing, shared quota, catalog discovery and optional photos.
  const startedAt = Date.now();
  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => deadlineController.abort(), 30_000);
  const signal = AbortSignal.any([req.signal, deadlineController.signal]);
  try {
    const checked = aiRequestSchema.safeParse(await withinSignal(boundedJson(req), signal));
    if (!checked.success) return NextResponse.json({ error: 'Invalid AI request' }, { status: 400 });
    const body = checked.data;
    const action = body.action;
    // common 스키마 필드: 모든 액션에서 존재합니다.
    const { customApiKey, nativeLang } = body;
    // Vercel overwrites X-Forwarded-For; elsewhere, all requests share a fail-safe bucket.
    // A proxy ahead of Vercel can change the observable IP; this is rate limiting, not auth.
    if (!await withinSignal(checkAiQuota(aiQuotaIdentity(req.headers)), signal)) {
      return NextResponse.json({ error: 'AI usage limit reached. Please retry after the limit resets.' }, { status: 429 });
    }
    // 사용자가 직접 입력한 개인 API Key가 있다면 이를 최우선으로 사용하고, 없으면 서버 환경변수 키를 사용합니다.
    const activeApiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || '';
    if (!activeApiKey && !process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API Key가 누락되었습니다. 도서관 설정에서 개인 API Key를 등록해 주세요.' },
        { status: 400 }
      );
    }


    // AI가 한글 전용 필드에 다른 외국어 문자나 한자를 절대 섞지 않도록 강제하는 공통 시스템 지침입니다.
    const systemInstruction = 'You are an expert Korean linguist and native language teacher. You must strictly follow all instructions. In any field designed for Korean (such as "content", "title", "definition", "structure", "korean" in examples), you MUST write strictly and 100% in pure Korean characters (한글) only. Absolutely NEVER include any foreign characters, Chinese characters (한자/漢字), Japanese (日本語/かな/カナ), English, Hindi, Vietnamese, or any other languages, symbols, or alphabets. Every single word in the Korean fields must be natural, correct, 100% pure Korean as written by a native speaker. Strictly follow this rule without exception.';
    
    // API 키를 주입하여 GoogleGenerativeAI 인스턴스를 초기화합니다.
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const validateResult = (text: string, advanced = false) => {
      if (action === 'tutorChat') { if (!text.trim() || text.length > 12000) throw new Error('Invalid response'); return; }
      const value = parseModelJson(text);
      if (action === 'generateTest') placementSchema.parse(value);
      if (action === 'lookupWord') (advanced ? advancedWordSchema : basicWordSchema).parse(value);
      if (action === 'writingFeedback') writingFeedbackSchema.parse(value);
    };

    // Google AI Studio로부터 동적으로 최신 모델을 감지하고 버전/체급별로 정렬된 체인을 로드합니다.
    // Combined word lookup runs two branches; each can use Groq + two Gemini attempts.
    const budget = createAiBudget(action, signal, startedAt, action === 'lookupWord' && body.type === 'all' ? 6 : 4);
    const { articleModels, dictionaryModels } = await withinSignal(getPrioritizedGeminiModels(activeApiKey, signal), signal);
    // Response-token limits are per attempt; this is not a provider-billing ceiling.
    const maxOutputTokens = action === 'generateArticle' ? 6000 : action === 'generateTest' ? 8192 : action === 'tutorChat' ? 2048 : action === 'writingFeedback' ? 1200 : 1800;

    const getModel = (modelId: string, timeout: number) =>
      genAI.getGenerativeModel({ model: modelId, systemInstruction }, { timeout });

    /** Conditional Groq first, then bounded Gemini alternatives for dictionary, test and tutor. */
    const generateWithFallback = async (prompt: string, responseMimeType?: string, advanced = false): Promise<{ text: string; modelUsed: string }> => {
      // Both parallel dictionary branches draw from the same finite request budget.
      if (process.env.GROQ_API_KEY && !customApiKey) {
        const attempt = budget.reserve('groq', 3000);
        if (attempt) {
          let outcome: 'success' | 'failure' | 'timeout' = 'failure';
          const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(attempt.timeoutMs)]);
          try {
            const res = await withinSignal(fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              signal: attemptSignal,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
              },
              body: JSON.stringify({
                model: 'qwen/qwen3.8-27b',
                temperature: 0.1,
                max_tokens: maxOutputTokens,
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: prompt }
                ],
                response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
              })
            }), attemptSignal);
            if (res.ok) {
              const data = await withinSignal(res.json(), attemptSignal);
              validateResult(data.choices[0].message.content, advanced);
              outcome = 'success';
              return { text: data.choices[0].message.content, modelUsed: 'Groq Qwen 3.8 27B' };
            }
          } catch {
            if (attemptSignal.aborted) outcome = 'timeout';
          } finally {
            budget.record(attempt, outcome);
          }
        }
      }

      // Per-credential Gemini candidates; no latency or provider-quota guarantee.
      const config = {
        temperature: 0.1,
        responseMimeType: responseMimeType === 'application/json' ? 'application/json' : undefined
      };
      
      for (const target of dictionaryModels.slice(0, 2)) {
        const attempt = budget.reserve('gemini', 9000);
        if (!attempt) break;
        let outcome: 'success' | 'failure' | 'timeout' = 'failure';
        try {
          const m = getModel(target.id, attempt.timeoutMs);
          const result = await withinSignal(m.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { ...config, maxOutputTokens }
          }), signal);
          validateResult(result.response.text(), advanced);
          outcome = 'success';
          return { text: result.response.text(), modelUsed: target.name };
        } catch {
          if (signal.aborted) outcome = 'timeout';
        } finally {
          budget.record(attempt, outcome);
        }
      }
      throw new Error('모든 AI 모델이 현재 사용 불가능합니다.');
    };

    // ═══════════════════════════════════════════════════
    // 📰 1. 맞춤형 한국어 읽기 아티클 생성 (generateArticle)
    //      Maximum four provider attempts across Gemini and conditional Groq fallback.
    // ═══════════════════════════════════════════════════
    if (action === 'generateArticle') {
      const { level, topic, customKeyword, genre, recentTitles, seriesContext } = body;
      const topicLabel = TOPICS.find((t: { id: string; label: string }) => t.id === topic)?.label || topic;
      const langMap: Record<string, string> = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
      const langNote = langMap[nativeLang] || 'English';

      // 1) 동적 세부 소재 결정 (커스텀 입력 최우선, 없을 시 주제 풀에서 무작위 추출)
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
      if (recentTitles && recentTitles.length > 0) {
        const titleList = recentTitles
          .filter(t => typeof t === 'string' && t.trim())
          .slice(0, 10)
          .map((t: string) => `- "${t.trim()}"`)
          .join('\n');
        if (titleList) {
          duplicateAvoidanceInstruction = `\n[기존 글 중복 절대 금지]: 도서관에 이미 다음 제목들의 글이 존재합니다. 아래 글들과 제목, 중심 소재, 사건 전개가 겹치지 않는 완전히 새로운 각도와 참신한 소재로 작성하십시오:\n${titleList}`;
        }
      }

      const pedagogicalGuide = getPedagogicalInstruction(level as CEFRLevel, topicLabel);
      const seriesInstruction = seriesContext
        ? `\n[연재 이어쓰기 지침]: 이 글은 "${seriesContext.seriesTitle || seriesContext.previousTitle || '연재 이야기'}"의 ${seriesContext.episodeNumber}화입니다. 이전 화 제목은 "${seriesContext.previousTitle || ''}"입니다.\n이전 화 내용:\n"""${seriesContext.previousContent || ''}"""\n${seriesContext.previousChoice ? `학습자가 이전 화에서 선택한 방향: "${seriesContext.previousChoice}". 이 선택을 자연스럽게 반영하되 선택 문장을 그대로 반복하지 마세요.` : ''}\n등장인물·상황의 연속성을 지키면서 이번 화 자체에도 작은 사건과 다음 화가 궁금해지는 결말을 만드세요.`
        : '';

      // 프롬프트를 정교하게 구성합니다. (학습자를 사로잡는 스토리텔링 + Krashen i+1 한국어 교육학 결합)
      const prompt = `당신은 스티븐 크라센(Stephen Krashen)의 i+1 언어 습득 이론을 완벽히 구현하는 KFL(외국어로서의 한국어) 단계별 읽기 교재(Graded Reader) 전문 작가입니다.
외국인 학습자가 지루한 교과서 느낌을 받지 않으면서도, 자신의 수준에 딱 맞아(85~90% 이해) 술술 읽히는 흥미진진한 "${topicLabel}" 독해 지문을 작성해 주세요.
${subtopicInstruction}
${genreInstruction}
${duplicateAvoidanceInstruction}
${pedagogicalGuide}
${seriesInstruction}

[절대 준수해야 하는 스토리텔링 & 교육학 원칙 (CRITICAL)]:
1. 진부한 상투어 및 교과서식 도입부 원천 금지 (STRICT NEGATIVE CONSTRAINT):
   - "오늘은 날씨가 좋았다", "어제 나는 친구와 ~에 갔다", "한국에는 ~가 있다", "참 즐거운 하루였다" 같은 지루하고 뻔한 문장으로 시작하거나 끝맺지 마십시오.
   - 첫 문장은 반드시 사건의 한가운데(In medias res), 호기심을 끄는 대화, 혹은 곤란하거나 엉뚱한 돌발 상황으로 시작하십시오.
2. 3단 서사 구조 (Narrative Arc) 필수:
   - [도입]: 돌발 사건, 뜻밖의 발견, 혹은 난처한 순간으로 호기심 유발.
   - [전개]: 작은 갈등(Conflict), 문화적 차이나 소통 과정에서의 귀여운 오해/실수, 유쾌한 티키타카.
   - [결말]: 유쾌한 반전(Twist), 따뜻한 감동, 혹은 여운을 남기는 여운과 교훈.
3. 100% 순수 한글 원칙:
   - "title", "content", "hookQuote" 필드는 반드시 100% 순수한 한글(한국어 문자)로만 작성해야 합니다.
   - 절대 본문이나 제목에 영어, 한자, 일본어, 외국어 번역 괄호(예: '공부(study)하다')를 단 한 글자도 넣지 마십시오.
4. Krashen의 i+1 원리 및 어휘 난이도 엄격 통제 (CRITICAL):
   - 본문 전체 단어의 85~90%는 반드시 해당 레벨 학습자가 사전을 찾지 않고도 100% 알 수 있는 기초 어휘로 작성하십시오. (예: B1 글이라면 초급 A1~A2 단어가 85~90%를 차지해야 함)
   - 이번 글을 통해 학습자가 새로 배우는 "+1"의 낯선 어휘는 오직 아래 5개의 핵심 어휘(keyVocabulary)로만 엄격히 제한하십시오.
   - 소설이나 시에서나 쓰는 어려운 문학적 미사여구(남몰래, 매서운, 장관, 물들이다, 모닥불 등)는 절대 쓰지 말고, 누구나 아는 쉬운 일상 단어로 순화하십시오.
   - 본문에 이번 레벨(${level})의 필수 목표 문법이 2~3개 이상 자연스럽게 녹아있어야 합니다.
   - 5개의 핵심 어휘(keyVocabulary)는 본문 속에서 각각 최소 2회 이상 자연스럽게 반복(Recycled)되어야 합니다.

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호 없이 JSON만 반환):
{
  "title": "흥미진진하고 호기심을 끄는 한글 제목",
  "content": "선정된 목표 문법과 핵심 어휘가 2회 이상 반복되며 생동감 넘치는 100% 순수 한글 본문",
  "summary": "${langNote}로 작성된 한 문장의 본문 요약",
  "summaries": {"en":"English summary", "es":"Resumen español", "ja":"日本語の要約", "zh":"中文摘要"},
  "topicCategory": "${topic}",
  "level": "${level}",
  "genre": "${genre || 'random'}",
  "estimatedMinutes": 2,
  "keyVocabulary": ["핵심단어1", "핵심단어2", "핵심단어3", "핵심단어4", "핵심단어5"],
  "hookQuote": "본문에서 가장 인상 깊고 호기심을 끄는 핵심 한 줄 대사 또는 후크 문장 (100% 순수 한글)",
  "discussionPrompt": "${langNote}로 작성된, 글을 다 읽은 후 학습자에게 던지는 흥미로운 질문 또는 '당신이라면 어떻게 했을까요?' 선택지 (1~2문장)",
  "continuationChoices": ["다음 전개에 대한 짧고 구체적인 한국어 선택지 하나", "서로 다른 다음 전개에 대한 짧고 구체적인 한국어 선택지 둘"],
  "writingPrompt": "학습자가 글의 내용이나 핵심 표현을 사용해 직접 한국어를 써 보게 하는 현재 레벨에 맞는 짧은 과제",
  "comprehensionQuiz": [
    {"kind":"main","question":"글 전체의 핵심 내용을 묻는 한국어 질문","options":["선택지 하나","선택지 둘","선택지 셋","선택지 넷"],"correct":0,"explanation":"정답 근거를 짧고 쉬운 한국어로 설명","paragraphIndex":0},
    {"kind":"detail","question":"본문의 구체적인 사실을 묻는 한국어 질문","options":["선택지 하나","선택지 둘","선택지 셋","선택지 넷"],"correct":1,"explanation":"정답 근거를 짧고 쉬운 한국어로 설명","paragraphIndex":1},
    {"kind":"vocabulary","question":"핵심 어휘를 문맥 속에서 확인하는 한국어 질문","options":["선택지 하나","선택지 둘","선택지 셋","선택지 넷"],"correct":2,"explanation":"정답 근거를 짧고 쉬운 한국어로 설명","paragraphIndex":2}
  ]
}

[독해 확인 퀴즈 규칙]:
- comprehensionQuiz는 정확히 세 문항이며 main, detail, vocabulary를 각각 하나씩 포함하십시오.
- question, options, explanation은 학습자의 현재 레벨에서 이해할 수 있는 쉬운 한국어로 작성하십시오.
- 오답도 본문 내용과 연결되는 그럴듯한 선택지여야 하며 네 선택지는 서로 달라야 합니다.
- paragraphIndex는 content를 줄바꿈으로 나눈 뒤 빈 줄을 제거했을 때의 0부터 시작하는 문단 번호입니다.
- 모든 paragraphIndex는 실제 존재하는 문단을 가리켜야 하며 explanation은 그 문단에서 확인할 수 있는 근거를 설명해야 합니다.`;
      const writingGuide = level === 'A1'
        ? '\n[쓰기 과제]: 본문 핵심 단어 하나를 사용해 한 문장을 직접 만들게 하십시오.'
        : level === 'A2'
          ? '\n[쓰기 과제]: 주인공이나 핵심 사건을 한 문장으로 설명하게 하십시오.'
          : level === 'B1'
            ? '\n[쓰기 과제]: 글 속 선택에 대한 의견과 이유를 두 문장 정도로 쓰게 하십시오.'
            : '\n[쓰기 과제]: 글의 핵심을 두세 문장으로 요약하거나 자신의 관점과 근거를 쓰게 하십시오.';
      const finalPrompt = `${prompt}${writingGuide}`;

      // Krashen i+1 원리 준수와 문학적 희귀 어휘 억제를 위해 교육 최적 온도인 0.38로 설정합니다.
      const genConfig = { temperature: 0.38, responseMimeType: 'application/json' as const };
      
      // 사용자 브라우저 모달에 처리 경과 로그를 실시간 중계하기 위해 배열에 이력을 담아둡니다.
      const logs: string[] = [];
      let resultText: string | null = null;
      let modelUsed = '';

      // ── (1단계) Per-key Gemini candidate chain, not guaranteed model availability. ──
      for (const target of articleModels.slice(0, 3)) {
        if (resultText) break;
        const attempt = budget.reserve('gemini', 9000);
        if (!attempt) break;
        let outcome: 'success' | 'failure' | 'timeout' = 'failure';
        logs.push('Gemini 글 생성 시도 중...');
        try {
          const m = getModel(target.id, attempt.timeoutMs);
          const r = await withinSignal(m.generateContent({
            contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
            generationConfig: { ...genConfig, maxOutputTokens }
          }), signal);
          const parsedCandidate = parseModelJson(r.response.text());
          generatedArticleSchema.parse(parsedCandidate);
          resultText = r.response.text();
          modelUsed = target.name;
          outcome = 'success';
          logs.push('Gemini 글 생성 및 형식 검증 완료.');
        } catch {
          if (signal.aborted) outcome = 'timeout';
          logs.push('Gemini 응답 실패 또는 형식 검증 실패. 다른 후보를 확인합니다.');
        } finally {
          budget.record(attempt, outcome);
        }
      }

      // ── (2단계) Optional Groq article fallback; only the server's key is eligible. ──
      if (!resultText && process.env.GROQ_API_KEY && !customApiKey) {
        const groqModels = [
          { id: 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
        ];
        
        for (const gm of groqModels) {
          if (resultText) break;
          const attempt = budget.reserve('groq', 5000);
          if (!attempt) break;
          let outcome: 'success' | 'failure' | 'timeout' = 'failure';
          logs.push('Groq 대체 글 생성 시도 중...');
          const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(attempt.timeoutMs)]);
          try {
            const res = await withinSignal(fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              signal: attemptSignal,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
              },
              body: JSON.stringify({
                model: gm.id,
                temperature: 0.70,
                max_tokens: maxOutputTokens,
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: finalPrompt }
                ],
                response_format: { type: 'json_object' }
              })
            }), attemptSignal);
            
            if (res.ok) {
              const data = await withinSignal(res.json(), attemptSignal);
              const parsedCandidate = parseModelJson(data.choices[0].message.content);
              generatedArticleSchema.parse(parsedCandidate);
              resultText = data.choices[0].message.content;
              modelUsed = gm.name;
              outcome = 'success';
              logs.push('Groq 글 생성 및 형식 검증 완료.');
            } else {
              logs.push('Groq 응답 실패.');
            }
          } catch {
            if (attemptSignal.aborted) outcome = 'timeout';
            logs.push('Groq 응답 실패 또는 형식 검증 실패.');
          } finally {
            budget.record(attempt, outcome);
          }
        }
      }

      // 최종 결과를 가공하여 응답합니다.
      if (resultText) {
        try {
          const parsed = generatedArticleSchema.parse(parseModelJson(resultText));

          // 🎨 옵션 A: 에디토리얼 훅 카드 + 주제 맞춤 고화질 실사 사진 공존
          let imageUrls: string[] = [];
          let imagePrompts: string[] = [];
          try {
            if (budget.remainingMs() > 100) {
              // Optional photos get their own short budget, including all nested lookups.
              const photoSignal = AbortSignal.any([signal, AbortSignal.timeout(Math.min(2500, budget.remainingMs()))]);
              const visual = await withinSignal(getRealKoreanPhoto(topic, parsed.title || '', parsed.keyVocabulary || [], customKeyword, photoSignal), photoSignal);
              if (visual?.url) {
                imageUrls = [visual.url];
                imagePrompts = [visual.description];
              }
            }
          } catch {
            // 시각 자료 로드 실패 시에도 본문 텍스트는 정상 제공
          }

          if (signal.aborted) throw new AiDeadlineError();
          return NextResponse.json({
            ...parsed,
            summaryLanguage: nativeLang,
            genre: parsed.genre || genre || 'story',
            hookQuote: parsed.hookQuote || parsed.title,
            discussionPrompt: parsed.discussionPrompt || undefined,
            ...(seriesContext ? {
              seriesId: seriesContext.seriesId,
              seriesTitle: seriesContext.seriesTitle || seriesContext.previousTitle || parsed.title,
              episodeNumber: seriesContext.episodeNumber,
              ...(seriesContext.previousArticleId ? { previousEpisodeId: seriesContext.previousArticleId } : {}),
            } : {}),
            imageUrls,
            imagePrompts,
            generatorModel: modelUsed,
            _logs: logs
          });
        } catch (error: unknown) {
          if (signal.aborted || error instanceof AiDeadlineError) throw error;
          return NextResponse.json({ error: 'AI 응답 JSON 파싱 실패', _logs: logs }, { status: 500 });
        }
      } else {
        if (signal.aborted) throw new AiDeadlineError();
        logs.push('설정된 모델의 시도 횟수 또는 요청 시간 한도 내에서 유효한 응답을 받지 못했습니다.');
        return NextResponse.json(
          { error: '현재 요청 시간 또는 모델 시도 한도 내에서 유효한 AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.', _logs: logs },
          { status: 503 }
        );
      }

    // ═══════════════════════════════════════════════════
    // 🔍 2. 독해 본문 단어 사전 검색 및 분석 (lookupWord)
    // ═══════════════════════════════════════════════════
    } else if (action === 'lookupWord') {
      const { type, word, sentence } = body;
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
        const [basicOutcome, advancedOutcome] = await Promise.allSettled([
          generateWithFallback(basicPrompt, 'application/json'),
          generateWithFallback(advancedPrompt, 'application/json', true),
        ]);
        // The basic meaning is required; an advanced analysis outage must not hide it.
        if (basicOutcome.status === 'rejected') throw basicOutcome.reason;
        const basic = basicWordSchema.parse(parseModelJson(basicOutcome.value.text));
        if (advancedOutcome.status === 'rejected') {
          return NextResponse.json({ ...basic, _modelBasic: basicOutcome.value.modelUsed, _advancedUnavailable: true });
        }
        const advanced = advancedWordSchema.parse(parseModelJson(advancedOutcome.value.text));
        return NextResponse.json({ ...basic, ...advanced, _modelBasic: basicOutcome.value.modelUsed, _modelAdv: advancedOutcome.value.modelUsed });
      }

      // (하위 호환) 개별 basic / advanced 호출도 유지합니다.
      if (type === 'basic') {
        const { text } = await generateWithFallback(basicPrompt, 'application/json');
        try {
          return NextResponse.json(parseModelJson(text));
        } catch {
          const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          return NextResponse.json(parseModelJson(match ? match[1].trim() : text));
        }
      } else {
        const { text } = await generateWithFallback(advancedPrompt, 'application/json', true);
        try {
          return NextResponse.json(parseModelJson(text));
        } catch {
          const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          return NextResponse.json(parseModelJson(match ? match[1].trim() : text));
        }
      }

    // ═══════════════════════════════════════════════════
    // 📝 3. 독해 능력 측정용 다지선다 레벨 테스트 출제 (generateTest)
    // ═══════════════════════════════════════════════════
    } else if (action === 'generateTest') {
      const prompt = `6개 레벨의 한국어 독해 레벨 테스트 지문과 문제를 출제해 주세요.

[절대 준수해야 하는 강한 제약 조건]:
1. 각 레벨의 "text" field는 반드시 100% 순수한 한국어 한글로만 작성되어야 합니다. 절대 다른 외국어 문자나 한자가 포함되어서는 안 됩니다.
2. 질문("question")과 보기("options")는 ${{ en: "English", es: "Spanish", ja: "Japanese", zh: "Chinese" }[nativeLang as NativeLanguage]}로 작성해 주세요.

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

A1, A2, B1, B2, C1, C2 순서로 모두 포함하고 각각 정확히 두 문제를 작성하세요.`;

      const { text } = await generateWithFallback(prompt, 'application/json');
      return NextResponse.json(parseModelJson(text));

    // ═══════════════════════════════════════════════════
    // 💬 4. 1:1 AI 튜터 문단별 코칭 대화 (tutorChat)
    // ═══════════════════════════════════════════════════
    } else if (action === 'writingFeedback') {
      const { level, prompt: writingPrompt, response } = body;
      const langMap: Record<string, string> = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
      const langName = langMap[nativeLang] || 'English';
      const feedbackLanguage = ['C1', 'C2'].includes(level) ? 'Korean only' : langName;
      const prompt = `당신은 외국인을 위한 한국어 쓰기 코치입니다.
학습자 수준: CEFR ${level}
쓰기 과제: "${writingPrompt}"
학습자 답변: "${response}"

다음 원칙을 따르세요.
1. 완성문을 대신 써 주는 것이 목적이 아니라 학습자가 직접 다시 쓰게 돕는 것이 목적입니다.
2. 의미가 전달되는지 먼저 판단하고 잘된 점을 한 가지 구체적으로 말하세요.
3. 가장 중요한 수정점은 한 번에 최대 한 가지에 집중하세요. 수정할 필요가 없으면 correction과 naturalExpression은 생략할 수 있습니다.
4. correction과 naturalExpression은 반드시 자연스러운 순수 한국어로 작성하세요.
5. feedback과 reason은 ${feedbackLanguage}로 짧고 명확하게 작성하세요.
6. 과제와 무관한 설명이나 점수는 제공하지 마세요.

다음 JSON만 반환하세요:
{"meaningClear":true,"feedback":"잘된 점과 핵심 피드백","correction":"수정이 필요한 경우의 한국어 문장","reason":"왜 수정하는지 설명","naturalExpression":"선택적으로 더 자연스러운 짧은 한국어 표현"}`;
      const { text, modelUsed } = await generateWithFallback(prompt, 'application/json');
      const parsed = writingFeedbackSchema.parse(parseModelJson(text));
      return NextResponse.json({ ...parsed, generatorModel: modelUsed });

    } else if (action === 'tutorChat') {
      const { level, paragraph, userMessage, chatHistory, guidanceStage } = body;
      const langMap: Record<string, string> = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
      const langName = langMap[nativeLang] || 'English';
      const guidance: Record<string, string> = {
        hint: '첫 단계 힌트입니다. 정답이나 완성된 설명을 바로 말하지 말고, 학습자가 문맥·문법 관계를 스스로 발견하도록 짧은 유도 질문 1~2개와 아주 작은 단서만 주세요.',
        'strong-hint': '두 번째 단계 힌트입니다. 핵심 단어나 문법 기능을 좁혀 주되, 가능한 한 학습자가 마지막 연결을 직접 하게 하세요. 완성된 답을 그대로 복사해 주지 마세요.',
        explanation: '마지막 설명 단계입니다. 이제 질문에 직접 답하고, 왜 그런지 명확히 설명한 뒤 짧고 실제적인 한국어 예시를 제시하세요.',
      };

      let historyText = '';
      if (chatHistory && chatHistory.length > 0) {
        historyText = chatHistory.map(msg => {
          const sender = msg.role === 'user' ? '학습자 (User)' : 'AI 튜터 (Tutor)';
          const text = msg.parts?.[0]?.text || '';
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
1. 현재 코칭 단계는 "${guidanceStage}"입니다. ${guidance[guidanceStage]}
2. 초/중급 수준(A1~B2)의 학습자에게는 핵심 문법이나 단어를 설명할 때 사용자의 모국어(${langName})를 사용하여 알기 쉽게 풀어서 설명하세요.
3. 고급 수준(C1~C2)의 학습자에게는 한국어 실력 향상을 위해 100% 한국어로만 답변하십시오. 절대 영어 등 모국어를 섞지 마십시오.
4. 예시는 explanation 단계에서만 1~2개의 짧고 실제적인 한국어 문장을 제시하고, hint 단계에서는 예시로 정답을 노출하지 마세요.
5. 마크다운 형식을 활용하여 가독성 있게 구조화된 답변을 작성해 주세요. (JSON 형식이 아닌 일반 텍스트 마크다운으로 답변을 생성하세요.)`;

      // tutorChat은 일반 텍스트 마크다운으로 답변하므로 responseMimeType을 지정하지 않습니다.
      const { text, modelUsed } = await generateWithFallback(prompt);
      return NextResponse.json({ text, generatorModel: modelUsed });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    if (signal.aborted || err instanceof AiDeadlineError) {
      return NextResponse.json({ error: 'AI request timed out. Please retry.' }, { status: 503 });
    }
    const code = (err as { status?: unknown } | null)?.status;
    const status = code === 400 || code === 413 || code === 415 ? code : 503;
    const message = status === 400 ? 'Invalid JSON request' : status === 413 ? 'Request too large' :
      status === 415 ? 'JSON required' : 'AI response unavailable. Please retry.';
    return NextResponse.json({ error: message }, { status });
  } finally {
    clearTimeout(deadlineTimer);
  }
}
