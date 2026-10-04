# Koreading (코레딩)

외국인 한국어 학습자를 위한 AI 기반 독해 연습 웹 앱입니다. 한국어 수준 태그 A1~C2, 모국어 선택 `en`/`es`/`ja`/`zh`, 8개 주제를 지원합니다. 이 등급은 콘텐츠 생성·추천을 위한 설정이며 공인 언어능력 판정이 아닙니다.

**기준:** 2026-09-26 로컬 `main` 소스. 아래 내용은 저장소에 구현된 동작을 설명합니다. Vercel 배포 버전, 운영 Firestore 규칙, API 제공사의 모델 가용성·과금은 별도로 확인해야 합니다.

## 문서 안내

| 문서 | 책임 |
| --- | --- |
| **README.md (현재 문서)** | 프로젝트 진입점, 로컬 실행, 운영 설정과 문서 목차 |
| [AGENTS.md](./AGENTS.md) | AI/개발자 공통 작업 지침과 필수 검증 순서 |
| [AI_HANDOVER.md](./AI_HANDOVER.md) | 현재 아키텍처, 주요 실행 흐름, 실제 파일별 역할, 변경 맥락 |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | 확인된 구현 상태, 미해결 문제, 검증 결과 및 과거 검증 기록 |
| [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md) | 로컬 전용 사전 점검·Firestore 에뮬레이터 백업/복원 연습과 별도 운영 반영 체크리스트 |
| [docs/DATA_AUDIT_RUNBOOK.md](./docs/DATA_AUDIT_RUNBOOK.md) | 승인된 로컬 JSON/NDJSON을 이용한 기존 공개 글·리뷰 읽기 전용 검사 방법과 한계 |
| [docs/REVIEW_MIGRATION_RUNBOOK.md](./docs/REVIEW_MIGRATION_RUNBOOK.md) | 레거시 UID 기반 리뷰를 새 개인정보 보호 모델로 옮기기 전 READY/HOLD 후보를 만드는 오프라인 절차 |

도구 전용 `.clinerules`와 `.continuerules`는 `AGENTS.md`만 참조합니다. 상세 변경 내역은 Git 이력을 기준으로 확인합니다.

## 실제 이용 흐름

- `/library`: 공개 글 조회·레벨/주제 필터·평점/최신 정렬 및 AI 글 생성. 비회원 생성물은 현재 탭의 `sessionStorage`에 임시 저장해 `/read/guest`에서 읽습니다. 로그인 사용자의 새 글은 본인만 볼 수 있는 Firestore `users/{uid}/drafts`에 저장되며 내 비공개 읽기 자료에서 다시 열 수 있습니다. 관리자의 명시적 게시 작업만 공개 `articles`를 생성합니다.
- `/read/[id]`, `/read/guest`: 본문 읽기, 문맥 단어 조회, 문단별 AI 튜터, 3문항 독해 퀴즈, 연재 선택, 쓰기 연습, TTS/쉐도잉을 제공합니다. 신규 AI 글은 핵심·세부·어휘 퀴즈 3문항, 연재 선택지 2개, 레벨별 쓰기 과제를 포함합니다. 튜터는 힌트 → 더 강한 힌트 → 설명 단계로 진행하며, 쉐도잉은 텍스트를 숨긴 뒤 같은 버튼으로 원문을 다시 표시할 수 있습니다. 기존 글처럼 새 학습 필드가 없는 자료도 그대로 읽을 수 있습니다.
- `/vocabulary`: 저장 단어의 원문 문맥을 이용한 간격 반복 복습을 제공합니다. 기본 간격은 1→3→7→14→30→60→90일이고, 틀리면 1일로 돌아갑니다. 오늘 due인 단어를 최대 5개씩 복습하며 레거시 단어는 `nextReviewAt`이 없으면 즉시 복습 대상으로 처리합니다.
- `/profile`: 주간 독서 목표, 이번 주 읽기·복습·학습일, 최근 이해도, 독서 streak, 강점·약점·약한 문법과 다음 행동 CTA를 표시합니다. 개인화는 최근 학습 기록을 이용한 규칙 기반 로직이며 사용자가 설정한 CEFR 레벨에서 최대 한 단계만 조정합니다.
- 공개 리뷰는 별점·의견·표시 이름을 다른 이용자에게 보여주지만, 신규 리뷰의 계정 소유권은 `users/{uid}/reviewOwnership/{articleId}`의 비공개 매핑에만 저장하고 공개 리뷰 문서는 UID와 다른 불투명 ID를 사용합니다. 비민감 `schemaVersion: 2` 마커로 신규 매핑 리뷰와 레거시 UID 리뷰를 명확히 구분하며, 기존 UID 기반 리뷰는 명확한 소유권이 확인되는 경우에만 호환 처리하고 자동 추정 이관하지 않습니다.
- `/test`: 문제 생성 및 답안 처리 코드는 있으나 현재 진입 시 `/library`로 이동하므로 **사용자 기능은 비활성**입니다. 내부 문제 구조는 6단계 × 2문항(최대 12문항)입니다.

AI 생성 글의 외국 문자·중복 어휘, 레벨 테스트의 중복 선택지 등 일부 기계 검사를 추가했습니다. CEFR 적합도, 어휘 90:10 비율, 문법·어휘 반복 및 문항 타당성은 자동 검증이나 실측으로 보장되지 않습니다. 현재 제한과 우선 수정 항목은 [IMPLEMENTATION.md](./IMPLEMENTATION.md)에 기록합니다.

## R1~R6 학습 기능

| 단계 | 현재 구현 |
| --- | --- |
| R1 학습 루프 | 3문항 독해 확인, 정오답·설명, 근거 문단 복귀, 다시 풀기, 난이도 피드백, 비공개 `articleProgress`/`quizAttempts`, 관리자 생성 퀴즈 검수 |
| R2 단어 복습 | 원문 문맥 저장, 1·3·7·14·30·60·90일 SRS, 하루 최대 5개 due queue, 레거시 즉시 복습 |
| R3 개인화 | 최근 5개 학습 기록 기반 이해도·난이도·약점·문법 추적, 설정 레벨 대비 최대 ±1 규칙 기반 조정, 읽은 글 제외 추천 |
| R4 연재·튜터 | 공개 연재 메타데이터 + 비공개 사용자 선택, 다음 회차 생성 context, 힌트 → 강한 힌트 → 설명 단계형 튜터 |
| R5 출력·듣기 | 레벨별 쓰기 prompt, 비영속 AI 쓰기 피드백/재작성, 0.8×·1.0×·1.2× TTS, 쉐도잉, “음성 인식 문장 일치도” 표시 |
| R6 성장 대시보드 | 이번 주 읽기·복습·학습일, 최근 이해도, 독서 streak, 주간 목표, 강점·약점·약한 문법, 다음 학습 CTA |

개인 학습 상태와 사용자 연재 선택은 `users/{uid}` 아래에만 저장합니다. 공개 article 문서에는 개인 UID나 학습 상태를 넣지 않습니다. 쓰기 연습의 raw 문장은 Firestore 학습 기록으로 저장하지 않습니다.

## 로컬 실행

Node.js 및 npm을 설치한 후 다음을 실행합니다.

```bash
npm ci
```

`.env.local.example`을 `.env.local`로 복사하고 사용할 Firebase 클라이언트 설정과 AI 공급자 키를 입력합니다. 실제 비밀키를 Git에 추가하지 마세요. Firebase 프로젝트와 인증/Firestore 설정은 해당 환경에 준비되어 있어야 합니다.

Windows PowerShell에서는 `Copy-Item .env.local.example .env.local`로 템플릿을 복사할 수 있습니다.

```bash
npm run dev
```

기본 개발 서버에서 웹 앱을 확인할 수 있습니다. `npm run build` 후 `npm run start`로 프로덕션 빌드를 로컬 실행할 수 있습니다. 환경변수는 [템플릿](./.env.local.example)과 아래 구분을 참고하세요.

| 설정 | 용도 및 주의 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase 웹 SDK 설정. 실제로 읽는 여섯 변수는 `.env.local.example` 참고 |
| `GEMINI_API_KEY` | 서버의 Gemini 키. 글 생성·AI 동작에 사용 |
| `GROQ_API_KEY` | 선택적 Groq 폴백/우선 시도. 없으면 해당 분기를 건너뜀 |
| `UNSPLASH_ACCESS_KEY` | 선택적 이미지 검색; 없으면 위키백과/큐레이션 사진 경로 사용 |
| `CRON_SECRET` | 세 개의 Cron API용 정확한 `Authorization: Bearer ...` 인증 값 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **배포/프로덕션 AI 요청 시 둘 다 필수.** 하나가 없거나 Redis 장애 시 AI 요청은 503으로 거부. 로컬 개발에서 두 값 모두 없을 때만 인스턴스별 메모리 제한 적용 |
| `AI_DAILY_REQUEST_LIMIT`, `AI_RATE_LIMIT_SALT` | 선택적 전역 HTTP 요청 상한(기본 일 1,000건)과 식별 해시용 값. 요청당 공급자 시도·토큰 제한과는 별개이며 실제 청구액 상한이 아님 |
| 관리자 권한 | Firebase Auth UID와 같은 ID의 `admins/{uid}` Firestore 문서로 판정. 일반 클라이언트 쓰기는 금지되며 Firebase Console/Admin SDK 등 신뢰된 관리 경로에서 프로비저닝 |

개인 Gemini 키를 UI에 입력하면 브라우저 `localStorage`에 저장되어 AI 요청 때 서버로 전송됩니다. 배포 시 공유 제한 구성 및 실제 비용 계측 여부를 확인하세요.

AI 요청 제한에 쓰는 IP는 실제 Vercel 프로덕션/프리뷰 환경에서 플랫폼이 덮어쓰는 `X-Forwarded-For`만 사용합니다([Vercel 공식 요청 헤더 문서](https://vercel.com/docs/headers/request-headers)). 다른 환경이나 유효하지 않은 IP는 모두 동일한 공유 제한 그룹을 사용합니다. 이 값은 인증 정보가 아니며, 프록시 설정과 실제 배포에서 별도로 검증해야 합니다. 전체 요청 30초·작업별 공급자 시도 수 제한은 **실제 비용이나 SDK 백그라운드 작업이 즉시 종료된다는 보장**이 아닙니다.

## 검증 및 배포 전 확인

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:emulators
```

브라우저 테스트는 빌드된 앱을 포트 3013에서 띄우며, Firestore 에뮬레이터 테스트에는 Java 21 이상이 필요합니다. 테스트 실행 시점별 결과와 미검증 항목은 [IMPLEMENTATION.md](./IMPLEMENTATION.md)를 확인하세요.

운영 안전 점검은 `node scripts/operations.mjs preflight`부터 시작합니다. `scripts/operations.mjs`의 백업·복원 명령은 **`demo-koreading` 로컬 에뮬레이터 전용 연습**이며 운영 백업이 아닙니다. 기존 데이터 감사 도구 `node scripts/audit-legacy-data.mjs --input <local.json> --json`과 리뷰 이관 후보 도구 `node scripts/prepare-review-migration.mjs --input <local.json>`도 외부 연결 없이 승인된 입력 파일만 검사합니다. 이관 후보 파일에는 READY 레코드의 UID가 포함되므로 민감 자료로 취급해야 합니다. 세부 안전 조건과 실제 운영 작업의 분리는 각 runbook을 참고하세요.

**배포 전 필수:** 새 앱은 회원 글을 비공개 초안으로 기록하고, 새 리뷰는 공개 UID 대신 비공개 소유권 매핑을 사용하며, 새 `firestore.rules`는 이 두 모델의 원자적 권한 검사를 전제로 합니다. 따라서 앱·Firestore 규칙·기존 데이터 확인을 한 번의 배포 계획으로 묶고 운영 데이터 백업과 에뮬레이터 테스트를 거쳐 반영해야 합니다. `.github/workflows/ci.yml`은 lint·typecheck·unit·build와 Chromium·Firestore 에뮬레이터 회귀 검사를 자동화하지만 실제 GitHub 실행·운영 자격증명·백업을 검증하지 않습니다. `vercel.json`의 Cron 세 개 및 Vercel 환경변수도 확인합니다. 로컬 테스트 통과만으로 운영 배포/규칙 반영이 확인되지는 않습니다. 커밋·푸시·배포는 별도 요청 후 진행합니다.
