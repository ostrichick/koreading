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

    const systemInstruction = 'You are an expert Korean linguist and native language teacher. You must strictly follow all instructions. In any field designed for Korean (such as "content", "title", "definition", "structure", "korean" in examples), you MUST write strictly and 100% in pure Korean characters (한글) only. Absolutely NEVER include any foreign characters, Chinese characters (한자/漢字), Japanese (日本語/かな/カナ), English, Hindi, Vietnamese, or any other languages, symbols, or alphabets. Every single word in the Korean fields must be natural, correct, 100% pure Korean as written by a native speaker. Strictly follow this rule without exception.';
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const model25 = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
    const model20 = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction });
    const model15 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction });
    const model20lite = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite', systemInstruction });
    const model15_8b = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b', systemInstruction });

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    /** 503/429 재시도 가능 에러인지 판별 */
    const isRetryableError = (msg: string) =>
      msg.includes('503') || msg.includes('429') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('Quota') || msg.includes('quota');

    /**
     * Helper to call AI with primary Groq Gemma 2 9B and dynamic fallback to Gemini (non-streaming, for lookupWord/generateTest)
     */
    const generateWithFallback = async (prompt: string, responseMimeType?: string): Promise<{ text: string; modelUsed: string }> => {
      // 1. If GROQ_API_KEY is configured in the environment, use Groq Gemma 2 9B as the primary engine!
      if (process.env.GROQ_API_KEY) {
        try {
          console.log('⚡ Calling primary Groq API: gemma2-9b-it');
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gemma2-9b-it',
              temperature: 0.1,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: prompt }
              ],
              response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
            })
          });
          if (res.ok) {
            const data = await res.json();
            return { text: data.choices[0].message.content, modelUsed: 'Gemma 2 9B (Groq LPU)' };
          }
          const errText = await res.text();
          console.warn(`[Groq API warning status ${res.status}]: ${errText}`);
        } catch (groqErr) {
          console.warn('⚠️ Groq connection failed, falling back to Gemini...', groqErr);
        }
      }

      // Gemini 폴백 체인: 2.5 Flash → 2.0 Flash → 1.5 Flash → 2.0 Flash Lite → 1.5 Flash 8B
      const config = {
        temperature: 0.1,
        responseMimeType: responseMimeType === 'application/json' ? 'application/json' : undefined
      };
      const geminiModels = [
        { model: model25, name: 'Gemini 2.5 Flash' },
        { model: model20, name: 'Gemini 2.0 Flash' },
        { model: model15, name: 'Gemini 1.5 Flash' },
        { model: model20lite, name: 'Gemini 2.0 Flash Lite' },
        { model: model15_8b, name: 'Gemini 1.5 Flash 8B' },
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
            await sleep(1500);
            continue;
          }
          continue;
        }
      }
      throw new Error('모든 AI 모델이 현재 사용 불가능합니다.');
    };

    // ═══════════════════════════════════════════════════
    // 📰 generateArticle: Groq 3종 + Gemini 5종 = 8중 폴백 + 로그 수집
    // ═══════════════════════════════════════════════════
    if (action === 'generateArticle') {
      const levelConfig: Record<CEFRLevel, string> = {
        A1: '가장 기초적인 한국어 어휘만 사용하십시오. 단순한 문장 구조 (문장당 4~6개 단어). 쉬운 현재 시제 전용. 텍스트 전체 길이는 약 400~500자 크기로 서술하십시오. 한 문장마다 끊어 쓰지 말고, 4~6개의 문장이 뭉친 하나의 탄탄한 문단으로 구성하십시오.',
        A2: '기초 한국어 어휘를 사용하십시오. 문장당 6~10개 단어로 구성된 명료한 문장. 현재, 과거 및 기초 미래 시제 사용. 전체 길이는 약 600~800자 크기로 상세히 서술하고, 2~3개의 정돈된 문단으로 구성하십시오.',
        B1: '중급 한국어 어휘를 사용하십시오. 다양한 연결어미와 문장 구조를 혼합하고 형용사와 부사를 다채롭게 사용하십시오. 전체 길이는 약 900~1100자 크기로 읽을거리가 많게 서술하고, 3~4개의 명확한 문단으로 구성하십시오.',
        B2: '중상급 한국어 어휘를 사용하십시오. 복잡한 문장 구조와 다양한 문법 패턴을 자유롭게 사용하십시오. 전체 길이는 약 1200~1400자 크기로 상세하고 깊이 있는 내용을 담아 3~4개의 문단으로 구성하십시오.',
        C1: '고급 한국어 어휘 및 일부 관용구, 숙어를 세련되게 활용하십시오. 복잡하고 품격 있는 문장 구조를 보여주십시오. 전체 길이는 약 1500~1700자 크기로 깊이 있고 포괄적인 전개를 보이며 4~5개의 문단으로 구성하십시오.',
        C2: '원어민 수준의 고급 학술, 문학, 언론 문체를 자유롭게 활용하십시오. 지극히 정교하고 심도 있는 문장을 구사하십시오. 전체 길이는 약 1800~2000자 크기로 매끄럽고 가치가 풍부하게 서술하고 4~5개의 문단으로 구성하십시오.',
      };

      const topicLabel = TOPICS.find((t: { id: string; label: string }) => t.id === topic)?.label || topic;
      const langNote = nativeLang === 'es' ? 'Spanish' : 'English';

      let topicSpecialInstruction = '';
      if (topic === 'fairy-tales') {
        topicSpecialInstruction = '\n[한국 동화 주제 특별 지침]: 주제가 "한국 동화(fairy-tales)"이므로, 한국 동화에 대한 설명이나 소개글(예: "한국 동화는 흥미롭습니다. 흥부와 놀부가 있습니다...")을 절대 작성하지 마십시오. 대신, 학습자가 직접 읽고 감동이나 재미를 느낄 수 있는 "진짜 동화 이야기 자체(가상/전통 픽션 스토리)"를 창작하십시오. 교훈을 담고 있거나 아이들이 좋아할 만한 흥미진진한 동화 이야기를 처음부터 끝까지 생생한 동화 형식으로 서술해야 합니다.';
      } else if (topic === 'nature-travel') {
        topicSpecialInstruction = '\n[자연 & 여행 주제 특별 지침]: 주제가 "자연 & 여행(nature-travel)"이므로, 가상의 인물이 작성한 지극히 사적이고 평범한 개인 여행 경험담(예: "나는 지난주에 친구와 함께 제주도에 놀러 갔다. 바람이 불고 바다가 예뻤다...")을 절대 작성하지 마십시오. 대신, 한국의 아름답고 특별한 실제 자연 경관이나 유명 여행지(예: 제주도 한라산, 강원도 설악산 국립공원, 경주 불국사와 석굴암, 부산 해운대와 태종대 등 실존하는 한국의 명소)를 매력적이고 교육적으로 기술하는 "실용적인 지리/여행지 소개 및 추천 설명문" 형식으로 서술해야 합니다.';
      } else if (topic === 'k-content') {
        topicSpecialInstruction = '\n[K-콘텐츠 주제 특별 지침]: 주제가 "K-콘텐츠(k-content)"이므로, "한국 콘텐츠는 세계적으로 인기를 끌고 있습니다. 한국 드라마와 영화가 유명합니다..." 같은 막연하고 일반적인 개요성 설명을 절대 작성하지 마십시오. 대신, 실제로 존재하는 유명한 특정 한국 콘텐츠 작품 하나를 무작위로 선택하여(예: 드라마 \"오징어 게임\", \"사랑의 불시착\", \"미스터 션샤인\", \"도깨비\", \"나의 아저씨\", 영화 \"기생충\", \"올드보이\", \"헤어질 결심\", \"과속스캔들\", 책 \"채식주의자\", \"82년생 김지영\", \"아몬드\", 또는 유명 케이팝 그룹/아티스트 등) 그 작품 한 가지에 대해 깊이 있게 소개하는 글을 작성하십시오. 작품의 줄거리 요약, 주요 등장인물/아티스트 소개, 왜 인기를 끌었는지, 어떤 점이 매력적인지, 관련 문화적 배경 등을 학습자가 흥미를 느끼도록 매력적이고 구체적으로 서술해야 합니다. 매번 서로 다른 작품을 선택하여 다양성을 확보하세요.';
      }

      const prompt = `당신은 전문 한국어 교사입니다.
CEFR ${level} 레벨의 한국어 학습자를 위한 "${topicLabel}" 주제의 흥미롭고 유용한 한국어 읽기 본문을 작성해 주세요.${topicSpecialInstruction}

[절대 준수해야 하는 강한 제약 조건 (CRITICAL)]:
1. "title"과 "content" 필드는 반드시 100% 순수한 한글(한국어 문자)로만 작성해야 합니다.
2. 절대 본문("content")이나 제목("title")에 영어, 스페인어, 한자(漢字/简繁体字), 일본어(日本語/かな/カナ), 러시아어, 터키어, 힌디어, 베트남어 등 그 어떤 외국어 문자, 알파벳, 단어(예: domestic, countries, 影響力, 需求, ülk, contexto, изуч, 过程, 技术, 吸收, 世界, 보는 -> 見る 등)도 단 한 글자도 포함해서는 안 됩니다. 100% 완벽한 한글로만 구성해야 합니다.
3. 100% 순수 한국어 제약: 어려운 어휘를 설명하거나 학습 자료를 구성할 때, 괄호 속 번역이나 외국어 주석(예: '맥락(contexto)' 또는 '공부(изуч)하다' 또는 '건강(健康)' 등)을 절대로 본문에 집어넣지 마십시오. 모든 단어는 괄호나 번역 표기 없이 100% 순수한 한글 단어(예: '맥락', '공부', '건강')로만 문장 속에 자연스럽게 녹여내야 합니다. 번역 설명용 외래 문자는 절대 금지입니다.
4. 문장 구조 제약 조건:
- ${levelConfig[level as CEFRLevel]}
5. 본문은 한 문장마다 줄바꿈을 하지 말고, 3~4개 이상의 문장이 자연스럽게 연결된 완성도 높은 문단(Paragraph)으로 구성해 주세요. (A1/A2 레벨의 경우에도 4~6개의 문장이 하나의 유기적인 문단으로 묶여 있어야 합니다.)

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호 없이 JSON만 반환):
{
  "title": "텍스트 제목 (100% 순수 한글)",
  "content": "전체 텍스트 내용 (한국어 원어민이 쓴 것처럼 극히 자연스럽고 유려하며, 문단 구분이 잘 된 100% 순수 한글)",
  "summary": "${langNote}로 작성된 한 문장의 본문 요약",
  "topicCategory": "${topic}",
  "level": "${level}",
  "estimatedMinutes": 2, // 텍스트 난이도와 길이에 따라 예상 소요 시간(분)을 정수(예: 1, 2, 3, 4)로 동적 예측
  "keyVocabulary": ["핵심단어1", "핵심단어2", "핵심단어3", "핵심단어4", "핵심단어5"]
}`;

      const genConfig = { temperature: 0.1, responseMimeType: 'application/json' as const };
      const logs: string[] = [];
      let resultText: string | null = null;
      let modelUsed = '';

      // ── Groq 다중 모델 (Google과 완전히 독립된 인프라) ──
      if (process.env.GROQ_API_KEY) {
        const groqModels = [
          { id: 'gemma2-9b-it', name: 'Groq Gemma 2 9B' },
          { id: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B' },
          { id: 'llama-3.1-8b-instant', name: 'Groq Llama 3.1 8B' },
        ];
        for (const gm of groqModels) {
          if (resultText) break;
          logs.push(`⚡ ${gm.name} 모델에 연결 중...`);
          try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
              },
              body: JSON.stringify({
                model: gm.id,
                temperature: 0.1,
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
              })
            });
            if (res.ok) {
              const data = await res.json();
              resultText = data.choices[0].message.content;
              modelUsed = gm.name;
              logs.push(`✅ ${gm.name} 모델로 생성 성공!`);
            } else {
              const errText = (await res.text()).substring(0, 120);
              logs.push(`⚠️ ${gm.name} 오류 (HTTP ${res.status}): ${errText}`);
            }
          } catch (e: any) {
            logs.push(`⚠️ ${gm.name} 연결 실패: ${(e?.message || '').substring(0, 100)}`);
          }
        }
      }

      // ── Gemini 5종 폴백 체인 ──
      if (!resultText) {
        const geminiChain = [
          { model: model25, name: 'Gemini 2.5 Flash' },
          { model: model20, name: 'Gemini 2.0 Flash' },
          { model: model15, name: 'Gemini 1.5 Flash' },
          { model: model20lite, name: 'Gemini 2.0 Flash Lite' },
          { model: model15_8b, name: 'Gemini 1.5 Flash 8B' },
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
              await sleep(1000);
            } else {
              logs.push(`⚠️ ${name} 오류: ${msg.substring(0, 120)}`);
            }
          }
        }
      }

      // ── 최종 결과 반환 (항상 _logs 포함) ──
      if (resultText) {
        try {
          const parsed = JSON.parse(resultText);
          return NextResponse.json({ ...parsed, generatorModel: modelUsed, _logs: logs });
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

    } else if (action === 'lookupWord') {
      const { type } = body;
      const langName = nativeLang === 'es' ? 'Spanish' : 'English';

      if (type === 'basic') {
        const prompt = `당신은 대한민국 국어사전 및 한국어 교육 전문가입니다.

한국어 단어: "${word}"
문맥 속 문장: "${sentence}"

[절대 준수해야 하는 강한 제약 조건]:
1. "definition" 필드는 반드시 100% 순수한 한국어 한글로만 작성해야 합니다. 절대 일본어, 영어, 한자(漢字), 또는 그 외의 외국어를 섞어서 작성하지 마십시오.
2. "partOfSpeech" 필드는 한국어 품사 용어(예: 명사, 동사, 형용사, 부사, 조사, 어미 등)를 사용하여 100% 한국어로만 작성하십시오.
3. "translation" 필드는 반드시 ${langName}로 작성해야 합니다.

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호나 추가 설명 없이 JSON만 반환):
{
  "word": "${word}",
  "pronunciation": "발음 로마자 표기",
  "partOfSpeech": "품사 (한국어로 작성)",
  "definition": "한국어 정의 (100% 순수 한글)",
  "translation": "${langName} 번역",
  "level": "CEFR 레벨 (A1/A2/B1/B2/C1/C2 중 하나)"
}`;

        const { text } = await generateWithFallback(prompt, 'application/json');
        return NextResponse.json(JSON.parse(text));
      } else {
        const prompt = `당신은 한국어 형태소 분석 및 언어학 전문가입니다.

분석할 한국어 단어: "${word}"
문맥 속 문장: "${sentence}"

[절대 준수해야 하는 강한 제약 조건]:
1. "structure" 필드는 반드시 100% 순수한 한국어 한글로만 작성해야 합니다. 절대 일본어(예: 食べる), 영어, 한자(漢字), 또는 그 외의 외국어 문자를 섞어서 작성하지 마십시오.
2. "examples" 배열의 "korean" 필드는 반드시 100% 순수 한글로 된 올바른 예문으로만 작성되어야 합니다.
3. "examples" 배열의 "translation" 필드는 반드시 ${langName} 번역이어야 합니다.

반드시 다음 형식의 JSON 객체만 반환해 주세요 (마크다운 기호나 추가 설명 없이 JSON만 반환):
{
  "structure": "단어의 구조/활용 분석 (예: \'다녀왔습니다\'의 경우 \'동사 다니다 + 오다 + -었습니다 / -습니다\' 와 같이 격조사, 어미, 보조용언, 복합어 등의 구성을 교육적이고 명확한 한국어로 기술. 100% 순수 한글로만 작성)",
  "examples": [
    {"korean": "단어가 올바르게 사용된 한국어 예문 1", "translation": "${langName} 번역 1"},
    {"korean": "단어가 올바르게 사용된 한국어 예문 2", "translation": "${langName} 번역 2"},
    {"korean": "단어가 올바르게 사용된 한국어 예문 3", "translation": "${langName} 번역 3"}
  ]
}`;

        const { text } = await generateWithFallback(prompt, 'application/json');
        return NextResponse.json(JSON.parse(text));
      }

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
