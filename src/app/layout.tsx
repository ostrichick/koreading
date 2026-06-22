import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';

// ─── 사이트 기본 정보 상수 ───
const SITE_URL = 'https://koreading.vercel.app';
const SITE_NAME = 'Koreading';
const SITE_DESCRIPTION =
  'AI 기반 한국어 독해 학습 플랫폼. 자신의 수준에 딱 맞는 한국어 텍스트를 읽고, 모르는 단어를 즉시 사전으로 확인하세요. A1부터 C2까지 CEFR 레벨별 맞춤 콘텐츠를 제공합니다.';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Next.js 루트 레이아웃의 SEO 메타데이터 설정입니다.
 * Open Graph(SNS 공유 미리보기), Twitter Card, JSON-LD 구조화 데이터,
 * robots, keywords 등을 포함하여 Google 검색 노출과 AdSense 심사 통과를 최적화합니다.
 */
export const metadata: Metadata = {
  // ── 기본 메타태그 ──
  title: {
    default: `${SITE_NAME} — AI 기반 한국어 독해 학습`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    '한국어 학습', '한국어 읽기', '한국어 독해', 'Korean reading practice',
    'Korean language learning', 'CEFR Korean', 'AI Korean tutor',
    '한국어 레벨 테스트', '한국어 단어장', 'K-content Korean',
    '한국어 공부', 'learn Korean', 'Korean vocabulary',
  ],
  authors: [{ name: 'Koreading', url: 'mailto:asulchoi@gmail.com' }],
  creator: 'Koreading',
  publisher: 'Koreading',

  // ── 색인 허용 설정 ──
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // ── Canonical URL ──
  alternates: {
    canonical: SITE_URL,
    languages: {
      'ko-KR': SITE_URL,
      'en-US': SITE_URL,
    },
  },

  // ── Open Graph (SNS 공유 미리보기) ──
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    alternateLocale: ['en_US', 'es_ES', 'ja_JP', 'zh_CN'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI 기반 한국어 독해 학습`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Koreading — AI 기반 한국어 독해 학습 플랫폼',
      },
    ],
  },

  // ── Twitter Card ──
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — AI 기반 한국어 독해 학습`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
    creator: '@koreading',
  },

  // ── 파비콘 / 아이콘 ──
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },

  // ── 앱 매니페스트 ──
  manifest: '/manifest.json',

  // ── Google/Naver 사이트 소유자 확인 ──
  verification: {
    google: 'OkxKUjbjTQN9m5i-fGojaL6G_Jstcow-L2hnUwok6vs',
    other: {
      'naver-site-verification': '843a1eeed07286ead68bb0fe8f99ae66978e1d71',
    },
  },
};

/**
 * JSON-LD 구조화 데이터 — Google 리치 스니펫(검색 결과 강화) 및 SEO 가중치 향상용입니다.
 * WebSite 타입과 EducationalApplication 타입으로 이중 선언하여 학습 앱 특화 노출을 노립니다.
 */
const jsonLdWebsite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  author: {
    '@type': 'Organization',
    name: 'Koreading',
    email: 'asulchoi@gmail.com',
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/library`,
    'query-input': 'required name=search_term_string',
  },
};

const jsonLdApp = {
  '@context': 'https://schema.org',
  '@type': 'EducationalApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  educationalUse: 'Language Learning',
  teaches: 'Korean Language',
  inLanguage: ['ko', 'en', 'es', 'ja', 'zh'],
  author: {
    '@type': 'Organization',
    name: 'Koreading',
    email: 'asulchoi@gmail.com',
  },
};

// ── 루트 레이아웃 컴포넌트 ──
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* JSON-LD 구조화 데이터 — SEO 리치 스니펫 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }}
        />
        {/* Google AdSense 코드 삽입 위치 (심사 통과 후 아래 주석을 실제 코드로 교체하세요) */}
        {/* <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=YOUR_ADSENSE_PUBLISHER_ID" crossOrigin="anonymous" /> */}
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* 모든 페이지에서 구글 로그인 세션을 공유할 수 있도록 AuthProvider를 최상위에 씌웁니다. */}
        <AuthProvider>
          {/* 상단 공통 내비게이션 헤더 */}
          <NavBar />
          {/* 각 개별 페이지별 콘텐츠가 렌더링되는 본문 영역 */}
          <main className="page-wrapper" style={{ flex: 1 }}>
            {children}
          </main>
          {/* 하단 공통 푸터 (Privacy Policy, Terms, About 링크 포함) */}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
