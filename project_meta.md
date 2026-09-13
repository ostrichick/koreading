# Koreading - Project Metadata Guide

이 파일은 **코레딩(Koreading)** 프로젝트의 전체 디렉터리 구조와 각 파일의 역할 및 기능을 한국어로 설명해 주는 메타 문서입니다.
이후 새로운 기능 추가, 파일 신설/삭제 등 프로젝트 구조가 변경되는 요청을 수행할 때마다 **이 파일의 내용도 함께 최신 상태로 업데이트**되어야 합니다.

---

## 전체 디렉터리 구조 (Directory Tree)

```
Conq/
├── public/
│   ├── logo.png            # 서비스 공식 로고 이미지
│   └── robots.txt          # [SEO] 검색 크롤러 접근 지침 및 sitemap.xml 경로 안내
├── src/
│   ├── app/                # Next.js App Router 페이지 및 API 라우트
│   │   ├── api/ai/
│   │   │   └── route.ts         # AI 처리 라우트 (기사 생성, 단어 분석, 테스트 출제)
│   │   ├── api/cron/check-models/
│   │   │   └── route.ts         # [Cron] 하루 1회 AI 모델 가용성 자동 점검 헬스체크 라우트
│   │   ├── api/cron/monthly-model-audit/
│   │   │   └── route.ts         # [Cron] 매월 1일 최신 모델 벤치마크 평가 및 Top 3 추천 스케줄러
│   │   ├── api/cron/system-audit/
│   │   │   └── route.ts         # [Cron] 주간 4대 시스템 감사 (아티클 품질 전수검사, 법적페이지 가용성, SEO 동적 색인, 쿼터 진단)
│   │   ├── about/
│   │   │   └── page.tsx         # [AdSense 필수] 서비스 소개 / 개발자 정보 / 기술 스택
│   │   ├── privacy/
│   │   │   └── page.tsx         # [AdSense 필수] 개인정보처리방침 (법적 필수 문서)
│   │   ├── terms/
│   │   │   └── page.tsx         # [AdSense 필수] 이용약관 (법적 필수 문서)
│   │   ├── library/page.tsx     # 도서관 메인 화면 (목록 조회, 필터, AI 기사 생성 모달)
│   │   ├── login/page.tsx       # 로그인 화면 (Google 간편 로그인 연동)
│   │   ├── profile/page.tsx     # 프로필 및 개인 설정 화면 (모국어/레벨 설정, 계정 탈퇴)
│   │   ├── read/[id]/page.tsx   # 회원용 본문 읽기 화면 (단어 클릭 사전, 다 읽음, 기사 삭제)
│   │   ├── read/guest/page.tsx  # 비회원 게스트용 임시 본문 읽기 화면
│   │   ├── test/page.tsx        # 레벨 테스트 화면 (10문항 독해 평가 및 추천 레벨 진단)
│   │   ├── vocabulary/page.tsx  # 개인 단어장 화면 (저장 단어 조회, 재생음, 삭제 기능)
│   │   ├── sitemap.ts           # [SEO] /sitemap.xml 자동 생성기 (Next.js 내장)
│   │   ├── globals.css          # 전역 스타일시트 (디자인 시스템 컬러 토큰, 다크 모드 테마)
│   │   ├── layout.tsx           # 루트 레이아웃 (OG/Twitter/JSON-LD 메타태그 + Footer)
│   │   └── page.tsx             # 서비스 랜딩(소개) 페이지
│   ├── components/
│   │   ├── AlertModal.tsx       # 알림/에러 메시지 + AI 생성 로그 표시 모달
│   │   ├── ArticleIllustration.tsx # [NEW] 아티클 주제 맞춤 AI 일러스트 컴포넌트 (스켈레톤 shimmer, 에러 폴백)
│   │   ├── Footer.tsx           # [AdSense] 하단 공통 푸터 (Privacy/Terms/About 링크)
│   │   ├── NavBar.tsx           # 상단 내비게이션 바 컴포넌트
│   │   └── SeoTextBlock.tsx     # [SEO] 검색 엔진 크롤러용 영문 구조화 텍스트 블록
│   ├── contexts/
│   │   └── AuthContext.tsx      # Firebase 사용자 인증 및 DB 프로필 상태 통합 관리
│   └── lib/
│       ├── adminConfig.ts       # 관리자 계정 이메일 목록 및 관리자 권한 검증 유틸
│       ├── db.ts                # Firestore 데이터베이스 CRUD 함수 정의
│       ├── firebase.ts          # Firebase Client SDK 초기화 (Auth, Firestore)
│       ├── gemini.ts            # Gemini API 기본 설정, 상수(주제, 레벨), 타입 정의
│       ├── koreanCurriculum.ts  # [NEW] 국립국어원 표준 CEFR 교육과정 커리큘럼 & 교재형 시각보조자료 디렉터
│       ├── storage.ts           # 로컬 스토리지 헬퍼 (게스트 유저 모국어/레벨 캐싱)
│       ├── topicSeeds.ts        # [NEW] 8대 주제별 100종 서브토픽 풀 & 5대 장르 서술 지침
│       └── utils.ts             # 공통 유틸리티 (한글 토크나이저, 한글 판단, Fisher-Yates 셔플)
├── AI_HANDOVER.md               # [AI 온보딩] ChatGPT/Claude용 프로젝트 마스터 컨텍스트 가이드
├── firestore.rules              # [보안] Firestore 데이터베이스 보안 규칙 (관리자 권한, 유저 격리)
├── .env.local                   # 로컬 개발용 환경변수 (API Key, Firebase 설정 - Git 제외)
├── .env.local.example           # 환경변수 템플릿 가이드 (GROQ_API_KEY 포함)
├── .eslintrc.json               # ESLint 린터 설정 (next/core-web-vitals)
├── next.config.js               # Next.js 프레임워크 설정
├── package.json                 # 의존성 라이브러리 및 실행 스크립트 정의
├── tsconfig.json                # TypeScript 빌드/컴파일 옵션 설정
└── vercel.json                  # Vercel 배포 라우팅 설정
```

---

## 파일별 역할 상세 설명

### 1. `src/lib/` - 핵심 인프라 및 라이브러리

| 파일명 | 기능 및 역할 |
| :--- | :--- |
| firebase.ts | Firebase SDK Auth 및 Firestore 인스턴스를 초기화하여 내보냅니다. |
| adminConfig.ts | 운영 관리자 계정 이메일 목록(ADMIN_EMAILS) 및 관리자 권한 검증(isAdminEmail) 헬퍼를 제공합니다. |
| db.ts | Firestore DB와 상호작용하는 모든 비즈니스 로직이 포함된 모듈입니다. 트랜잭션을 통한 리뷰 평점 동시성 보장 및 계정 탈퇴/삭제를 처리합니다. |
| gemini.ts | CEFR 등급(A1~C2), 모국어 목록(en/es/ja/zh), 8대 학습 주제 등 상수와 타입 정의, AI 기사 생성 API 호출 헬퍼를 포함합니다. |
| koreanCurriculum.ts | [NEW] 국립국어원 한국어 표준 교육과정 및 국제 통용 한국어 교육과정(CEFR A1~C2)에 입각하여 레벨별 목표 문법 목록, 어휘 재활용(Vocabulary Recycling: 5대 핵심 단어 본문 내 2회 이상 반복) 규칙, 문장 호흡 및 교재형 시각 보조자료(Visual Aid: 상황도 및 어휘 클로즈업 도해) 디렉팅을 공급하는 KFL 전문 교육 커리큘럼 모듈입니다. |
| storage.ts | 비로그인 게스트 사용자용 브라우저 로컬 저장소(localStorage) 이용한 선호 언어 및 레벨 임시 저장 유틸입니다. |
| topicSeeds.ts | [NEW] 8대 학습 토픽별 100종 이상의 동적 서브토픽 풀과 5가지 글 스타일/장르(수필, 대화, 칼럼, 스토리, 무작위) 가이드라인을 정의하는 모듈입니다. |
| utils.ts | 문장 단어 분리 토크나이저(tokenizeKorean), 한글 식별 기능(isKoreanWord), Fisher-Yates 배열 셔플(shuffleArray)을 포함한 공통 유틸리티 모듈입니다. |

### 2. `src/contexts/` & `src/components/` - 공통 모듈

| 파일명 | 기능 및 역할 |
| :--- | :--- |
| AuthContext.tsx | Firebase Auth 로그인 상태를 기반으로 Firestore users 컬렉션에서 프로필 데이터를 조회하여 전역에 공급합니다. 예외 처리(try/catch/finally)를 통해 로그인 상태 무한 로딩을 방지합니다. |
| NavBar.tsx | 전역 상단 내비게이션 바로, 로그인/게스트/비로그인 상태에 따라 메뉴 항목을 동적 분기합니다. SSR 하이드레이션 불일치 방지 로직이 적용되어 있습니다. |
| Footer.tsx | [AdSense 필수] 사이트 하단 공통 푸터입니다. 개인정보처리방침, 이용약관, About 링크를 항상 노출하여 Google AdSense 심사 기준을 충족하고 사이트 신뢰성을 높입니다. (이벤트 핸들러 적용으로 'use client' 선언) |
| AlertModal.tsx | 직접 구현된 모달 팝업입니다. 단순 경고 외에, AI 생성 과정의 상세 동작 로그 목록(_logs)을 터미널 뷰 형태로 제공합니다. |
| ArticleIllustration.tsx | [NEW] 아티클 주제 맞춤형 AI 일러스트 컴포넌트입니다. Pollinations.ai (FLUX.1) 비동기 로딩, 쉬머 스켈레톤 애니메이션, 로드 실패 시 에러 숨김(Graceful Fallback), 16:9 배너 비율 및 AI 삽화 배지를 제공합니다. |
| SeoTextBlock.tsx | [SEO] 구글 봇 크롤러가 JS 없이도 읽을 수 있도록 최적화된 영문 구조화 텍스트 블록입니다. aria-hidden="true"가 적용되어 스크린 리더에 지장을 주지 않습니다. |

### 3. `src/app/` - 페이지 컴포넌트

| 파일명/경로 | 기능 및 역할 |
| :--- | :--- |
| layout.tsx | [SEO 핵심] Open Graph, Twitter Card, JSON-LD 구조화 데이터(WebSite + EducationalApplication), keywords, robots, canonical URL 등 전체 SEO 메타데이터를 담당합니다. Footer 컴포넌트를 삽입하여 모든 페이지에 법적 링크가 표시됩니다. |
| sitemap.ts | [SEO 핵심] Next.js 내장 기능으로 /sitemap.xml을 비동기 자동 생성합니다. 정적 서비스/법적 페이지 7개뿐만 아니라 Firestore에서 모든 공개 독해 아티클(/read/[id])을 동적으로 쿼리하여 구글 및 글로벌 검색엔진에 자동 색인합니다. |
| about/page.tsx | [AdSense 필수] 서비스 목적/미션, 주요 6가지 기능, 기술 스택, 개발자(Munseong Choi) 정보를 소개하는 About 페이지입니다. |
| privacy/page.tsx | [AdSense 필수] 개인정보처리방침 페이지. Firebase, Gemini, Groq, Vercel, AdSense 사용 사실을 모두 명시하고 사용자 권리 행사 방법을 안내합니다. |
| terms/page.tsx | [AdSense 필수] 이용약관 페이지. AI 생성 콘텐츠 면책 조항, 광고 게재 고지, 금지 행위, 준거법 등을 포함합니다. |
| page.tsx (Landing) | Koreading 홈(랜딩) 페이지입니다. 직관적인 서비스 소개 카드, 레벨 테스트 바로가기, FAQ 아코디언 등이 포함되어 있습니다. (랜딩 페이지로 무조건 가도록 리다이렉션 로직이 삭제되었습니다.) |
| login/page.tsx | 구글 OAuth 간편 로그인 수단만을 노출하는 카드형 로그인/회원가입 관문 페이지입니다. |
| profile/page.tsx | 사용자 마이페이지입니다. 닉네임 수정, 모국어 설정 변경, 가입 일자 조회, 계정 삭제(회원 탈퇴) 프로세스를 지원합니다. |
| test/page.tsx | 10개의 독해 평가 문항을 순서대로 푸는 레벨 테스트 페이지입니다. 사용자의 제출 답안을 채점하여 권장 CEFR 수준을 자동 도출하고 프로필에 반영합니다. |
| vocabulary/page.tsx | 저장된 단어들을 한곳에 모아 보여주는 페이지입니다. 단어 발음 표기, 품사, 사전적 한글 정의, 선택 모국어 번역본을 카드 리스트 형태로 확인하고 삭제할 수 있습니다. |
| library/page.tsx | 핵심 학습 페이지입니다. 아티클을 등급별/주제별로 필터링하고 정렬(별점순/최신순)합니다. AI 기사 생성 모달, 개인 Gemini API Key 관리 기능(🔑 버튼)이 포함됩니다. |
| read/[id]/page.tsx | 회원 전용 독해 페이지입니다. 단어를 터치하여 미니 팝업 사전(단어 뜻, 번역, 문법 구조 분석, 예문 제공)을 띄웁니다. 단어장 추가, 다 읽음 표시, 기사 삭제 기능을 제공합니다. |
| read/guest/page.tsx | 비로그인 게스트 전용 독해 페이지입니다. 단어 및 아티클 캐시를 브라우저 세션 스토리지(sessionStorage)에 보관하여 휘발성 세션으로 운영됩니다. |

### 4. `src/app/api/` - 백엔드 AI 및 정기 점검 크론 라우트

| 파일명/경로 | 기능 및 역할 |
| :--- | :--- |
| api/ai/route.ts | 백엔드 AI 추론 코어입니다. action에 따라 1) generateArticle: 난이도별 한글 기사 생성, 2) lookupWord: 미니 팝업 사전용 단어 분석, 3) generateTest: 레벨 테스트 지문/질문 생성을 조율합니다. Groq 및 Gemini 2.5 Flash / 3.5 Flash Lite 계단식 폴백 네트워크로 가동됩니다. |
| api/cron/check-models/route.ts | [일일 크론] 매일 00:00 UTC에 설정된 모든 AI 모델(Gemini 2.5 Flash, 3.5 Flash Lite, Groq Qwen 등)의 실제 API 핑을 테스트하여 모델 중단/폐기(Decommission)를 선제적으로 감지하는 헬스체크 라우트입니다. |
| api/cron/monthly-model-audit/route.ts | [월간 크론] 매월 1일 Google 공식 최신 활성 모델 목록을 조회하고, 실제 한국어 작문 벤치마크를 수행하여 글 생성 및 사전 검색용 Top 3 모델을 추천·평가하는 모델 오딧 라우트입니다. |
| api/cron/system-audit/route.ts | [주간 크론] 매주 일요일 00:00 UTC에 실행되는 4대 시스템 정기 감사 라우트입니다. 1) 도서관 아티클 품질 전수 감사(본문 길이 미달, 괄호 영단어 번역 유출 감지), 2) 애드센스 법적/핵심 페이지 200 OK 핑, 3) 구글 검색 색인(SEO) 및 sitemap.xml 동적 독해 URL 수 검증, 4) Firestore 쿼터 및 안전 가용치 진단을 수행합니다. |

---

## 운영자 정보

- **개발자:** Munseong Choi
- **이메일:** asulchoi@gmail.com
- **서비스 도메인:** https://koreading.vercel.app

---

## 최근 주요 변경 이력

| 2026-09-13 | - **글 생성 품질 및 다양성 전면 개편 (1·2·3단계 완료)**<br>• 백엔드 AI 생성 temperature `0.8` 상향 (사전 검색 `0.1` 유지)<br>• 8개 주제별 100종 이상의 동적 서브토픽 풀 신설 (`topicSeeds.ts`)<br>• AI 상투어/클리셰 원천 금지 규칙(Anti-Cliche) 및 100% 순수 한글 제약 강화<br>• 5가지 글 스타일(수필, 대화, 칼럼, 스토리, 무작위) 지원<br>• 도서관 최근 글 제목 10개 기반 중복 방지(Negative Prompting) 연동<br>• 도서관 모달 UI에 맞춤 관심사/키워드 직접 입력창 및 글 스타일 선택 칩 추가<br>- **주제 맞춤형 AI 일러스트 2종 자동 생성 및 뷰어 연동 (Pollinations.ai / FLUX.1)**<br>• 글 생성 시 Gemini가 본문의 배경 및 핵심 사건을 분석한 영문 프롬프트 2종 직접 도출<br>• 100% 무료 무제한 오픈 AI 인프라(Pollinations.ai) 기반 고화질(16:9) 일러스트 URL 조합<br>• `ArticleIllustration.tsx`: 로딩 중 쉬머 스켈레톤, 에러 발생 시 부드러운 자동 숨김(Graceful Fallback)<br>• 독해 뷰어(회원/게스트)에 상단 대표 커버 및 본문 중반 문맥 삽화 배치<br>• 도서관 카드 상단에 썸네일 배너 표출로 매거진 뷰 제공<br>- **4대 정기 점검 및 SEO 사이트맵 동적 색인 자동화 완료**<br>• `sitemap.ts`: Firestore 내 모든 공개 아티클 동적 쿼리 연동 (`/read/[id]` 자동 색인 등록)<br>• `check-models`: 일일 AI 모델 가용성 자동 헬스체크 (`0 0 * * *`)<br>• `monthly-model-audit`: 월간 AI 모델 벤치마크 및 Top 3 추천 스케줄러 (`0 0 1 * *`)<br>• `system-audit`: 주간 도서관 아티클 품질 전수 감사, 애드센스 법적 페이지 200 OK 핑, SEO 색인 검증, Firestore 쿼터 진단 (`0 0 * * 0`)<br>- 타 AI(ChatGPT/Claude) 협업 및 온보딩을 위한 종합 가이드 문서 `AI_HANDOVER.md` 신설 |
| 2026-09-09 | - ESLint 린터 설정(`.eslintrc.json`) 구축 및 Next.js 16 CLI 호환 lint 스크립트 수정 (`npm run lint` 통과)<br>- JSX unescaped entity (`&quot;`, `&apos;`) 오류 및 React hook dependency 경고 전면 해결<br>- Fisher-Yates 무작위 셔플 알고리즘(`shuffleArray`) 유틸 신설 및 어휘 퀴즈/플래시카드 적용<br>- profile 페이지 `<a>` 태그를 `Link` 컴포넌트로 전환하여 클라이언트 네비게이션 최적화<br>- layout.tsx 내 schema.org `SearchAction` 구조화 데이터 표준 스키마 적용 |
| 2026-07-23 | - AI API Route (`/api/ai`) Edge IP 기반 Rate Limiting (분당 20회) 및 파라미터(paragraph, chatHistory) 길이 제한 추가<br>- `saveReview()` Firestore 트랜잭션(`runTransaction`) 적용으로 평점 집계 동시성 충돌 해결<br>- `deleteUserAccount` Auth 선삭제 후 DB 삭제 순서 보장 및 안전 탈퇴 UI 연동<br>- `AuthContext.tsx` onAuthStateChanged 에러 핸들링(`try/catch/finally`)으로 무한 로딩 해결<br>- 랜딩 페이지 중복 푸터 제거 및 일본어 번역 오타(`カスタム`, `ニュアンス`, `保存中`) 수정<br>- `NavBar.tsx` SSR hydration mismatch 방지 로직 적용 및 CSS 토큰 보완 |
| 2026-06-08 | APK 빌드(PWABuilder) 및 PWA 설치를 지원하기 위해 manifest.json 및 sw.js(서비스 워커) 추가, Footer.tsx에 서비스 워커 등록 연동 |
| 2026-06-07 | - SEO 최적화 및 AdSense 심사 준비: robots.txt, sitemap.ts, about/privacy/terms 페이지, Footer 컴포넌트, layout.tsx 전면 메타데이터 강화 (OG, Twitter Card, JSON-LD)<br>- 로고 클릭 시 메인(랜딩) 페이지로 이동을 방해하는 로그인 리다이렉트 로직 제거<br>- Footer 컴포넌트 이벤트 핸들러 오류 수정을 위해 'use client' 추가 및 배포 완료<br>- 단어장에서 단어 저장 시 원래 텍스트의 어형(예: '유명합니다') 대신 사전 검색이 가능한 기본형(원형/lemma, 예: '유명하다')으로 변환하여 저장하는 기능 구현 및 배포 |
| 2026-06-06 | 전체 코드 한국어 주석 작성, utils.ts 신설, db.ts getAllArticles 최적화, AuthContext 최적화 |
