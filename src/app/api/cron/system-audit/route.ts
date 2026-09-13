import { isAuthorizedCron } from '@/lib/cronAuth';
/**
 * @file route.ts (api/cron/system-audit)
 * @description Koreading 주간 4대 정기 시스템 감사 및 가용성 진단 Cron API입니다.
 * 
 * [감사 4대 항목]
 * 1. 도서관 아티클 품질 전수 감사:
 *    - 본문 길이 미달(초단기/미완성 지문), 괄호 속 외래어/영단어 혼입('(study)' 등), 단어장 누락 탐지
 * 2. 구글 애드센스 법적/핵심 페이지 200 OK 가용성 헬스체크:
 *    - 메인(/), /about, /privacy, /terms, /library, /test, /sitemap.xml, /robots.txt 전수 핑
 * 3. 구글 검색 색인(SEO) 및 동적 사이트맵(/sitemap.xml) 연동 감사:
 *    - XML 정상 반환 여부 및 DB에 등록된 개별 독해 페이지(/read/[id]) 포함 여부 및 색인 URL 수 집계
 * 4. Firestore 쿼터 및 저장소 용량 진단:
 *    - CEFR 레벨별 분포, 평균 글자 수, AI 생성 모델별 분포, 무료 할당량(50,000 reads/day) 대비 가용치 산출
 * 
 * @trigger Vercel Cron Jobs (매주 일요일 UTC 00:00 / KST 오전 09:00) 또는 관리자 수동 호출
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Article } from '@/lib/db';
import { publicArticleIndex } from '@/lib/server/publicArticles';

export const dynamic = 'force-dynamic';
// Firebase JS SDK 호출을 위해 Node.js 런타임 사용
export const runtime = 'nodejs';

interface ArticleQualityIssue {
  id: string;
  title: string;
  level: string;
  reasons: string[];
  snippet: string;
  createdAt?: string;
}

interface PageHealthItem {
  path: string;
  url: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  isLegalRequired: boolean;
  error?: string;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers, process.env.CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const auditStart = Date.now();

  // 기준 URL (요청 origin 또는 프로덕션 도메인)
  const origin = req.nextUrl.origin || 'https://koreading.vercel.app';

  // ═══════════════════════════════════════════════════
  // 1. 도서관 아티클 전수 품질 감사 (Quality Audit)
  // ═══════════════════════════════════════════════════
  let articles: Article[] = [];
  let dbError: string | null = null;
  const qualityIssues: ArticleQualityIssue[] = [];
  const levelDistribution: Record<string, number> = {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, OTHER: 0
  };
  const modelDistribution: Record<string, number> = {};
  let totalCharacters = 0;

  try {
    articles = await publicArticleIndex(true);

    for (const article of articles) {
      const reasons: string[] = [];
      const content = article.content || '';
      totalCharacters += content.length;

      // 레벨 집계
      if (article.level && levelDistribution[article.level] !== undefined) {
        levelDistribution[article.level]++;
      } else {
        levelDistribution.OTHER++;
      }

      // 생성 모델 집계
      const model = article.generatorModel || 'unknown/legacy';
      modelDistribution[model] = (modelDistribution[model] || 0) + 1;

      // 검사 1: 본문 누락 또는 극단적으로 짧은 지문 (100자 미만)
      if (!content || content.trim().length === 0) {
        reasons.push('본문 내용(content)이 비어 있음');
      } else if (content.trim().length < 100) {
        reasons.push(`지문 길이가 너무 짧음 (${content.trim().length}자 < 최소 100자)`);
      }

      // 검사 2: 본문 내 불필요한 괄호 속 영단어/외래어 혼입 검사 (예: '(study)', '(happiness)' 등)
      // 한국어 몰입 읽기 앱 특성상 본문에 괄호 번역이 있으면 단어 팝업 사전의 효용성을 해침
      const englishBracketMatch = content.match(/\([a-zA-Z\s,.'"-]{2,}\)/g);
      if (englishBracketMatch && englishBracketMatch.length > 0) {
        reasons.push(`본문에 괄호 영단어 번역이 혼입됨: ${englishBracketMatch.slice(0, 3).join(', ')}`);
      }

      // 검사 3: 핵심 단어장(keyVocabulary) 누락
      if (!article.keyVocabulary || article.keyVocabulary.length === 0) {
        reasons.push('핵심 어휘 목록(keyVocabulary)이 비어 있음');
      }

      // 검사 4: 제목 누락
      if (!article.title || article.title.trim().length === 0) {
        reasons.push('아티클 제목(title)이 비어 있음');
      }

      if (reasons.length > 0) {
        qualityIssues.push({
          id: article.id,
          title: article.title || '(제목 없음)',
          level: article.level || 'UNKNOWN',
          reasons,
          snippet: content.substring(0, 80).replace(/\n/g, ' ') + '...',
          createdAt: article.createdAt?.seconds
            ? new Date(article.createdAt.seconds * 1000).toISOString()
            : undefined
        });
      }
    }
  } catch (err: any) {
    console.error('[System Audit] Firestore getAllArticles failed:', err);
    dbError = err?.message || String(err);
  }

  const averageLength = articles.length > 0 
    ? Math.round(totalCharacters / articles.length) 
    : 0;

  // ═══════════════════════════════════════════════════
  // 2. 구글 애드센스 법적 및 핵심 서비스 페이지 가용성 헬스체크
  // ═══════════════════════════════════════════════════
  const corePages = [
    { path: '/', isLegal: false },
    { path: '/about', isLegal: true },      // 서비스 소개 (애드센스 필수)
    { path: '/privacy', isLegal: true },    // 개인정보처리방침 (애드센스 필수)
    { path: '/terms', isLegal: true },      // 이용약관 (애드센스 필수)
    { path: '/library', isLegal: false },   // 메인 학습 도서관
    { path: '/test', isLegal: false },      // 레벨 테스트
    { path: '/sitemap.xml', isLegal: true },// 검색엔진 사이트맵
    { path: '/robots.txt', isLegal: true }, // 검색 크롤러 규약
  ];

  const pageHealthResults: PageHealthItem[] = [];

  for (const page of corePages) {
    const targetUrl = `${origin}${page.path}`;
    const pingStart = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Koreading-System-Audit/1.0' },
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      pageHealthResults.push({
        path: page.path,
        url: targetUrl,
        status: res.status,
        ok: res.ok,
        latencyMs: Date.now() - pingStart,
        isLegalRequired: page.isLegal,
      });
    } catch (err: any) {
      pageHealthResults.push({
        path: page.path,
        url: targetUrl,
        status: 0,
        ok: false,
        latencyMs: Date.now() - pingStart,
        isLegalRequired: page.isLegal,
        error: err?.message || String(err)
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // 3. 구글 검색 색인(SEO) 및 동적 사이트맵 세부 점검
  // ═══════════════════════════════════════════════════
  let sitemapCheck = {
    ok: false,
    totalListedUrls: 0,
    dynamicArticleUrls: 0,
    status: 'UNKNOWN' as 'HEALTHY' | 'PARTIAL' | 'FAILED',
    message: ''
  };

  try {
    const sitemapRes = await fetch(`${origin}/sitemap.xml`, { cache: 'no-store' });
    if (sitemapRes.ok) {
      const xmlText = await sitemapRes.text();
      const locMatches = xmlText.match(/<loc>(.*?)<\/loc>/g) || [];
      const readMatches = locMatches.filter(loc => loc.includes('/read/'));

      sitemapCheck = {
        ok: true,
        totalListedUrls: locMatches.length,
        dynamicArticleUrls: readMatches.length,
        status: readMatches.length > 0 ? 'HEALTHY' : 'PARTIAL',
        message: readMatches.length > 0
          ? `동적 사이트맵 정상 가동 중 (전체 ${locMatches.length}개 URL, 개별 독해 아티클 ${readMatches.length}개 포함)`
          : `사이트맵에 정적 페이지만 포함됨 (동적 아티클 0개 감지)`
      };
    } else {
      sitemapCheck = {
        ok: false,
        totalListedUrls: 0,
        dynamicArticleUrls: 0,
        status: 'FAILED',
        message: `sitemap.xml 응답 실패 (HTTP ${sitemapRes.status})`
      };
    }
  } catch (err: any) {
    sitemapCheck = {
      ok: false,
      totalListedUrls: 0,
      dynamicArticleUrls: 0,
      status: 'FAILED',
      message: `sitemap.xml 검사 중 예외 발생: ${err?.message || String(err)}`
    };
  }

  // ═══════════════════════════════════════════════════
  // 4. Firestore 쿼터 및 캐시 지표 평가
  // ═══════════════════════════════════════════════════
  const freeDailyReads = 50000;
  const estimatedReadsPerLibraryVisit = Math.max(articles.length, 1);
  const maxSafeDailyVisits = Math.floor(freeDailyReads / estimatedReadsPerLibraryVisit);

  const quotaReport = {
    isEstimate: true,
    note: 'Based on article count only; this is not live usage, billing, or search index data.',
    totalArticles: articles.length,
    totalCharacters,
    averageLengthChars: averageLength,
    estimatedReadsPerVisit: estimatedReadsPerLibraryVisit,
    firebaseFreeTierLimitDaily: freeDailyReads,
    maxEstimatedDailyVisitsFreeTier: maxSafeDailyVisits,
    status: articles.length > 500 ? 'ATTENTION_NEEDED' : 'HEALTHY',
    recommendation: articles.length > 500
      ? '아티클 수가 500개를 초과할 경우 도서관 목록에 페이지네이션(limit/startAfter)을 적용하여 읽기 쿼터를 절약하세요.'
      : '현재 도서관 규모는 Firebase 무료 쿼터(Spark Plan 50,000 Reads/Day) 내에서 매우 여유롭게 운영 가능합니다.'
  };

  // ═══════════════════════════════════════════════════
  // 5. 종합 판정 및 권고사항 생성
  // ═══════════════════════════════════════════════════
  const failedPages = pageHealthResults.filter(p => !p.ok);
  const failedLegalPages = failedPages.filter(p => p.isLegalRequired);

  let overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  const recommendations: string[] = [];

  if (dbError || failedLegalPages.length > 0) {
    overallStatus = 'CRITICAL';
    if (dbError) recommendations.push(`🚨 Firestore 연결 오류: ${dbError}`);
    if (failedLegalPages.length > 0) {
      recommendations.push(`🚨 구글 애드센스 심사 필수 페이지 오류: ${failedLegalPages.map(p => p.path).join(', ')} (200 OK 미반환)`);
    }
  } else if (failedPages.length > 0 || qualityIssues.length > 5 || sitemapCheck.status !== 'HEALTHY') {
    overallStatus = 'WARNING';
    if (failedPages.length > 0) {
      recommendations.push(`일부 페이지 응답 실패: ${failedPages.map(p => p.path).join(', ')}`);
    }
    if (qualityIssues.length > 0) {
      recommendations.push(`품질 점검 필요 아티클이 ${qualityIssues.length}건 발견되었습니다. 관리자 모드에서 정제 또는 삭제를 권장합니다.`);
    }
    if (sitemapCheck.status !== 'HEALTHY') {
      recommendations.push(`사이트맵 동적 색인 상태: ${sitemapCheck.message}`);
    }
  } else {
    recommendations.push('모든 법적 페이지 및 핵심 서비스가 200 OK로 정상 운영 중입니다.');
    recommendations.push('동적 사이트맵이 구글 색인용 독해 URL을 완벽하게 서빙하고 있습니다.');
    recommendations.push('도서관 아티클의 품질 및 Firestore 쿼터가 안전 기준을 충족합니다.');
  }

  const report = {
    service: 'Koreading Weekly System & Quality Audit',
    timestamp: new Date().toISOString(),
    overallStatus,
    executionDurationMs: Date.now() - auditStart,
    articleQualityAudit: {
      totalArticles: articles.length,
      flawedArticlesCount: qualityIssues.length,
      healthyArticlesCount: articles.length - qualityIssues.length,
      levelDistribution,
      modelDistribution,
      averageCharacterLength: averageLength,
      flawedArticles: qualityIssues.slice(0, 20), // 최대 20건 상세 표시
    },
    pageHealthAudit: {
      totalChecked: corePages.length,
      successCount: corePages.length - failedPages.length,
      failedPages: failedPages.map(p => ({ path: p.path, status: p.status, error: p.error })),
      pages: pageHealthResults
    },
    sitemapSeoAudit: sitemapCheck,
    quotaAndStorageAudit: quotaReport,
    recommendations
  };

  console.log(`[Cron: system-audit] Status: ${overallStatus}, Articles: ${articles.length}, Issues: ${qualityIssues.length}, LegalPages: ${failedLegalPages.length === 0 ? 'OK' : 'FAIL'}`);

  return NextResponse.json(report, {
    status: overallStatus === 'CRITICAL' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
