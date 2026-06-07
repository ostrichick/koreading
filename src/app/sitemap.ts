/**
 * @file sitemap.ts (app)
 * @description Next.js App Router의 빌트인 사이트맵 생성기입니다.
 * 이 파일은 `/sitemap.xml` 경로로 Google 및 기타 검색엔진이 사이트의 모든 공개 페이지를 색인할 수 있도록 사이트맵을 자동 생성합니다.
 * 애드센스 심사 및 검색 노출(SEO) 향상에 필수입니다.
 */

import { MetadataRoute } from 'next';

// 사이트의 실제 도메인 주소 (배포 후 정확한 도메인으로 변경 필요)
const BASE_URL = 'https://koreading.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
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
}
