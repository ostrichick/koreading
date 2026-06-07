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
│   │   ├── Footer.tsx           # [AdSense] 하단 공통 푸터 (Privacy/Terms/About 링크)
│   │   └── NavBar.tsx           # 상단 내비게이션 바 컴포넌트
│   ├── contexts/
│   │   └── AuthContext.tsx      # Firebase 사용자 인증 및 DB 프로필 상태 통합 관리
│   └── lib/
│       ├── db.ts                # Firestore 데이터베이스 CRUD 함수 정의
│       ├── firebase.ts          # Firebase Client SDK 초기화 (Auth, Firestore)
│       ├── gemini.ts            # Gemini API 기본 설정, 상수(주제, 레벨), 타입 정의
│       ├── storage.ts           # 로컬 스토리지 헬퍼 (게스트 유저 모국어/레벨 캐싱)
│       └── utils.ts             # 공통 유틸리티 (한글 토크나이저, 한글 판단 함수)
├── .env.local                   # 로컬 개발용 환경변수 (API Key, Firebase 설정 - Git 제외)
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
| db.ts | Firestore DB와 상호작용하는 모든 비즈니스 로직이 포함된 모듈입니다. getAllArticles로 일괄 조회를 최적화(읽기 횟수 약 83% 절감)합니다. |
| gemini.ts | CEFR 등급(A1~C2), 모국어 목록(en/es/ja/zh), 8대 학습 주제 등 상수와 타입 정의, AI 기사 생성 API 호출 헬퍼를 포함합니다. |
| storage.ts | 비로그인 게스트 사용자용 브라우저 로컬 저장소(localStorage) 이용한 선호 언어 및 레벨 임시 저장 유틸입니다. |
| utils.ts | 문장 단어 분리 토크나이저(tokenizeKorean) 및 한글 식별 기능(isKoreanWord)을 포함한 독해 공통 유틸리티 모듈입니다. |

### 2. `src/contexts/` & `src/components/` - 공통 모듈

| 파일명 | 기능 및 역할 |
| :--- | :--- |
| AuthContext.tsx | Firebase Auth 로그인 상태를 기반으로 Firestore users 컬렉션에서 프로필 데이터를 조회하여 전역에 공급합니다. 회원가입 시 중복 Firestore 쿼리를 방지하도록 최적화되어 있습니다. |
| NavBar.tsx | 전역 상단 내비게이션 바로, 로그인/게스트/비로그인 상태에 따라 메뉴 항목을 동적 분기합니다. About 링크는 항상 표시됩니다. |
| Footer.tsx | [AdSense 필수] 사이트 하단 공통 푸터입니다. 개인정보처리방침, 이용약관, About 링크를 항상 노출하여 Google AdSense 심사 기준을 충족하고 사이트 신뢰성을 높입니다. |
| AlertModal.tsx | 직접 구현된 모달 팝업입니다. 단순 경고 외에, AI 생성 과정의 상세 동작 로그 목록(_logs)을 터미널 뷰 형태로 제공합니다. |

### 3. `src/app/` - 페이지 컴포넌트

| 파일명/경로 | 기능 및 역할 |
| :--- | :--- |
| layout.tsx | [SEO 핵심] Open Graph, Twitter Card, JSON-LD 구조화 데이터(WebSite + EducationalApplication), keywords, robots, canonical URL 등 전체 SEO 메타데이터를 담당합니다. Footer 컴포넌트를 삽입하여 모든 페이지에 법적 링크가 표시됩니다. |
| sitemap.ts | [SEO] Next.js 내장 기능으로 /sitemap.xml을 자동 생성합니다. 모든 공개 페이지 경로와 우선순위를 담아 구글/빙 등 검색엔진에 제공합니다. |
| about/page.tsx | [AdSense 필수] 서비스 목적/미션, 주요 6가지 기능, 기술 스택, 개발자(Munseong Choi) 정보를 소개하는 About 페이지입니다. |
| privacy/page.tsx | [AdSense 필수] 개인정보처리방침 페이지. Firebase, Gemini, Groq, Vercel, AdSense 사용 사실을 모두 명시하고 사용자 권리 행사 방법을 안내합니다. |
| terms/page.tsx | [AdSense 필수] 이용약관 페이지. AI 생성 콘텐츠 면책 조항, 광고 게재 고지, 금지 행위, 준거법 등을 포함합니다. |
| page.tsx (Landing) | Koreading 홈(랜딩) 페이지입니다. 직관적인 서비스 소개 카드, 레벨 테스트 바로가기, FAQ 아코디언 등이 포함되어 있습니다. |
| login/page.tsx | 구글 OAuth 간편 로그인 수단만을 노출하는 카드형 로그인/회원가입 관문 페이지입니다. |
| profile/page.tsx | 사용자 마이페이지입니다. 닉네임 수정, 모국어 설정 변경, 가입 일자 조회, 계정 삭제(회원 탈퇴) 프로세스를 지원합니다. |
| test/page.tsx | 10개의 독해 평가 문항을 순서대로 푸는 레벨 테스트 페이지입니다. 사용자의 제출 답안을 채점하여 권장 CEFR 수준을 자동 도출하고 프로필에 반영합니다. |
| vocabulary/page.tsx | 저장된 단어들을 한곳에 모아 보여주는 페이지입니다. 단어 발음 표기, 품사, 사전적 한글 정의, 선택 모국어 번역본을 카드 리스트 형태로 확인하고 삭제할 수 있습니다. |
| library/page.tsx | 핵심 학습 페이지입니다. 아티클을 등급별/주제별로 필터링하고 정렬(별점순/최신순)합니다. AI 기사 생성 모달, 개인 Gemini API Key 관리 기능(🔑 버튼)이 포함됩니다. |
| read/[id]/page.tsx | 회원 전용 독해 페이지입니다. 단어를 터치하여 미니 팝업 사전(단어 뜻, 번역, 문법 구조 분석, 예문 제공)을 띄웁니다. 단어장 추가, 다 읽음 표시, 기사 삭제 기능을 제공합니다. |
| read/guest/page.tsx | 비로그인 게스트 전용 독해 페이지입니다. 단어 및 아티클 캐시를 브라우저 세션 스토리지(sessionStorage)에 보관하여 휘발성 세션으로 운영됩니다. |

### 4. `src/app/api/` - 서버사이드 AI 라우트

| 파일명/경로 | 기능 및 역할 |
| :--- | :--- |
| api/ai/route.ts | 백엔드 AI 추론 코어입니다. action에 따라 1) generateArticle: 난이도별 한글 기사 생성, 2) lookupWord: 미니 팝업 사전용 단어 분석, 3) generateTest: 레벨 테스트 지문/질문 생성을 조율합니다. Groq(1순위) 및 Gemini 5개 모델 계단식 폴백 네트워크로 안정성을 극대화합니다. |

---

## 운영자 정보

- **개발자:** Munseong Choi
- **이메일:** asulchoi@gmail.com
- **서비스 도메인:** https://koreading.vercel.app

---

## 최근 주요 변경 이력

| 날짜 | 변경 내용 |
| :--- | :--- |
| 2026-06-07 | SEO 최적화 및 AdSense 심사 준비: robots.txt, sitemap.ts, about/privacy/terms 페이지, Footer 컴포넌트, layout.tsx 전면 메타데이터 강화 (OG, Twitter Card, JSON-LD) |
| 2026-06-06 | 전체 코드 한국어 주석 작성, utils.ts 신설, db.ts getAllArticles 최적화, AuthContext 최적화 |
