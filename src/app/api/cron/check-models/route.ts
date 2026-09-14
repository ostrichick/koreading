import { isAuthorizedCron } from '@/lib/cronAuth';
/**
 * @file route.ts (api/cron/check-models)
 * @description 매일 하루에 한 번 현재 설정된 AI 모델들(Gemini, Groq)의 가용성을 자동으로 점검하는 헬스체크 Cron API입니다.
 * @why AI 제공사(Google, Groq)가 예고 없이 구버전 모델을 폐기(Decommission)하거나 쿼터 문제가 발생할 때, 
 *      실제 사용자가 글을 생성하기 전에 관리자가 선제적으로 문제를 감지하고 대응할 수 있도록 지원합니다.
 * @trigger Vercel Cron Jobs (매일 UTC 00:00 / KST 오전 09:00 자동 실행) 또는 관리자 수동 브라우저 호출
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

interface ModelHealthResult {
  provider: 'Google Gemini' | 'Groq';
  modelId: string;
  role: 'Article Generation' | 'Dictionary Lookup' | 'Fallback';
  isAvailable: boolean;
  httpStatus: number;
  latencyMs: number;
  message?: string;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers, process.env.CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const startTime = Date.now();
  const results: ModelHealthResult[] = [];

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // ═══════════════════════════════════════════════════
  // 1. Google Gemini 현재 설정 모델군 가용성 핑 테스트
  // ═══════════════════════════════════════════════════
  const geminiTestList = [
    { id: 'gemini-2.5-flash', role: 'Article Generation' as const },
    { id: 'gemini-3.5-flash-lite', role: 'Dictionary Lookup' as const },
    { id: 'gemini-flash-lite-latest', role: 'Fallback' as const },
    { id: 'gemini-3.5-flash', role: 'Fallback' as const },
  ];

  if (geminiKey) {
    for (const target of geminiTestList) {
      const pingStart = Date.now();
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
            role: target.role,
            isAvailable: true,
            httpStatus: res.status,
            latencyMs: latency,
            message: '정상 가동 중 (Healthy)'
          });
        } else {
          const errText = (await res.text()).substring(0, 150);
          results.push({
            provider: 'Google Gemini',
            modelId: target.id,
            role: target.role,
            isAvailable: false,
            httpStatus: res.status,
            latencyMs: latency,
            message: `호출 오류: ${errText}`
          });
        }
      } catch (err: any) {
        results.push({
          provider: 'Google Gemini',
          modelId: target.id,
          role: target.role,
          isAvailable: false,
          httpStatus: 0,
          latencyMs: Date.now() - pingStart,
          message: `연결 타임아웃 또는 네트워크 오류: ${err?.message || String(err)}`
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
    { id: 'qwen/qwen3.8-27b', role: 'Article Generation' as const },
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
      } catch (err: any) {
        results.push({
          provider: 'Groq',
          modelId: target.id,
          role: target.role,
          isAvailable: false,
          httpStatus: 0,
          latencyMs: Date.now() - pingStart,
          message: `연결 타임아웃 또는 네트워크 오류: ${err?.message || String(err)}`
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // 3. 종합 상태 판정 및 알림 리포트 생성
  // ═══════════════════════════════════════════════════
  const availableCount = results.filter(r => r.isAvailable).length;
  const totalCount = results.length;
  const primaryGeminiOk = results.find(r => r.modelId === 'gemini-2.5-flash')?.isAvailable ?? false;

  let overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
  if (!primaryGeminiOk) {
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
    primaryModelReady: primaryGeminiOk,
    results,
    recommendations: overallHealth === 'HEALTHY' 
      ? ['모든 핵심 AI 모델이 안정적으로 응답하고 있습니다. 정상 운영 중입니다.']
      : overallHealth === 'DEGRADED'
      ? ['일부 보조/폴백 모델의 응답에 문제가 있습니다. 메인 서비스는 동작하지만 폴백 체인을 확인하세요.']
      : ['🚨 경고: 메인 아티클 생성 모델(gemini-2.5-flash)이 응답하지 않습니다! API Key 쿼터 또는 구글 서비스 상태를 즉시 점검하세요.']
  };

  // Vercel 런타임 로그에 기록
  console.log(`[Cron: check-models] Health: ${overallHealth}, Available: ${availableCount}/${totalCount}`);

  return NextResponse.json(report, {
    status: overallHealth === 'CRITICAL' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    }
  });
}
