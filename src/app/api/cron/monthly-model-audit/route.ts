import { isAuthorizedCron } from '@/lib/cronAuth';
/**
 * @file route.ts (api/cron/monthly-model-audit)
 * @description 매월 1일 Google AI Studio의 최신 활성 모델 목록을 전수 조사하고,
 *              실제 한국어 작문 벤치마크(응답 속도, 한글 완성도, JSON 규격 준수)를 테스트하여
 *              '글 생성용 Top 3' 및 '사전 검색용 Top 3' 모델을 평가·선정하는 월간 모델 오딧 스케줄러입니다.
 * @trigger Vercel Cron Jobs (매월 1일 00:00 UTC / 09:00 KST 실행) 또는 관리자 수동 호출
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

interface BenchmarkScore {
  modelId: string;
  displayName: string;
  category: 'Article-Creative' | 'Dictionary-Speed';
  latencyMs: number;
  status: 'SUCCESS' | 'FAILED';
  koreanPurityScore: number; // 0~100점 (외래어/한자 유무 검사)
  jsonValid: boolean;
  totalScore: number;
  notes: string;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers, process.env.CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const auditStart = Date.now();
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
  }

  // ═══════════════════════════════════════════════════
  // 1. Google API에서 현재 살아있는 공식 모델 목록 실시간 조회
  // ═══════════════════════════════════════════════════
  let activeGoogleModels: { name: string; displayName: string }[] = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      activeGoogleModels = (listData.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          name: m.name.replace('models/', ''),
          displayName: m.displayName || m.name
        }));
    }
  } catch (err) {
    console.error('Failed to fetch Google model list:', err);
  }

  // ═══════════════════════════════════════════════════
  // 2. 벤치마크 대상 유력 후보 모델 선별 (Flash 및 Lite 계열)
  // ═══════════════════════════════════════════════════
  const candidateNames = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
  ];

  // 구글 공식 활성 목록에 실제로 존재하는 후보군만 매칭
  const targetsToBenchmark = candidateNames.filter(c => 
    activeGoogleModels.length === 0 || activeGoogleModels.some(m => m.name === c)
  );

  const benchmarkResults: BenchmarkScore[] = [];

  // ═══════════════════════════════════════════════════
  // 3. 각 모델에 실제 한국어 작문 벤치마크 테스트 수행
  // ═══════════════════════════════════════════════════
  const benchmarkPrompt = `당신은 한국어 교육자입니다.
CEFR A2 수준의 한국 음식 주제로 짧은 글을 작성하세요.
반드시 100% 순수한 한글로만 작성하고 외래 문자나 한자를 절대 쓰지 마십시오.
다음 JSON 포맷만 반환하세요:
{"title":"제목","content":"내용","korean":"순수한국어"}`;

  for (const modelId of targetsToBenchmark) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초 제한

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: benchmarkPrompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
        })
      });
      clearTimeout(timeoutId);

      const elapsed = Date.now() - start;
      if (!res.ok) {
        benchmarkResults.push({
          modelId,
          displayName: activeGoogleModels.find(m => m.name === modelId)?.displayName || modelId,
          category: modelId.includes('lite') ? 'Dictionary-Speed' : 'Article-Creative',
          latencyMs: elapsed,
          status: 'FAILED',
          koreanPurityScore: 0,
          jsonValid: false,
          totalScore: 0,
          notes: `HTTP ${res.status} 오류 발생 (호출 불가)`
        });
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // 검증 1: JSON 유효성
      let parsedOk = false;
      let koreanText = ''; 
      try {
        const parsed = JSON.parse(text);
        if (!['title', 'content', 'korean'].every(k => typeof parsed[k] === 'string' && parsed[k].trim())) throw new Error('Invalid benchmark');
        koreanText = [parsed.title, parsed.content, parsed.korean].join(' ');
        parsedOk = true;
      } catch {
        parsedOk = false;
      }

      // 검증 2: 한글 순수도 (영어/한자 혼입 체크)
      const foreignCharMatch = koreanText.match(/[\u4E00-\u9FFF\u3040-\u30FFa-zA-Z]/g);
      const foreignCount = foreignCharMatch ? foreignCharMatch.length : 0;
      const purityScore = Math.max(0, 100 - foreignCount * 5);

      // 점수 계산: (속도 점수 + JSON 점수 + 한글 점수)
      const speedScore = Math.max(0, 100 - Math.floor(elapsed / 100)); // 1초 이내면 90점 이상
      const totalScore = (parsedOk ? 30 : 0) + (purityScore * 0.4) + (speedScore * 0.3);

      benchmarkResults.push({
        modelId,
        displayName: activeGoogleModels.find(m => m.name === modelId)?.displayName || modelId,
        category: modelId.includes('lite') ? 'Dictionary-Speed' : 'Article-Creative',
        latencyMs: elapsed,
        status: 'SUCCESS',
        koreanPurityScore: purityScore,
        jsonValid: parsedOk,
        totalScore: Math.round(totalScore),
        notes: `정상 응답 (${elapsed}ms, 한글 순수도 ${purityScore}점)`
      });

    } catch (e: any) {
      benchmarkResults.push({
        modelId,
        displayName: modelId,
        category: modelId.includes('lite') ? 'Dictionary-Speed' : 'Article-Creative',
        latencyMs: Date.now() - start,
        status: 'FAILED',
        koreanPurityScore: 0,
        jsonValid: false,
        totalScore: 0,
        notes: `타임아웃 또는 예외: ${e?.message || String(e)}`
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // 4. 용도별 Top 3 모델 랭킹 도출
  // ═══════════════════════════════════════════════════
  // 글 생성용 (품질, 한글 순수도 및 정규 Flash 체급 위주)
  const topForArticles = benchmarkResults
    .filter(r => r.status === 'SUCCESS' && r.jsonValid && r.koreanPurityScore > 0 && !r.modelId.includes('lite'))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3);

  // 사전 검색용 (지연 시간 최우선, Lite 체급 우선)
  const topForDictionary = benchmarkResults
    .filter(r => r.status === 'SUCCESS' && r.jsonValid && r.koreanPurityScore > 0)
    .sort((a, b) => a.latencyMs - b.latencyMs)
    .slice(0, 3);

  const report = {
    reportType: 'Koreading Monthly AI Model Audit & Benchmark',
    auditDate: new Date().toISOString(),
    executionDurationMs: Date.now() - auditStart,
    totalCandidateTested: targetsToBenchmark.length,
    activeGoogleCatalogCount: activeGoogleModels.length,
    rankings: {
      top3ForArticles: topForArticles.map((m, idx) => ({
        rank: idx + 1,
        modelId: m.modelId,
        displayName: m.displayName,
        latency: `${m.latencyMs}ms`,
        score: m.totalScore,
        purity: `${m.koreanPurityScore}%`,
        recommendation: idx === 0 ? '🏆 1순위 메인 글 생성 모델로 권장' : '🥈 백업 폴백 체인 권장'
      })),
      top3ForDictionary: topForDictionary.map((m, idx) => ({
        rank: idx + 1,
        modelId: m.modelId,
        displayName: m.displayName,
        latency: `${m.latencyMs}ms`,
        recommendation: idx === 0 ? '⚡ 1순위 초고속 사전 모델로 권장' : '🔄 사전 폴백 권장'
      }))
    },
    rawBenchmarkResults: benchmarkResults,
  };

  console.log(`[Monthly Model Audit] Completed in ${Date.now() - auditStart}ms. Top Article: ${topForArticles[0]?.modelId || 'None'}, Top Dict: ${topForDictionary[0]?.modelId || 'None'}`);

  return NextResponse.json(report, {
    status: 200,
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}
