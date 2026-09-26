# Koreading 기술 인수인계

**기준: 2026-09-26 로컬 `main` 소스.** 이 문서는 실제 코드의 구조와 유지보수 지점을 설명합니다. 실행/환경변수는 [README.md](./README.md), 작업 규칙은 [AGENTS.md](./AGENTS.md), 미해결 문제와 최신 검증은 [IMPLEMENTATION.md](./IMPLEMENTATION.md)를 기준으로 합니다. 배포와 운영 DB 상태는 이 로컬 코드만으로 확인되지 않습니다.

## 서비스와 기술

- 서비스: 외국인 한국어 학습자의 독해 연습. 목표 난이도 태그 A1·A2·B1·B2·C1·C2, 번역/모국어 `en`·`es`·`ja`·`zh`, 주제 8종(`src/lib/schemas.ts`, `src/lib/gemini.ts`). 이 태그는 공인 CEFR 평가 결과가 아닙니다.
- 저장소/도메인: `ostrichick/koreading`의 `main`, 코드에 지정된 공개 주소 `https://koreading.vercel.app`. 실제 운영 반영 상태는 별도 확인.
- 스택: Next.js 16 App Router, React 18, TypeScript, CSS, Firebase Auth/Cloud Firestore, Google Gemini SDK, 조건부 Groq 연동, Vercel. 의존성 버전의 기준은 `package.json` 및 `package-lock.json`.
- API `POST /api/ai`와 Cron API는 Node.js Runtime. 공개 글 목록/상세는 서버에서 Firestore REST API를 읽고 클라이언트 학습 데이터는 Firebase SDK로 읽고 씁니다.

## 사용 경로와 데이터 흐름

| 기능 | 실제 흐름 | 제한/주의 |
| --- | --- | --- |
| 공개 도서관 | `/library` → `GET /api/library` → `src/lib/server/publicArticles.ts`; 레벨·주제 필터와 평점/최신 정렬, 페이지당 24개 | 목록은 전체 카드 메타데이터를 60초 캐시하고 앱에서 필터링. 최대 45,000개 항목 순회 경계가 있어 규모 확장 시 검색 인덱스 필요. 텍스트 검색 `q`는 구현되지 않음 |
| 글 생성·게시 | `/library` → `src/lib/gemini.ts` → `POST /api/ai`의 `generateArticle`; 비회원은 세션 임시 글, 회원은 `db.ts:saveArticle`을 통해 본인 소유 `users/{uid}/drafts` 저장. `getDraftArticles`로 다시 열고 검증된 관리자가 `publishDraft` 트랜잭션으로 공개 게시 | 관리자 게시 전 개인 초안은 공개 목록·사이트맵에 나타나지 않음. 기존 공개 글은 그대로 공개 읽기. 앱과 Firestore 규칙의 동시 운영 반영 필요 |
| 공개 읽기 | `/read/[id]` 서버 렌더링 → `ArticleReader`; 비회원 임시 읽기는 `/read/guest` | 정적 HTML에 실제 본문과 개별 canonical 제공. 읽음 체크는 회원이 수동으로 남기며 마지막 스크롤 위치 복원 기능은 없음 |
| 사전 | 단어 클릭 → `useWordLookup` → `lookupWordAll` → `POST /api/ai`; 기본 뜻과 상세 문법/예문을 서버에서 병렬 생성 | HTTP 왕복 1회지만 AI 생성은 두 분기. 기본 뜻 성공·상세 실패 시 기본 정보와 상세 실패 안내를 표시하며, 기본 실패는 오류. 진정한 단계별 스트리밍은 없음. 단어+문맥+언어를 묶어 인메모리 최대 100개/sessionStorage 캐시 |
| 튜터 | 독해 문단 선택 → `TutorPanel` → `POST /api/ai`의 `tutorChat`; 같은 질문을 `hint` → `strong-hint` → `explanation`으로 단계적으로 좁힘 | 힌트 단계는 직접 정답 노출을 피하고 최종 단계에서 설명; 문단·사용자 메시지와 제한된 대화 이력을 전송; 학습 효과나 답변 정확도 자동 채점 없음 |
| 레벨 테스트 | `/api/ai`의 `generateTest`는 A1~C2 각각 2문항 구조 생성; `src/lib/learning.ts`는 단계별 2/2 정답으로 권장 시작 레벨 계산 | `/test` 화면은 현재 접속 즉시 `/library`로 리다이렉트되어 사용자 기능 비활성. 진단 타당성 검증 미실시; 프로필에서 수동 레벨 설정 가능 |
| 계정·학습 기록 | Firebase Google 로그인 → `AuthContext` 프로필 생성/조회 → `db.ts`; 프로필, 단어 SRS, 읽음, `articleProgress`, `quizAttempts`, 비공개 초안, 리뷰 | R1~R6 사용자 학습 상태는 `users/{uid}` 아래 소유자 전용. 연재 선택도 `articleProgress.seriesChoiceIndex`에만 저장. 신규 리뷰는 공개 UID를 쓰지 않고 비공개 `reviewOwnership`으로 소유권을 연결. 탈퇴 시 개인 학습 하위 컬렉션과 소유 리뷰를 정리 |

## AI 모델·콘텐츠·이미지의 현재 동작

- **글:** `src/lib/geminiModels.ts`가 API 모델 목록에서 Flash 계열 가용 모델을 골라 Gemini Lite 중심 우선순위로 시도합니다. `src/app/api/ai/route.ts`의 Gemini 생성 설정은 `temperature: 0.38`; Gemini 체인 실패 시 서버 Groq 키를 사용할 수 있다면 `openai/gpt-oss-120b`를 시도합니다(`temperature: 0.70`). 고정된 주력 모델이나 응답 시간·일일 무료 쿼터는 보장하지 않습니다.
- **사전·테스트·튜터:** 서버 Groq 키가 있고 사용자가 개인 키를 보내지 않은 경우 `qwen/qwen3.8-27b`를 먼저 시도하며, 실패하면 Gemini 사전용 모델 최대 2개를 시도합니다(생성 설정 `temperature: 0.1`). 글 생성은 Gemini 후보 최대 3개와 조건부 Groq 1개를 시도합니다. 사전의 basic+advanced 병렬 조회는 두 분기가 요청당 공통 시도 예산을 사용합니다. 모델 목록은 API 키의 SHA-256 식별값별로 최대 1시간 캐시해 개인 키 사이의 목록 혼용을 방지합니다. 요청당 시도 횟수·출력 토큰·벽시계 시간 제한은 **실제 공급자 청구 비용의 전역 상한이 아닙니다.**
- **교육 프롬프트:** `src/lib/koreanCurriculum.ts`의 문법·길이·핵심 어휘 5개 반복, 이해 가능한 입력 등은 **생성 지침/목표**입니다. `schemas.ts`는 글 길이 최소 80자, 핵심 어휘 1~10개 및 중복 여부, 주요 한국어 필드의 외국 문자 배제, 레벨 테스트 보기 중복을 검사합니다. 어휘 85~90%, 정확히 핵심 어휘 5개, 문법 2~3개, 반복 횟수, 난이도·문항 타당성은 자동 검증·보장하지 않습니다. 길이 기준은 `koreanCurriculum.ts`의 실제 프롬프트 주입값을 확인합니다.
- **소재·장르:** `src/lib/topicSeeds.ts`에 총 76개 고정 세부 소재와 8개 장르 옵션이 있습니다. `recentTitles`는 현재 도서관에 표시된 상위 제목 최대 10개를 프롬프트로 전송하므로 전체 DB의 최근 등록 10건이나 중복 방지를 보증하지 않습니다.
- **이미지:** 글 생성 완료 후 `src/lib/koreanVisuals.ts:getRealKoreanPhoto`가 위키백과 이미지 → 설정 시 Unsplash 검색 → 큐레이션 Unsplash 사진을 선택합니다. 사진 작업에는 본 AI 요청의 종료 신호와 별도 최대 2.5초 제한을 전달하며, 실패하면 텍스트만 반환할 수 있습니다. API 응답의 `imageUrls`는 0~1개이고 본문 중간은 첫 이미지를 재사용할 수 있습니다. `get2DTextbookVectorIllustration`와 `getVisualAidDirectingInstruction`는 정의되어 있지만 글 생성 경로에서 호출되지 않습니다. AI 삽화 2장 자동 생성·본문 즉시 선출력·완전 무료/무제한은 구현되지 않았습니다.
- **진행 표시:** 생성 화면은 실제 응답 전까지 일반적인 요청 진행 상태만 표시합니다. 서버 모델별 `_logs`는 최종 응답 이후 한 번에 전달되므로 실시간 스트리밍이 아닙니다.
- **음성:** 브라우저 Web Speech API 기능과 음성 인식 전사 텍스트 유사도 비교가 일부 독해 UI에 있습니다. 발음의 음운 정확도를 측정하는 검증된 평가 도구는 아닙니다.

## R1~R6 학습 아키텍처

- **R1:** `ComprehensionQuizCard.tsx`, `articleProgress`, `quizAttempts`. 신규 `generatedArticleSchema`는 main/detail/vocabulary 3문항과 유효한 `paragraphIndex`를 요구하고, 레거시 `articleSchema`는 퀴즈를 선택 필드로 둡니다.
- **R2:** `src/lib/learning.ts:nextReviewIntervalDays`, `db.ts:reviewVocabulary`, `/vocabulary`. 단어는 원문 문맥·성공/실패 횟수·다음 복습일을 저장하며 1→3→7→14→30→60→90일 스케줄을 사용합니다.
- **R3:** `deriveLearningProfile`과 `recommendReading`. `getArticleProgressList`가 `lastOpenedAt` 최신순으로 정렬하고 최근 5개만 사용합니다. 개인화는 규칙 기반이고 레벨 이동은 ±1로 제한합니다.
- **R4:** 공개 글에는 `seriesId`, `seriesTitle`, `episodeNumber`, `previousEpisodeId`, `continuationChoices`만 저장합니다. 사용자 선택은 private `seriesChoiceIndex`. `koreading_series_continuation` session context는 다음 생성 요청에만 전달합니다.
- **R5:** `WritingPracticeCard.tsx`는 raw learner writing을 Firestore에 저장하지 않고 `writingFeedback` API 요청에만 사용합니다. `ReaderControls`와 reader pages는 TTS 속도를 `koreading_tts_rate`에 저장하며 쉐도잉은 숨김/수동 복원을 지원합니다. 전사 유사도 UI 명칭은 “음성 인식 문장 일치도”입니다.
- **R6:** `/profile`은 `getReadArticlesWithDates`, `getVocabulary`, `getArticleProgressList`를 조합해 이번 주 읽기·복습·학습일, 최근 이해도, 강점/약점, 약한 문법, 독서 streak와 주간 목표를 계산합니다. 시간 목표는 `readingSeconds`가 신뢰성 있게 채워지지 않아 제공하지 않습니다.

## 권한 및 운영 경계

- `firestore.rules`의 `users/{uid}` 및 하위 학습 컬렉션은 소유자 중심 권한을 사용합니다. 관리자 삭제 권한은 검증된 이메일을 Firestore 규칙이 판단합니다. `NEXT_PUBLIC_ADMIN_EMAILS`는 UI 가드이며 여기에만 관리자 이메일을 추가해도 서버 규칙 권한은 늘지 않습니다.
- R1 학습 루프는 `users/{uid}/articleProgress/{articleId}`와 `users/{uid}/quizAttempts/{attemptId}`에만 사용자 진행도·퀴즈 시도·난이도 피드백을 저장합니다. 다른 회원과 비로그인 사용자는 읽을 수 없고 계정 삭제 시 함께 정리합니다. `articleSchema`는 기존 글 호환을 위해 퀴즈를 선택 필드로 유지하지만, 신규 AI 생성 결과는 `generatedArticleSchema`가 `main`·`detail`·`vocabulary` 세 문항과 실제 본문 문단을 가리키는 `paragraphIndex`를 요구합니다.
- `articles/{id}`는 읽기 공개, 생성은 검증된 관리자만 허용합니다. `firestore.rules`는 공개 게시와 비공개 초안 생성 시 허용 필드·이미지 호스트·서버 생성 시각·평점 초기값을 검사합니다. 클라이언트는 생성 글을 소유자 비공개 초안으로 저장하고 관리자의 명시적 게시만 허용합니다. 운영 배포 여부와 과거 공개 글의 신뢰성은 미확인입니다.
- 신규 리뷰는 `articles/{articleId}/reviews/{opaqueReviewId}` 공개 문서에 별점·의견·표시 이름과 비민감 `schemaVersion: 2`만 저장하고, 계정과의 연결은 소유자만 읽을 수 있는 `users/{uid}/reviewOwnership/{articleId}`의 `{ reviewId }` 매핑으로 분리합니다. 스키마 마커 때문에 임의 문서 ID가 우연히/악의적으로 다른 UID와 같아도 신규 리뷰를 레거시 UID 소유 리뷰로 오인하지 않습니다. 작성·수정·탈퇴 삭제와 글 평점 집계는 Firestore 트랜잭션/규칙에서 함께 검증합니다. 기존 UID 문서 ID 리뷰는 호환 경로로만 처리하며 `userId`가 없더라도 문서 ID가 UID와 정확히 같은 경우 외에는 소유자를 추측하지 않습니다. 탈퇴는 재인증 확인 → 삭제 표식 → 비공개 매핑 리뷰 및 확인 가능한 레거시 리뷰 삭제·평점 재집계 → 개인 하위 데이터 삭제 → 프로필 삭제 → Auth 삭제 순서입니다. **비공개 삭제 표식의 UID는 재시도/쓰기 차단을 위해 남습니다.**
- `/api/ai`는 게스트가 사용할 수 있으며 본문 크기 24KB·Zod 입력 검증·식별 그룹 분당 20회/일 100회·전체 일 1,000회 기본 **HTTP 요청 수** 제한이 있습니다. 실제 Vercel 프리뷰/운영 환경에서는 플랫폼이 덮어쓰는 `X-Forwarded-For`의 유효 IP만 사용하고, 이외 환경/잘못된 값은 동일한 공유 그룹에 넣습니다. 이는 인증이 아니며 사용자 식별도 보장하지 않습니다. 운영/프로덕션 AI API는 Upstash Redis 두 환경변수를 요구하고 누락·장애 시 거부하며, 로컬 개발에서만 인스턴스별 카운터를 허용합니다. `src/lib/aiBudget.ts`는 요청당 공급자 시도 예산(글/테스트/튜터 최대 4회, 병렬 사전 전체 최대 6회), 개별 출력 토큰 상한 및 30초 요청 마감 신호를 제공합니다. 모델 목록·사진에도 신호를 전파하지만 Gemini SDK에서 이미 시작한 요청의 과금·종료를 보장할 수 없습니다. 이것은 청구액 상한이나 공급자 대시보드의 실지출 관측을 대체하지 않습니다. 개인 API 키는 브라우저 `localStorage`에 보관되어 요청 때 서버로 전송되며 운영 로그에는 키·본문·원시 오류를 남기지 않습니다.
- Vercel Cron은 `vercel.json` 기준 매일 모델 점검, 매월 1일 모델 벤치마크, 매주 일요일 시스템 감사(모두 00:00 UTC)입니다. 세 라우트는 `CRON_SECRET`의 정확한 Bearer 값을 요구합니다. Cron의 200 응답이나 콘텐츠 형식 검사만으로 클라이언트 레벨 테스트 작동·교육 정확도·실제 결제 상태를 증명할 수는 없습니다.
- 공개 상세 페이지·사이트맵의 SEO 메타데이터를 유지합니다. 루트 OG 이미지는 실재하는 `/logo.png`를 사용하며 미구현 검색·화면에 없는 FAQ의 구조화 데이터를 제거했습니다. 비활성 레벨 테스트는 사이트맵에서 제외합니다. `public/sw.js`는 네트워크 통과 서비스 워커로 오프라인 읽기 캐시는 제공하지 않습니다.

## 파일 맵: 수정할 때 찾아볼 실제 위치

| 경로 | 역할 |
| --- | --- |
| `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/sitemap.ts` | 랜딩, 전역 SEO/레이아웃, 스타일, 공개 글 동적 사이트맵 |
| `src/app/library/page.tsx`, `src/app/api/library/route.ts`, `src/lib/server/publicArticles.ts` | 도서관 화면, 공개 목록 API, 서버 Firestore REST 조회/캐시 |
| `src/app/read/[id]/page.tsx`, `src/app/read/guest/page.tsx`, `src/components/reader/*` | 공개·임시 독해 및 공유 독해 요소(ArticleReader, ReaderBody, ReaderControls, TutorPanel, EditorialHeroCard, DiscussionPromptCard, ComprehensionQuizCard, KakaoChatView) |
| `src/app/test/page.tsx`, `src/app/vocabulary/page.tsx`, `src/app/profile/page.tsx`, `src/app/login/page.tsx` | 비활성 진단 화면, 단어장, 계정 설정, 로그인 |
| `src/app/about/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` | 서비스·개인정보·약관 공개 페이지(운영 현실과 문구 별도 점검 필요) |
| `src/components/NavBar.tsx`, `Footer.tsx`, `AlertModal.tsx`, `ArticleIllustration.tsx` | 공통 탐색/푸터/알림/이미지. 과거 `SeoTextBlock.tsx`는 존재하나 루트 레이아웃에서 현재 사용하지 않음 |
| `src/contexts/AuthContext.tsx`, `src/lib/firebase.ts`, `src/lib/db.ts` | Firebase 인증 상태 및 클라이언트 데이터 접근 래퍼 |
| `src/lib/reviewStore.ts`, `src/lib/deleteAccount.ts`, `src/lib/adminConfig.ts`, `src/lib/articlePublishing.ts`, `firestore.rules` | 리뷰 원자성/삭제와 평점, 계정 삭제, 관리자 UI 식별, 공개 이미지 허용 호스트, 실제 DB 권한 |
| `src/app/api/ai/route.ts`, `src/lib/gemini.ts`, `src/lib/geminiModels.ts`, `src/lib/schemas.ts`, `src/lib/aiBudget.ts` | AI 요청 처리, 클라이언트 래퍼, 모델 체인/캐시, 입력·응답 형태 검사, 공급자 시도·30초 마감 예산 |
| `src/lib/koreanCurriculum.ts`, `src/lib/topicSeeds.ts`, `src/lib/koreanVisuals.ts` | 교육 프롬프트, 소재·장르, 사진 검색/벡터 유틸 |
| `src/hooks/useWordLookup.ts`, `src/lib/learning.ts`, `src/lib/storage.ts`, `src/lib/utils.ts` | 문맥 사전 상태/캐시, 레벨 추천·요약, 게스트 저장소, 일반 유틸 |
| `src/lib/readJson.ts`, `src/lib/aiQuota.ts`, `src/lib/cronAuth.ts` | 요청 크기 제한, 요청 수 제한, Cron 인증 |
| `src/app/api/cron/` | 세 하위 폴더 `check-models`, `monthly-model-audit`, `system-audit`의 일간·월간·주간 점검 API |
| `tests/*.test.ts`, `tests/security.integration.ts`, `tests/account-deletion.integration.ts`, `tests/reader.spec.ts` | 단위/AI 보호·운영·데이터 감사·리뷰 이관, Firestore 에뮬레이터 보안·탈퇴, Playwright 브라우저 테스트 |
| `scripts/operations.mjs`, `docs/OPERATIONS_RUNBOOK.md` | 운영 설정의 정적 사전 점검, demo 전용 에뮬레이터 export/import 연습과 운영 승인 경계 |
| `scripts/audit-legacy-data.mjs`, `docs/DATA_AUDIT_RUNBOOK.md` | 명시된 로컬 JSON/NDJSON만 읽는 기존 공개 글·리뷰 진단; 어떤 클라우드 데이터도 자동으로 가져오거나 고치지 않음 |
| `scripts/prepare-review-migration.mjs`, `docs/REVIEW_MIGRATION_RUNBOOK.md` | 소유권이 명확한 레거시 리뷰만 READY로 분류해 불투명 공개 ID와 비공개 소유권 매핑 후보를 만드는 오프라인 도구; 실제 DB 쓰기는 하지 않음 |
| `.github/workflows/ci.yml` | GitHub에서 정적/단위/빌드, Chromium, Java 21 Firestore 에뮬레이터 검증을 분리 실행하는 CI 정의; 운영 배포는 수행하지 않음 |
| `package.json`, `eslint.config.mjs`, `playwright.config.ts`, `firebase.json`, `vercel.json`, `.env.local.example` | 실행 명령·린트·테스트·에뮬레이터·Cron·환경변수 템플릿 |
| `public/manifest.json`, `public/sw.js`, `public/robots.txt`, `public/logo.png`, `public/icon-*.png` | PWA 메타/서비스 워커, 로봇 규칙, 로고/아이콘 |

`android-app/`, `design_samples/`, `.next/`, `.verification/` 등은 Git에서 제외되는 로컬 폴더이므로 저장소의 필수 빌드 산출물이나 공개 기능으로 간주하지 않습니다. 파일을 추가·이동할 때는 이 표만 갱신하고 README에 또 다른 트리를 만들지 않습니다.

## 변경 맥락과 기록의 해석

| 시기 | 역사적 작업 내용(당시 기록이며 현재 동작을 보증하지 않음) |
| --- | --- |
| 2026-06 | 사전 기본형 변환, PWA 매니페스트/서비스 워커, 사전 병렬 조회 및 영문 SEO 화면 구성 |
| 2026-07 | 관리자 UI·삭제 가드, 리뷰 트랜잭션, 학습·인증 화면 개선 |
| 2026-09-09~13 | ESLint 및 UI 테마 개편, 교육용 프롬프트·소재/장르·이미지 구현 시도, 세 가지 Cron/동적 사이트맵 추가 |
| 2026-09-14 | 보안·리뷰·탈퇴·읽기 SSR·목록 캐시 통합 개선. 당시의 검증 기록은 `IMPLEMENTATION.md`에 날짜를 명시해 보존 |
| 2026-09-16 | AI/Cron Node.js Runtime 전환, 타입 정리, `AGENTS.md` 기반 협업 지침 통합 |
| 2026-09-21 | 저장소 종합 감사 후 문서 통합, 관리자 공개 게시/비공개 초안, 탈퇴 리뷰 삭제, AI 결과 검증·복구, 핵심 UI와 SEO 정합성 개선. 현재 상태와 검증 결과는 `IMPLEMENTATION.md` 참조 |

과거 변경 내용의 정확한 차이와 커밋은 Git 로그를 확인합니다. 과거의 모델명, 온도, 기능 홍보 문구는 현재 사양으로 재사용하지 않습니다.
