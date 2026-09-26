import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';

// ─── 사이트 기본 정보 상수 ───
const SITE_URL = 'https://koreading.vercel.app';
const SITE_NAME = 'Koreading';

/**
 * 영어 우선, 한국어 병기 형태의 메타 description.
 * 구글은 description 앞부분을 스니펫으로 우선 사용하므로
 * 영어권 사용자와 AI 검색 엔진(GEO) 모두를 타깃합니다.
 */
const SITE_DESCRIPTION =
  'AI-powered Korean reading practice. Generate Korean texts for a selected A1–C2 level, look up words, and save vocabulary. | 선택 수준별 AI 한국어 독해·단어 학습.';

const OG_IMAGE = `${SITE_URL}/logo.png`;

/**
 * Next.js 루트 레이아웃의 SEO 메타데이터 설정입니다.
 * Open Graph(SNS 공유 미리보기), Twitter Card, JSON-LD 구조화 데이터,
 * robots, keywords 등을 포함하여 Google 검색 노출과 AdSense 심사 통과를 최적화합니다.
 * 영어/한국어 병기로 국내외 사용자 및 AI 검색 엔진(GEO)을 동시에 공략합니다.
 */
export const metadata: Metadata = {
  // ── 기본 메타태그 ──
  // 타이틀에 영어 키워드를 포함해 영어권 검색 결과 노출 확보
  title: {
    default: `${SITE_NAME} — Learn Korean Reading with AI | 한국어 독해`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    // 영어권 고볼륨 키워드
    'learn Korean', 'Korean reading practice', 'Korean language learning',
    'learn to read Korean', 'Korean reading comprehension', 'Korean for beginners',
    'TOPIK reading practice', 'free Korean reading exercises', 'Korean study app',
    'read Korean online', 'Korean text practice', 'CEFR Korean',
    'AI Korean tutor', 'Korean vocabulary builder', 'Korean grammar practice',
    // 한국어 키워드
    '한국어 학습', '한국어 읽기', '한국어 독해', '한국어 공부',
    '한국어 단어장', 'K-content Korean',
  ],
  authors: [{ name: 'Koreading', url: 'https://koreading.vercel.app' }],
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

  // ── Open Graph (SNS 공유 미리보기) ──
  // 영어 우선 설정으로 국제 SNS 공유 시 외국인에게 의미 전달
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['ko_KR', 'es_ES', 'ja_JP', 'zh_CN'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Learn Korean Reading with AI`,
    description:
      'AI-powered Korean reading practice with level-selected texts, word lookup, and vocabulary tools.',
    images: [
      {
        url: OG_IMAGE,
        alt: 'Koreading — AI-powered Korean reading practice platform',
      },
    ],
  },

  // ── Twitter Card ──
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} — Learn Korean Reading with AI`,
    description:
      'Practice Korean reading at your level with AI. A1 to C2 texts, instant dictionary, free vocabulary builder.',
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
 * JSON-LD: WebSite 스키마
 * publisher에 Organization을 명시해 구글이 브랜드명을 "Koreading"으로 올바르게 인식하도록 합니다.
 * (도메인이 vercel.app이어도 Koreading 브랜드로 표시되도록 강제)
 */
const jsonLdWebsite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description:
    'AI-powered Korean reading practice with level-selected texts and vocabulary tools.',
  inLanguage: ['ko', 'en'],
  publisher: {
    '@type': 'Organization',
    name: 'Koreading',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
  },
};

/**
 * JSON-LD: EducationalApplication 스키마
 * 학습 앱 특화 리치 스니펫과 AI 검색 엔진(GEO) 인식을 위한 구조화 데이터입니다.
 */
const jsonLdApp = {
  '@context': 'https://schema.org',
  '@type': 'EducationalApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description:
    'AI-powered Korean reading practice platform. Personalized texts for CEFR levels A1 to C2, instant word lookup, and a built-in vocabulary notebook.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  educationalUse: 'Language Learning',
  teaches: 'Korean Language',
  educationalLevel: 'Beginner, Intermediate, Advanced',
  audience: {
    '@type': 'EducationalAudience',
    educationalRole: 'student',
    audienceType: 'Korean language learners worldwide',
  },
  inLanguage: ['ko', 'en', 'es', 'ja', 'zh'],
  publisher: {
    '@type': 'Organization',
    name: 'Koreading',
    url: SITE_URL,
  },
};

// ── 루트 레이아웃 컴포넌트 ──
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* JSON-LD 구조화 데이터 — SEO 리치 스니펫 & GEO 최적화 */}
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
