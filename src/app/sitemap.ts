/**
 * @file sitemap.ts (app)
 * @description Next.js App Router의 빌트인 동적 사이트맵 생성기입니다.
 * 이 파일은 `/sitemap.xml` 경로로 Google, Bing 등 검색엔진 크롤러가 사이트의 모든 공개 페이지와
 * 도서관의 모든 개별 한국어 읽기 아티클(/read/[id])을 색인(Index)할 수 있도록 동적으로 사이트맵을 자동 생성합니다.
 * 외국인 학습자의 오가닉 검색 유입(SEO) 및 구글 애드센스 심사에 필수적인 핵심 인프라입니다.
 */

import { MetadataRoute } from 'next';
import { publicArticleIndex } from '@/lib/server/publicArticles';
export const revalidate = 3600;

const BASE_URL = 'https://koreading.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. 핵심 정적 서비스 및 법적 필수 페이지 목록
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0, // 최우선순위 — 메인 랜딩 페이지
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9, // 서비스 소개 페이지 — 애드센스 심사에서 높은 가중치
    },
    {
      url: `${BASE_URL}/library`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9, // 핵심 학습 기능 페이지
    },
    {
      url: `${BASE_URL}/test`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8, // 레벨 테스트 페이지
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6, // 개인정보처리방침 — 애드센스 심사 필수
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5, // 이용약관
    },
  ];

  // 2. Firestore DB에서 모든 공개 독해 아티클을 쿼리하여 동적 URL 등록
  try {
    const articles = await publicArticleIndex();
    const articleRoutes: MetadataRoute.Sitemap = articles.map(article => ({
      url: `${BASE_URL}/read/${article.id}`,
      lastModified: article.createdAt?.seconds 
        ? new Date(article.createdAt.seconds * 1000) 
        : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8, // 개별 한국어 읽기 자료
    }));

    return [...staticRoutes, ...articleRoutes];
  } catch (err) {
    console.error('Failed to load dynamic articles for sitemap, returning static routes fallback:', err);
    return staticRoutes;
  }
}
