# Koreading (코레딩) — AI 협업 표준 문서

> **단일 표준**: 프로젝트에 참여하는 모든 AI 에이전트(Claude Code, Cursor, Copilot, Gemini CLI 등)는 본 파일을 표준 규칙으로 준수합니다.
> 상세 프로젝트 온보딩: [AI_HANDOVER.md](./AI_HANDOVER.md) · 최신 구현/검증 상태: [IMPLEMENTATION.md](./IMPLEMENTATION.md) · 파일별 메타: [project_meta.md](./project_meta.md)

---

## 1. 🥋 Ponytail: The Ladder of Laziness (게으른 시니어 개발자 원칙)
새로운 코드를 작성하기 전, 반드시 다음 6단계 판단 기준을 거칩니다:
1. **YAGNI (정말 필요한가?)**: 당장 요구되지 않은 기능, 확장성, 유틸리티 래퍼는 절대 작성하지 않습니다.
2. **코드베이스 재사용**: 프로젝트 내에 이미 존재하는 함수, 컴포넌트, 패턴을 우선 탐색하고 재활용합니다. 중복 구현을 금지합니다.
3. **표준 라이브러리 / 네이티브 우선**: 외부 패키지 추가나 커스텀 구현 대신 언어 표준 라이브러리와 프레임워크 내장 기능을 최우선 활용합니다.
4. **최소 코드, 최고 효율**: 문제를 해결하는 가장 짧고 명확한 코드를 작성합니다. 불필요한 추상화 계층이나 복잡한 클래스 구조를 지양합니다.
5. **코드 비대화(Bloat) 방지**: 요청받지 않은 주석 낭비, 불필요한 보일러플레이트, 의미 없는 분기를 만들지 않습니다.
6. **안전성과 완성도 유지**: 코드가 간결하다고 해서 보안, 예외 처리(Error Handling), 입력 유효성 검증(Validation)을 생략해서는 안 됩니다.

---

## 2. ⚡ Superpowers: 체계적인 엔지니어링 방법론
감에 의존한 무계획 코딩(Vibe Coding)을 철저히 금지합니다:
1. **선 기획, 후 구현 (Spec & Plan First)**:
   - 2개 이상의 파일이 변경되거나 복잡한 로직을 작성할 때는 반드시 작업 순서(Step-by-step Plan)를 먼저 제시하고 진행합니다.
2. **점진적이고 검증 가능한 변경**:
   - 한 번에 거대한 코드를 쏟아내지 않고, 단위별로 테스트하고 빌드가 깨지지 않는지 확인하며 전진합니다.
3. **TDD 및 검증 규율**:
   - 버그 수정이나 새 기능 구현 시 테스트 가능 여부를 항상 고려하며, 근본 원인(Root Cause)을 해결합니다.

---

## 3. 답변 및 상호작용 스타일
- 군더더기 없는 명확하고 간결한 답변을 제공합니다.
- 기존 프로젝트의 코드 스타일, 네이밍 컨벤션, 들여쓰기를 완벽히 존중합니다.
- 커밋, 푸시, 배포는 사용자가 명시적으로 요청할 때만 수행합니다.

---

## 4. 프로젝트 개요
- **서비스**: 외국인 한국어 학습자를 위한 AI 기반 맞춤형 독해 학습 플랫폼 (CEFR A1~C2, 모국어 en/es/ja/zh, 8대 학습 토픽).
- **스택**: Next.js 16 (App Router) + TypeScript + React 18, Firebase(Firestore/Auth), Google Gemini AI (폴백 체인 포함).
- **배포**: Vercel (`koreading.vercel.app`).

## 5. 필수 검증 명령어
- `npm run lint` — ESLint (flat config `eslint.config.mjs`만 사용, `.eslintrc.json` 없음)
- `npm run typecheck` — TypeScript 검사 (`tsc --noEmit --incremental false`)
- `npm test` — 단위 테스트 (`node --import tsx --test tests/*.test.ts`)
- `npm run test:emulators` — Firestore 에뮬레이터 통합 테스트 (Java 21+ 필요)
- `npm run build` — 프로덕션 빌드 (TypeScript + ESLint 포함 검증)
- 코드 수정 후 반드시 `lint` → `typecheck` → `test` 순으로 검증하고, 병합 전 `build`를 통과시켜야 합니다.

## 6. 프로젝트별 핵심 규칙
- **한글 순수성**: `content`, `title`, `definition` 등 한국어 텍스트 필드에는 한자·외국어·괄호 번역(예: `공부(study)하다`)을 절대 섞지 않습니다.
- **관리자 이메일 동기화**: `src/lib/adminConfig.ts`는 `NEXT_PUBLIC_ADMIN_EMAILS` 환경변수(쉼표 구분)를 읽고 기본 관리자 목록을 폴백으로 포함합니다. `firestore.rules`의 `admin()`에 하드코딩된 이메일과 반드시 동기화 상태를 유지해야 합니다.
- **Firestore 접근**: 클라이언트 코드는 반드시 `src/lib/db.ts`의 래퍼만 경유합니다. 권한·규칙 변경 시 `firestore.rules`와 `adminConfig.ts` 양쪽을 함께 확인합니다.
- **AI API**: `POST /api/ai`는 Node.js Runtime으로 동작합니다. 입력 검증은 `src/lib/schemas.ts`의 zod 스키마 기준입니다.
- **AI 모델 설정**: 기본/폴백/속도 전용 모델 목록은 `src/lib/geminiModels.ts`에서 관리합니다.
- **타입 규율**: `any` 사용을 금지합니다. API 응답은 명시적 인터페이스로 파싱하고, 예외는 `unknown`을 받아 `instanceof Error`로 좁혀서 처리합니다.