# Koreading — AI Handover & Project Master Context
> **문서 목적**: 이 파일은 ChatGPT, Claude, Cursor 등 다른 AI 모델이나 새로운 개발자가 이 프로젝트의 전체 맥락, 아키텍처, 비즈니스 로직, 작업 히스토리를 한 번에 이해하고 바로 이어서 개발할 수 있도록 작성된 종합 인수인계 문서입니다.

---

## 📌 1. 프로젝트 개요 (Executive Summary)

- **서비스명**: **Koreading (코레딩)**
- **서비스 도메인**: [https://koreading.vercel.app](https://koreading.vercel.app)
- **GitHub 저장소**: `ostrichick/koreading` (Branch: `main`)
- **서비스 목적**: 전 세계 외국인 한국어 학습자를 위한 **AI 기반 맞춤형 한국어 독해 학습 플랫폼**
- **학습 철학**: 언어학자 스티븐 크라센(Stephen Krashen)의 **i+1 입력 가설(Input Hypothesis)**
  - 학습자의 현재 수준보다 살짝 높은 난이도의 진짜 글을 다독하며 모국어처럼 자연스럽게 한국어를 체득하도록 유도.
- **지원 학습자 모국어 (Native Languages)**:
  - 영어 (`en`), 스페인어 (`es`), 일본어 (`ja`), 중국어 (`zh`)
- **지원 CEFR 레벨**:
  - `A1` (입문) · `A2` (초급) · `B1` (중급) · `B2` (중상급) · `C1` (고급) · `C2` (최고급)
- **8대 학습 토픽**:
  - `fairy-tales` (한국 동화), `nature-travel` (자연 & 여행), `k-content` (K-콘텐츠), `history` (역사 이야기), `daily-life` (일상 이야기), `culture` (한국 문화), `news` (쉬운 뉴스), `food` (한국 음식)

---

## 🛠️ 2. 기술 스택 & 인프라 (Tech Stack)

| 계층 | 사용 기술 | 설명 |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 15+ (App Router)** | React 19, Turbopack, TypeScript 기반 |
| **Runtime & Deploy** | **Vercel (Edge Network)** | `/api/ai` 라우트는 **Edge Runtime (`export const runtime = 'edge'`)** 적용으로 콜드 스타트 없음 |
| **Styling** | **Pure CSS (`globals.css`)** | CSS 변수 기반 디자인 시스템 토큰, 다크 모드 테마, 무(無) 라이브러리 경량화 |
| **Authentication** | **Firebase Auth** | Google OAuth 간편 로그인 (팝업 및 모바일 리다이렉트 대응) |
| **Database** | **Cloud Firestore** | NoSQL 문서 데이터베이스 (아티클, 단어장, 읽음 기록, 리뷰, 사용자 프로필) |
| **Main AI Model (창작)** | **Google Gemini 2.5 Flash** | 한국어 어휘력 및 문장 유려도가 가장 뛰어난 고품질 주력 모델 (`temperature: 0.8`) |
| **Speed AI Model (사전)** | **Google Gemini 3.5 Flash Lite** | 800ms대 초고속 응답 속도를 자랑하는 미니 팝업 사전 전용 모델 (`temperature: 0.1`) |
| **Fallback & Alternative**| **Groq Qwen 3.8 27B / Gemini 3.5 Flash** | 구글 쿼터 초과 시 동작하는 Groq 오픈소스 모델 및 최신 플래시 폴백 체인 |
| **Cron & Autonomous Ops** | **Vercel Cron Jobs (3종)** | ① 일일 모델 헬스체크, ② 월간 모델 벤치마크 오딧, ③ 주간 4대 시스템 감사 |
| **Client Storage** | **localStorage & sessionStorage** | 게스트 세션 데이터 및 사전 조회 2단계 영속 캐시 |

---

## 🏗️ 3. 핵심 아키텍처 & 비즈니스 로직 (Core Systems)

### 3.1 맞춤형 글 생성 시스템 (`action === 'generateArticle'`)
- **엔드포인트**: `POST /api/ai`
- **Temperature**: **`0.8`** (사전 검색의 `0.1`과 분리하여 어휘와 서술의 창의성/다양성 극대화)
- **동적 서브토픽 풀 (`src/lib/topicSeeds.ts`)**:
  - 8개 주제마다 10~15개 이상의 구체적이고 트렌디한 세부 소재(총 100종 이상) 구축.
  - 사용자가 키워드를 입력하지 않아도 매번 무작위 세부 소재가 프롬프트에 강제 주입되어 뻔한 글 방지.
- **나만의 키워드 직접 입력 (`customKeyword`)**:
  - 사용자가 원하는 특정 키워드(예: *"뉴진스"*, *"성수동 팝업스토어"*)를 지정하면 최우선 소재로 글 작성.
- **5가지 서술 장르/문체 (`genre`)**:
  - `random` (무작위), `essay` (1인칭 감성 수필/일기), `dialogue` (생생한 구어체 대화문), `column` (매거진 칼럼), `story` (단편 소설/동화).
- **Anti-Cliche 룰 (AI 상투어 원천 금지)**:
  - *"오늘은 ~에 대해 알아보겠습니다"*, *"~는 매우 유명합니다"* 같은 지루한 도입부 절대 금지 → 즉시 현장 묘사/대사로 시작.
  - *"여러분도 꼭 경험해 보세요"* 같은 교훈형 결말 금지 → 자연스러운 여운으로 마무리.
- **중복 방지 (Negative Prompting)**:
  - 도서관의 최근 글 제목 10개를 `recentTitles`로 전달하여 소재/줄거리 겹침을 엄격 차단.
- **100% 순수 한글 제약 (CRITICAL)**:
  - 본문과 제목에는 한자(漢字), 영어, 일본어, 외국어 번역 괄호 표기(예: `공부(study)하다`)가 단 한 글자도 들어가지 않도록 강제.

### 3.2 초고속 인터랙티브 단어 사전 (`lookupWordAll`)
- **통합 병렬 조회**:
  - 기존 2회 순차 호출(Basic 정보 조회 → 대기 → Advanced 문법/예문 조회)을 서버에서 `Promise.all`로 묶어 **단 1회의 왕복(RTT)**으로 반환.
- **모델 우선순위 역전**:
  - 단어 사전 조회 시 무거운 모델 대신 초경량·고속 모델(`Gemini 2.0 Flash Lite` → `1.5 Flash 8B`)을 우선 가동.
- **2단계 캐싱 전략**:
  - 1차: React `useRef` 인메모리 캐시 (0ms 즉시 응답)
  - 2차: `sessionStorage` (`koreading_word_${word}_${lang}`) 영속 캐시 (페이지 이동/재방문 시 0ms 복원)

### 3.3 보안 및 관리자 시스템
- **관리자 계정 (`src/lib/adminConfig.ts`)**:
  - `asulchoi@gmail.com`, `xilencist@gmail.com`
- **3단계 방어 아키텍처**:
  1. **UI Layer**: 관리자 로그인 시에만 아티클 삭제 버튼 노출 + 화면 상단 보라색 관리자 모드 배너/배지 표시.
  2. **Client Business Logic (`db.ts`)**: `deleteArticle(id, callerEmail)` 호출 시 `isAdminEmail()` 사전 검증.
  3. **Database Layer (`firestore.rules`)**: Firebase 서버에서 `request.auth.token.email in ['asulchoi@gmail.com', 'xilencist@gmail.com']` 규칙으로 비인가 삭제를 최종 차단.
- **API 보호**:
  - Content-Type(`application/json`) 강제 검증, action 허용 목록 검증, 입력 파라미터 길이 제한(프롬프트 인젝션 방어), IP 기반 Rate Limiting (분당 20회).

### 3.4 주제 맞춤형 AI 일러스트 시스템 (Pollinations.ai / FLUX.1)
- **비용**: 100% 완전 무료 (오픈소스 FLUX.1/SDXL 기반 CDN 인프라 `image.pollinations.ai` 활용)
- **이중 삽화 구성**:
  1. **대표 커버 배너 (Hero Cover)**: 글 전체의 시간대, 날씨, 전경, 분위기를 담은 16:9 와이드 일러스트 (도서관 카드 썸네일로도 동시 활용)
  2. **문맥 삽화 (In-text Scene)**: 글 중반부의 핵심 행동이나 전환점, 주요 사물을 묘사하는 클로즈업 일러스트
- **프롬프트 파이프라인**:
  - Gemini 2.5 Flash가 글을 쓸 때 본문 내용을 기반으로 영문 `imagePrompts` 2종을 직접 도출.
  - 일러스트 품질 통일 및 외계어 방지: `modern Korean educational storybook illustration, warm lighting, no text, no words, no watermark` 강제 결합.
- **비동기 UX (`ArticleIllustration.tsx`)**:
  - 텍스트가 먼저 2~3초 만에 렌더링되고, 이미지는 브라우저 백그라운드에서 스켈레톤 쉬머 애니메이션과 함께 로딩되어 사용자 대기 시간이 0초.
  - 네트워크 오류 시 레이아웃을 해치지 않고 부드럽게 숨김 처리(Graceful Fallback).

---

## 📂 4. 전체 디렉터리 및 파일 맵

```
Conq/
├── firestore.rules          # [보안] Firestore 데이터베이스 보안 규칙 (관리자 권한, 유저 격리)
├── project_meta.md          # 프로젝트 파일별 한국어 메타 가이드
├── AI_HANDOVER.md           # [본 문서] 타 AI 및 개발자용 온보딩 인수인계 문서
├── public/
│   ├── logo.png             # 서비스 공식 로고
│   ├── robots.txt           # 검색 크롤러 지침
│   ├── manifest.json        # PWA 매니페스트
│   └── google*.html         # 구글 서치 콘솔 소유권 확인 파일
├── src/
│   ├── app/
│   │   ├── api/ai/route.ts       # [코어 백엔드] Edge AI 라우트 (글 생성, 사전, 테스트, 폴백)
│   │   ├── api/cron/check-models/route.ts        # [일일 크론] AI 모델 가용성 자동 헬스체크
│   │   ├── api/cron/monthly-model-audit/route.ts # [월간 크론] 최신 모델 벤치마크 평가 및 Top 3 추천
│   │   ├── api/cron/system-audit/route.ts        # [주간 크론] 도서관 아티클 품질/법적페이지/SEO/쿼터 4대 감사
│   │   ├── about/page.tsx        # [SEO/AdSense] 서비스 소개 및 기능 안내 (영문 중심 서버 컴포넌트)
│   │   ├── privacy/page.tsx      # [법적 필수] 개인정보처리방침
│   │   ├── terms/page.tsx        # [법적 필수] 서비스 이용약관
│   │   ├── library/page.tsx      # [핵심 화면] 도서관 메인 (필터링, 정렬, 맞춤 생성 모달)
│   │   ├── login/page.tsx        # 구글 OAuth 간편 로그인
│   │   ├── profile/page.tsx      # 마이페이지 (레벨/모국어 변경, 회원 탈퇴)
│   │   ├── read/[id]/page.tsx    # [핵심 화면] 회원용 독해 뷰어 (인터랙티브 사전, 오버 검색, 완독)
│   │   ├── read/guest/page.tsx   # 게스트용 독해 뷰어 (세션 스토리지 기반 임시 읽기)
│   │   ├── test/page.tsx         # CEFR 한국어 레벨 진단 테스트 (10문항)
│   │   ├── vocabulary/page.tsx   # 개인 단어장 (카테고리 분류, 오디오 재생, 단어 퀴즈)
│   │   ├── globals.css           # 전역 스타일 및 다크 테마 변수
│   │   ├── layout.tsx            # 루트 레이아웃 (SEO 메타태그, JSON-LD, Footer, SeoTextBlock)
│   │   ├── page.tsx              # 서비스 소개 메인 랜딩 페이지
│   │   └── sitemap.ts            # [SEO 핵심] Firestore 전체 독해 아티클(/read/[id]) 포함 동적 사이트맵 생성기
│   ├── components/
│   │   ├── AlertModal.tsx        # 알림/에러 모달 및 AI 생성 진행 로그 터미널
│   │   ├── ArticleIllustration.tsx # [NEW] 아티클 맞춤 AI 일러스트 (스켈레톤 shimmer, 에러 폴백)
│   │   ├── Footer.tsx            # 공통 푸터 (약관, 개인정보, About 링크)
│   │   ├── NavBar.tsx            # 상단 내비게이션 바 (관리자 모드 감지 배너/배지 포함)
│   │   └── SeoTextBlock.tsx      # 검색엔진 크롤러용 비가시적 다국어 SEO 구조화 텍스트
│   ├── contexts/
│   │   └── AuthContext.tsx       # Firebase Auth 상태 및 Firestore 프로필 전역 Provider
│   └── lib/
│       ├── adminConfig.ts        # 관리자 이메일 목록 및 검증 함수
│       ├── db.ts                 # Firestore CRUD 모듈 (아티클, 단어, 리뷰, 프로필)
│       ├── firebase.ts           # Firebase Client SDK 초기화 (Auth, Firestore)
│       ├── gemini.ts             # 클라이언트 AI 래퍼, CEFR/주제 상수, GenerateArticleOptions
│       ├── storage.ts            # 게스트 로컬 저장소 헬퍼 (모국어/레벨 캐싱)
│       ├── topicSeeds.ts         # [NEW] 8개 주제별 100종 서브토픽 풀 & 5대 장르 서술 지침
│       └── utils.ts              # 한글 토크나이저, 한글 판별, 셔플 유틸리티
```

---

## 📜 5. 주요 작업 히스토리 연표 (Timeline)

| 일자 | 구분 | 주요 구현 및 변경 내역 |
| :--- | :--- | :--- |
| **2026-09-13** | **주제 맞춤 AI 삽화 연동** | - **Pollinations.ai (FLUX.1) 연동**: 글 생성 시 본문의 구체적 사건/배경을 반영한 영문 프롬프트 기반 16:9 고화질 삽화 2종(커버 + 본문 중간) 자동 조합.<br>- **비동기 스켈레톤 뷰어 (`ArticleIllustration.tsx`)**: 텍스트 우선 로딩 후 백그라운드 쉬머 로딩, 오류 시 부드러운 자동 숨김.<br>- **도서관 카드 매거진 뷰**: 도서관 목록 카드 상단에 썸네일 배너 노출. |
| **2026-09-13** | **4대 정기 점검 & SEO 동적 색인** | - **동적 사이트맵 연동**: `sitemap.ts`에 Firestore 공개 아티클 쿼리를 결합하여 `/read/[id]`를 검색엔진에 자동 색인 등록.<br>- **자율 모니터링 크론 3종 구축**: 일일 모델 헬스체크(`/api/cron/check-models`), 월간 모델 벤치마크 오딧(`/api/cron/monthly-model-audit`), 주간 4대 시스템 감사(`/api/cron/system-audit`).<br>- **폐기 모델 복구**: 가동 중단된 레거시 모델을 `gemini-2.5-flash`, `gemini-3.5-flash-lite`, `qwen/qwen3.8-27b`로 완전 교체. |
| **2026-09-13** | **글 생성 고도화** | - **1·2·3단계 통합 구현**: 아티클 생성 temperature `0.8` 상향, 100여 종 서브토픽 풀 신설(`topicSeeds.ts`), AI 상투어 금지 규칙(Anti-Cliche), 5대 장르 셔플, 도서관 최근 글 중복 방지(`recentTitles`), 도서관 모달에 맞춤 키워드 인풋 및 장르 칩 UI 연동. |
| **2026-07-07** | **관리자 UI 강화** | - `xilencist@gmail.com` 관리자 권한 추가, 관리자 로그인 시 상단 보라색 그라디언트 배너, 로고 배지, 아바타 테두리, 드롭다운 테두리 등 4단 비주얼 인디케이터 적용. |
| **2026-07-06** | **보안 전수 감사** | - 아티클 삭제 권한 검증 3중 방어선 구축, 게스트 페이지 삭제 기능 완전 제거, `firestore.rules` 보안 규칙 파일 신설, `/api/ai` 요청 유효성 검증 강화. |
| **2026-06-30** | **팝업 속도 5배 최적화** | - `/api/ai` 라우트에 **Edge Runtime** 적용 (콜드 스타트 제거).<br>- `lookupWordAll` 서버사이드 `Promise.all` 병렬 처리로 RTT 단축.<br>- `sessionStorage` 2단계 영속 캐시 적용으로 재방문 단어 0ms 표시.<br>- 단어 조회 시 경량 모델(`Gemini 2.0 Flash Lite`) 최우선 배치. |
| **2026-06-30** | **글로벌 SEO 개선** | - 구글 검색 결과 영문 노출을 위해 NavBar 메뉴 영문화 (Library, Vocabulary 등).<br>- `SeoTextBlock.tsx` 서버 컴포넌트 신설 (JS 비활성 크롤러용 영문/다국어 텍스트).<br>- `about/page.tsx` 영문 중심 서버 컴포넌트로 전면 재작성. |
| **2026-06-08** | **PWA 지원** | - 모바일 웹 앱 설치를 위한 `manifest.json`, 서비스 워커 연동. |
| **2026-06-07** | **사전 Lemma 변환** | - 텍스트 내 활용형(예: '유명합니다') 클릭 시 기본형(원형/lemma: '유명하다')을 도출하여 단어장에 원형으로 저장되도록 AI 프롬프트 개편. |

---

## 🤖 6. 다른 AI를 위한 개발 가이드라인 (Instructions for Next AI)

1. **AI 프롬프트 작성 시 규칙**:
   - 한국어 텍스트 생성 필드(`content`, `title`, `definition`, `structure` 등)에는 **절대 외국어나 한자(漢字)를 섞지 말 것**. 100% 순수 한글만 출력되도록 시스템 지침을 엄격히 유지해야 합니다.
   - 단어 사전 조회(`lookupWord`)는 사실성과 정확성이 생명이므로 `temperature: 0.1`을 유지하고, 아티클 창작(`generateArticle`)은 창의성과 문체 다양성을 위해 `temperature: 0.8`을 유지하십시오.
2. **Edge Runtime 주의사항**:
   - `src/app/api/ai/route.ts`는 Vercel Edge Runtime에서 구동됩니다. Node.js 전용 내장 모듈(`fs`, `child_process`, `path` 등)을 import하지 마십시오.
3. **Firestore 수정 시 주의사항**:
   - 클라이언트에서 Firestore를 직접 호출할 때 `db.ts`의 래퍼 함수를 반드시 경유하십시오.
   - 권한 변경 시 `firestore.rules`와 `adminConfig.ts` 양쪽을 모두 확인하십시오.
4. **빌드 검증 명령어**:
   - 코드 수정 후에는 반드시 `npm run build`를 실행하여 TypeScript 컴파일 에러나 린트 에러가 없는지 검증하십시오.
