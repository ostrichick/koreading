import { isAuthorizedCron } from '@/lib/cronAuth';
/**
 * @file route.ts (api/cron/check-models)
 * @description 매일 하루에 한 번 현재 활성화된 고성능 AI 모델들(Gemini 3.8/3.7/3.6/3.5/3.5-lite 등)의 가용성과 쿼터를 자동 점검하는 헬스체크 Cron API입니다.
 * @why AI 제공사(Google, Groq)의 신규 고성능 모델 릴리즈 및 일일 쿼터(RPD 20/500) 상황을 선제적으로 진단하고,
 *      구버전(2.5 Flash) 소진 시에도 상위 모델 및 500 RPD 고용량 모델 체인이 정상 가동되는지 모니터링합니다.
 * @trigger Vercel Cron Jobs (매일 UTC 00:00 / KST 오전 09:00 자동 실행) 또는 관리자 수동 브라우저 호출
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrioritizedGeminiModels } from '@/lib/geminiModels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ModelHealthResult {
  provider: 'Google Gemini' | 'Groq';
  modelId: string;
  role: 'Article Generation' | 'Dictionary Lookup' | 'High-Quota Safety Net' | 'Fallback';
  isAvailable: boolean;
  httpStatus: number;
  latencyMs: number;
  message?: string;
  isQuotaExceeded?: boolean;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results: ModelHealthResult[] = [];

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // ═══════════════════════════════════════════════════
  // 1. Google Gemini 동적 우선순위 모델군 가용성 & 쿼터 핑 테스트
  // ═══════════════════════════════════════════════════
  if (geminiKey) {
    const { articleModels } = await getPrioritizedGeminiModels(geminiKey);
    // 상위 주요 아티클 모델 및 고용량 안전망 모델들을 검사 대상으로 선별
    const targetsToPing = articleModels.slice(0, 7);

    for (let i = 0; i < targetsToPing.length; i++) {
      const target = targetsToPing[i];
      const pingStart = Date.now();
      const role = i === 0 
        ? ('Article Generation' as const)
        : target.isLite 
        ? ('High-Quota Safety Net' as const) 
        : ('Fallback' as const);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${target.id}:generateContent?key=${geminiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 2, temperature: 0.1 }
          })
        });
        clearTimeout(timeoutId);
        const latency = Date.now() - pingStart;

        if (res.ok) {
          results.push({
            provider: 'Google Gemini',
            modelId: target.id,
            role,
            isAvailable: true,
            httpStatus: res.status,
            latencyMs: latency,
            message: `정상 가동 중 (Healthy, ${latency}ms)`
          });
        } else {
          const errText = (await res.text()).substring(0, 150);
          const isQuota = res.status === 429 || errText.toLowerCase().includes('quota');
          results.push({
            provider: 'Google Gemini',
            modelId: target.id,
            role,
            isAvailable: false,
            httpStatus: res.status,
            latencyMs: latency,
            isQuotaExceeded: isQuota,
            message: isQuota ? '일일 쿼터 소진 (429 Quota Exceeded)' : `호출 응답 오류: ${errText}`
          });
        }
      } catch (err: unknown) {
        const note = err instanceof Error ? err.message : String(err);
        results.push({
          provider: 'Google Gemini',
          modelId: target.id,
          role,
          isAvailable: false,
          httpStatus: 0,
          latencyMs: Date.now() - pingStart,
          message: `연결 타임아웃 또는 네트워크 오류: ${note}`
        });
      }
    }
  } else {
    results.push({
      provider: 'Google Gemini',
      modelId: 'ALL',
      role: 'Fallback',
      isAvailable: false,
      httpStatus: 500,
      latencyMs: 0,
      message: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.'
    });
  }

  // ═══════════════════════════════════════════════════
  // 2. Groq 설정 모델군 가용성 핑 테스트
  // ═══════════════════════════════════════════════════
  const groqTestList = [
    { id: 'openai/gpt-oss-120b', role: 'Fallback' as const },
  ];

  if (groqKey) {
    for (const target of groqTestList) {
      const pingStart = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: target.id,
            max_tokens: 2,
            messages: [{ role: 'user', content: 'ping' }]
          })
        });
        clearTimeout(timeoutId);
        const latency = Date.now() - pingStart;

        if (res.ok) {
          results.push({
            provider: 'Groq',
            modelId: target.id,
            role: target.role,
            isAvailable: true,
            httpStatus: res.status,
            latencyMs: latency,
            message: '정상 가동 중 (Healthy)'
          });
        } else {
          const errText = (await res.text()).substring(0, 150);
          results.push({
            provider: 'Groq',
            modelId: target.id,
            role: target.role,
            isAvailable: false,
            httpStatus: res.status,
            latencyMs: latency,
            message: `호출 오류: ${errText}`
          });
        }
      } catch (err: unknown) {
        const note = err instanceof Error ? err.message : String(err);
        results.push({
          provider: 'Groq',
          modelId: target.id,
          role: target.role,
          isAvailable: false,
          httpStatus: 0,
          latencyMs: Date.now() - pingStart,
          message: `연결 타임아웃 또는 네트워크 오류: ${note}`
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // 3. 종합 상태 판정 및 동적 알림 리포트 생성
  // ═══════════════════════════════════════════════════
  const availableCount = results.filter(r => r.isAvailable).length;
  const totalCount = results.length;
  const availableGemini = results.filter(r => r.provider === 'Google Gemini' && r.isAvailable);
  const activeArticleModel = availableGemini[0];

  let overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
  if (availableGemini.length === 0) {
    overallHealth = 'CRITICAL';
  } else if (availableCount < totalCount) {
    overallHealth = 'DEGRADED';
  }

  const report = {
    service: 'Koreading AI Health Check',
    timestamp: new Date().toISOString(),
    overallHealth,
    summary: `${totalCount}개 중 ${availableCount}개 모델 가용 (${overallHealth})`,
    executionDurationMs: Date.now() - startTime,
    activePrimaryModel: activeArticleModel ? activeArticleModel.modelId : 'None',
    availableGeminiModelsCount: availableGemini.length,
    results,
    recommendations: overallHealth === 'HEALTHY' 
      ? ['모든 핵심 및 신규 고성능 AI 모델이 안정적으로 응답하고 있습니다.']
      : overallHealth === 'DEGRADED'
      ? [`일부 모델(쿼터 소진 등)이 있으나, 최신 활성 모델(${activeArticleModel?.modelId || 'N/A'})로 자동 우회되어 정상 서비스 중입니다.`]
      : ['🚨 경고: 모든 Gemini 모델이 응답하지 않습니다! API Key 또는 구글 서비스 상태를 점검하세요.']
  };

  console.log(`[Cron: check-models] Health: ${overallHealth}, Active: ${activeArticleModel?.modelId || 'None'}, Available: ${availableCount}/${totalCount}`);

  return NextResponse.json(report, {
    status: overallHealth === 'CRITICAL' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    }
  });
}
