import { writeReview } from './reviewStore';
import { removeAccount } from './deleteAccount';
import { auth } from './firebase';
import type { User } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  runTransaction,
  writeBatch,
  type FieldValue,
} from 'firebase/firestore';
import { db } from './firebase';
import { isAdminEmail } from './adminConfig';
import type { CEFRLevel, NativeLanguage } from './gemini';
import { articleSchema } from './schemas';
import { approvedImageUrls } from './articlePublishing';
import { nextReviewIntervalDays, type QuizBreakdown } from './learning';

// Firestore의 'users' 컬렉션에 매핑되는 사용자 프로필 데이터 인터페이스
export interface UserProfile {
  uid: string;                 // Firebase Auth 사용자 고유 식별값
  email: string;               // 이메일 주소
  displayName: string;         // 표시 이름
  photoURL: string;            // 프로필 사진 URL
  nativeLanguage: NativeLanguage; // 사용자의 모국어 (영어/스페인어/일본어/중국어)
  level: CEFRLevel | null;     // 사용자의 한국어 학습 레벨 (A1 ~ C2)
  weeklyReadingGoal?: number;  // 월~일 기준 주간 완독 목표(1~7)
  createdAt: Timestamp;        // 회원 가입 일시
}

// Firestore의 'articles' 컬렉션에 매핑되는 독해 지문(아티클) 데이터 인터페이스
export interface Article {
  id: string;                  // 아티클 고유 식별 ID
  title: string;               // 아티클 한글 제목
  content: string;             // 아티클 본문 내용
  summaries?: Partial<Record<NativeLanguage, string>>;
  summaryLanguage?: NativeLanguage;
  summary: string;             // 아티클 모국어 번역 요약본
  topicCategory: string;       // 아티클의 주제 분류 (예: fairy-tales, history)
  level: CEFRLevel;            // 아티클이 타겟팅하는 한국어 레벨 (CEFR)
  estimatedMinutes: number;    // 예상 독해 소요 시간 (분)
  keyVocabulary: string[];     // 아티클 핵심 단어 리스트
  createdAt: Timestamp;        // 생성 일시
  averageRating?: number;      // 아티클의 평균 별점 (리뷰 집계용)
  ratingCount?: number;        // 아티클에 등록된 총 리뷰 수
  ratingSum?: number;          // 아티클의 별점 합계 (리뷰 집계용)
  lastReviewId?: string;       // 최근 신규 리뷰의 공개 랜덤 문서 ID
  generatorModel?: string;     // 해당 아티클을 생성하는 데 사용된 AI 모델 명칭
  hookQuote?: string;          // 지문 속 가장 흥미진진한 핵심 한 줄 대사/인용구 (에디토리얼 카드용)
  discussionPrompt?: string;   // 독서 후 생각해볼 거리 / 질문 / 다음 선택지
  continuationChoices?: string[]; // 다음 전개를 고르는 두 개의 선택지
  writingPrompt?: string;        // 독해 후 학습자가 직접 써 보는 레벨별 출력 과제
  comprehensionQuiz?: ComprehensionQuestion[]; // 독해 완료 후 확인하는 3문항 학습 퀴즈
  genre?: string;              // 글의 장르 (essay, dialogue, story, kakaotalk, mystery, review 등)
  seriesId?: string;           // 연재 묶음 ID (개인 선택과 분리된 공개 메타데이터)
  seriesTitle?: string;        // 연재 제목
  episodeNumber?: number;      // 1부터 시작하는 회차
  previousEpisodeId?: string;  // 바로 이전 회차 문서 ID
  imageUrls?: string[];        // AI가 생성한 맞춤형 삽화 URL 목록 ([0]: 커버 대표 삽화, [1]: 본문 중간 삽화)
  imagePrompts?: string[];     // 삽화 생성에 사용된 영문 프롬프트 (재생성 및 alt 태그용)
  grammarEvidence?: { pattern: string; quote: string }[]; // 생성 시 확인한 목표 문법과 실제 본문 근거
}

// 아티클 리뷰 데이터 인터페이스 (각 아티클 하위의 'reviews' 서브컬렉션)
export interface Review {
  schemaVersion?: 2;            // 신규 공개 리뷰와 레거시 UID 리뷰를 구분하는 비민감 마커
  userId?: string;              // 레거시 UID 기반 리뷰에만 존재할 수 있음
  id?: string;                 // 리뷰 식별 ID
  rating: number;              // 평점 (별점 1 ~ 5)
  pros: string;                // 긍정적인 평가 의견
  cons: string;                // 부정적인 평가 혹은 아쉬운 부분 의견
  userDisplayName: string;     // 작성자 표시 이름
  createdAt?: Timestamp;       // 작성 일시
}

// 유저 개인 단어 데이터 인터페이스 (각 유저 하위의 'vocabulary' 서브컬렉션)
export interface VocabularyEntry {
  id: string;                  // 저장된 단어의 고유 식별 ID
  word: string;                // 한국어 단어 원문
  pronunciation: string;       // 로마자 또는 발음 표기법
  definition: string;          // 한국어 의미 (기본)
  translation: string;         // 모국어로 번역된 뜻
  partOfSpeech: string;        // 품사 (명사, 동사 등)
  examples: { korean: string; translation: string }[]; // 한국어 예문과 모국어 번역 예문 쌍
  level: string;               // 해당 단어의 추천 학습 레벨
  topic: string;               // 기사 주제 카테고리
  articleTitle: string;        // 단어가 속했던 아티클 제목 (출처 표시용)
  savedAt: Timestamp;          // 단어 저장 일시
  sourceArticleId?: string;    // 원문 아티클 ID (게스트 임시 글은 없음)
  sourceSentence?: string;     // 단어를 저장할 때 실제로 읽던 문장/문단
  sourceWord?: string;         // 원문에서 클릭한 활용형
  reviewIntervalDays?: number; // 다음 복습 간격(레거시 단어는 미설정)
  successCount?: number;
  failureCount?: number;
  lastReviewedAt?: Timestamp;
  nextReviewAt?: Timestamp;
}

/**
 * 신규 가입 유저를 저장하거나 기존 유저의 프로필을 업데이트하는 함수입니다.
 * merge: true 설정을 적용하여 전달되지 않은 기존 필드는 유지하면서 특정 필드만 부분 갱신합니다.
 */
export async function createOrUpdateUser(uid: string, data: Omit<Partial<UserProfile>, 'createdAt'> & { createdAt?: Timestamp | FieldValue }) {
  if (data.weeklyReadingGoal !== undefined && (!Number.isInteger(data.weeklyReadingGoal) || data.weeklyReadingGoal < 1 || data.weeklyReadingGoal > 7)) {
    throw new Error('Weekly reading goal must be an integer from 1 to 7');
  }
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * 유저 UID를 바탕으로 Firestore에서 유저 프로필 정보를 조회합니다.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ uid, ...snap.data() } as UserProfile) : null;
}

/** Validated article fields only: never persist API logs or caller-supplied aggregate values. */
function articleFields(article: object) {
  const { imageUrls, ...content } = article as { imageUrls?: unknown };
  const parsed = articleSchema.parse(content);
  const images = approvedImageUrls(imageUrls);
  return { ...parsed, ...(images.length ? { imageUrls: images } : {}) };
}

export interface ComprehensionQuestion {
  kind: 'main' | 'detail' | 'vocabulary';
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  paragraphIndex: number;
}

export type DifficultyFeedback = 'easy' | 'just-right' | 'hard';

export interface ArticleProgress {
  level?: CEFRLevel;
  topicCategory?: string;
  grammarTags?: string[];
  startedAt?: Timestamp;
  lastOpenedAt?: Timestamp;
  completedAt?: Timestamp;
  readingSeconds?: number;
  lastQuizScore?: number;
  lastQuizTotal?: number;
  lastQuizBreakdown?: QuizBreakdown;
  difficultyFeedback?: DifficultyFeedback;
  seriesChoiceIndex?: number;
  updatedAt?: Timestamp;
}

/** A generated article is a private, persistent draft until an administrator publishes it. */
export async function saveArticle(article: Omit<Article, 'id' | 'createdAt'>) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to save a private draft');
  const ref = collection(db, 'users', uid, 'drafts');
  const docRef = await addDoc(ref, {
    ...articleFields(article),
    averageRating: 0,
    ratingCount: 0,
    ratingSum: 0,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/** Private drafts are not returned by the public library API or indexed by search engines. */
export async function getDraftArticles(uid: string): Promise<Article[]> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the draft owner');
  const snapshot = await getDocs(collection(db, 'users', uid, 'drafts'));
  return snapshot.docs.map(d => ({ ...d.data(), id: d.id, imageUrls: approvedImageUrls(d.data().imageUrls) } as Article))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/** Publication is an explicit administrator action, never an automatic user draft write. */
export async function publishDraft(draftId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !isAdminEmail(user.email)) throw new Error('Administrator sign-in required');
  const draft = doc(db, 'users', user.uid, 'drafts', draftId);
  const published = doc(db, 'articles', draftId);
  await runTransaction(db, async tx => {
    const [source, existing] = await Promise.all([tx.get(draft), tx.get(published)]);
    if (!source.exists()) throw new Error('Draft no longer exists');
    if (existing.exists()) throw new Error('Article ID already published');
    tx.set(published, {
      ...articleFields(source.data()),
      averageRating: 0,
      ratingCount: 0,
      ratingSum: 0,
      createdAt: serverTimestamp()
    });
    tx.delete(draft);
  });
  return draftId;
}

/**
 * 특정 아티클 ID에 대응되는 아티클 상세 정보를 조회합니다.
 */
export async function getArticleById(id: string): Promise<Article | null> {
  const ref = doc(db, 'articles', id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ ...snap.data(), id, imageUrls: approvedImageUrls(snap.data().imageUrls) } as Article) : null;
}

/**
 * 사용자가 아티클 읽기를 완료했을 때, 해당 아티클을 읽었다는 흔적을 
 * 유저 문서 하위의 'readArticles' 서브컬렉션에 아티클 ID를 키값으로 삼아 타임스탬프와 함께 저장합니다.
 */
export async function markArticleRead(uid: string, articleId: string) {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the learner');
  await startArticleProgress(uid, articleId);
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'readArticles', articleId), { readAt: serverTimestamp() });
  batch.set(doc(db, 'users', uid, 'articleProgress', articleId), {
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

/** Create the private learning-progress record once, then refresh only its last-opened time. */
export async function startArticleProgress(
  uid: string,
  articleId: string,
  metadata?: { level?: CEFRLevel; topicCategory?: string; grammarTags?: string[] },
): Promise<void> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the learner');
  const ref = doc(db, 'users', uid, 'articleProgress', articleId);
  await runTransaction(db, async tx => {
    const existing = await tx.get(ref);
    tx.set(ref, {
      ...(existing.exists() && existing.data().startedAt ? {} : { startedAt: serverTimestamp() }),
      ...(metadata?.level ? { level: metadata.level } : {}),
      ...(metadata?.topicCategory ? { topicCategory: metadata.topicCategory } : {}),
      ...(metadata?.grammarTags?.length ? { grammarTags: metadata.grammarTags.slice(0, 3) } : {}),
      lastOpenedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export async function getArticleProgress(uid: string, articleId: string): Promise<ArticleProgress | null> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the learner');
  const snap = await getDoc(doc(db, 'users', uid, 'articleProgress', articleId));
  return snap.exists() ? (snap.data() as ArticleProgress) : null;
}

export async function getArticleProgressList(uid: string): Promise<(ArticleProgress & { articleId: string })[]> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the learner');
  const snapshot = await getDocs(collection(db, 'users', uid, 'articleProgress'));
  return snapshot.docs.map(item => ({ articleId: item.id, ...item.data() } as ArticleProgress & { articleId: string }))
    .sort((a, b) => (b.lastOpenedAt?.toMillis() || 0) - (a.lastOpenedAt?.toMillis() || 0));
}

/** Persist every quiz submission privately so later personalization can use real recall history. */
export async function saveQuizAttempt(uid: string, articleId: string, answers: number[], score: number, breakdown?: QuizBreakdown): Promise<void> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the learner');
  if (answers.length !== 3 || answers.some(answer => !Number.isInteger(answer) || answer < 0 || answer > 3)) {
    throw new Error('Invalid quiz answers');
  }
  if (!Number.isInteger(score) || score < 0 || score > answers.length) throw new Error('Invalid quiz score');
  const attempt = doc(collection(db, 'users', uid, 'quizAttempts'));
  const progress = doc(db, 'users', uid, 'articleProgress', articleId);
  const batch = writeBatch(db);
  batch.set(attempt, {
    articleId,
    answers,
    score,
    total: answers.length,
    ...(breakdown ? { breakdown } : {}),
    submittedAt: serverTimestamp(),
  });
  batch.set(progress, {
    lastQuizScore: score,
    lastQuizTotal: answers.length,
    ...(breakdown ? { lastQuizBreakdown: breakdown } : {}),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

export async function saveDifficultyFeedback(uid: string, articleId: string, feedback: DifficultyFeedback): Promise<void> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the learner');
  if (!['easy', 'just-right', 'hard'].includes(feedback)) throw new Error('Invalid difficulty feedback');
  await setDoc(doc(db, 'users', uid, 'articleProgress', articleId), {
    difficultyFeedback: feedback,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function saveSeriesChoice(uid: string, articleId: string, choiceIndex: number): Promise<void> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the learner');
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 1) throw new Error('Invalid series choice');
  await setDoc(doc(db, 'users', uid, 'articleProgress', articleId), {
    seriesChoiceIndex: choiceIndex,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * 사용자가 지금까지 읽은 아티클의 ID 목록을 배열 형태로 조회합니다.
 */
export async function getReadArticles(uid: string): Promise<string[]> {
  const ref = collection(db, 'users', uid, 'readArticles');
  const snap = await getDocs(ref);
  return snap.docs.map(d => d.id);
}

export interface ReadArticleRecord {
  articleId: string;
  readAt: Timestamp | null;
}

/**
 * 사용자가 지금까지 읽은 아티클의 ID 목록과 읽은 시점(readAt)을 함께 조회합니다.
 */
export async function getReadArticlesWithDates(uid: string): Promise<ReadArticleRecord[]> {
  const ref = collection(db, 'users', uid, 'readArticles');
  const snap = await getDocs(ref);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      articleId: d.id,
      readAt: data.readAt || null
    };
  });
}

/**
 * 사용자가 새로 저장한 단어(VocabularyEntry)를 유저 문서 하위의 'vocabulary' 서브컬렉션에 추가합니다.
 */
export async function saveVocabulary(uid: string, entry: Omit<VocabularyEntry, 'id' | 'savedAt'>) {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the vocabulary owner');
  const ref = collection(db, 'users', uid, 'vocabulary');
  const docRef = await addDoc(ref, {
    ...entry,
    reviewIntervalDays: entry.reviewIntervalDays ?? 0,
    successCount: entry.successCount ?? 0,
    failureCount: entry.failureCount ?? 0,
    savedAt: serverTimestamp(),
    nextReviewAt: entry.nextReviewAt ?? serverTimestamp(),
  });
  return docRef.id;
}

/**
 * 유저의 개인 단어장에 등록된 모든 단어들을 가져와, 저장 일시(savedAt) 기준 최신순으로 내림차순 정렬하여 반환합니다.
 */
export async function getVocabulary(uid: string): Promise<VocabularyEntry[]> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the vocabulary owner');
  const ref = collection(db, 'users', uid, 'vocabulary');
  const q = query(ref, orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VocabularyEntry));
}

export interface VocabularyReviewResult {
  reviewIntervalDays: number;
  successCount: number;
  failureCount: number;
  nextReviewAt: Timestamp;
}

/** Grade one private vocabulary review and move its next due date using the bounded SRS schedule. */
export async function reviewVocabulary(uid: string, entryId: string, remembered: boolean): Promise<VocabularyReviewResult> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the vocabulary owner');
  const ref = doc(db, 'users', uid, 'vocabulary', entryId);
  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Vocabulary entry not found');
    const data = snapshot.data() as Partial<VocabularyEntry>;
    const currentInterval = typeof data.reviewIntervalDays === 'number' ? data.reviewIntervalDays : 0;
    const reviewIntervalDays = nextReviewIntervalDays(currentInterval, remembered);
    const successCount = (typeof data.successCount === 'number' ? data.successCount : 0) + (remembered ? 1 : 0);
    const failureCount = (typeof data.failureCount === 'number' ? data.failureCount : 0) + (remembered ? 0 : 1);
    const nextReviewAt = Timestamp.fromMillis(Date.now() + reviewIntervalDays * 24 * 60 * 60 * 1000);
    tx.update(ref, {
      reviewIntervalDays,
      successCount,
      failureCount,
      lastReviewedAt: serverTimestamp(),
      nextReviewAt,
    });
    return { reviewIntervalDays, successCount, failureCount, nextReviewAt };
  });
}

/**
 * 아티클의 하위 서브컬렉션 'reviews'에 사용자의 신규 리뷰를 추가하고,
 * 동시에 상위 아티클 문서의 평점(averageRating)과 리뷰 수(ratingCount) 집계 값을 동적으로 산출하여 병합 업데이트합니다.
 */
export async function saveReview(articleId: string, review: Omit<Review, 'id' | 'createdAt' | 'userId' | 'schemaVersion'>) {
  if (!auth.currentUser) throw new Error('Please sign in to review');
  await writeReview(db, auth.currentUser.uid, auth.currentUser.displayName || 'Learner', articleId, review);
}

/**
 * 특정 아티클에 등록된 모든 리뷰 리스트를 작성일자 기준 최신순으로 조회합니다.
 */
export async function getReviews(articleId: string): Promise<Review[]> {
  const ref = collection(db, 'articles', articleId, 'reviews');
  const q = query(ref, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
}

/**
 * AI가 생성한 한국어 독해 지문 중 품질이 미비하거나 비정상적인 지문을 완전히 영구 삭제합니다.
 * @param id - 삭제할 아티클 Firestore 문서 ID
 * @param callerEmail - 삭제를 요청하는 사용자의 이메일 (관리자 여부 검증에 사용)
 * @throws 사용자가 관리자가 아닰 경우 Error 발생
 */
export async function deleteArticle(id: string, callerEmail: string | null | undefined): Promise<void> {
  // 클라이언트 측 관리자 가드 (천번째 방어선: UI)
  if (!isAdminEmail(callerEmail)) {
    throw new Error('PERMISSION_DENIED: 관리자만 아티클을 삭제할 수 있습니다.');
  }
  const ref = doc(db, 'articles', id);
  await deleteDoc(ref);
}

/**
 * 사용자가 저장한 단어(VocabularyEntry)를 유저 문서 하위의 'vocabulary' 서브컬렉션에서 완전히 삭제합니다.
 */
export async function deleteVocabulary(uid: string, entryId: string): Promise<void> {
  if (auth.currentUser?.uid !== uid) throw new Error('Sign in as the vocabulary owner');
  const ref = doc(db, 'users', uid, 'vocabulary', entryId);
  await deleteDoc(ref);
}

/**
 * 유저가 직접 생성한 커스텀 카테고리(단어장 카테고리) 목록을 가져옵니다.
 * 카테고리 이름 문자열의 배열을 반환합니다.
 */
export async function getCustomCategories(uid: string): Promise<string[]> {
  const ref = collection(db, 'users', uid, 'customCategories');
  const snap = await getDocs(ref);
  return snap.docs.map(d => d.data().name as string);
}

/**
 * 유저 문서 하위에 새로운 커스텀 카테고리를 추가합니다.
 * 중복 검사 후 저장합니다.
 */
export async function addCustomCategory(uid: string, name: string): Promise<void> {
  const categoriesRef = collection(db, 'users', uid, 'customCategories');
  // 중복 확인
  const snap = await getDocs(categoriesRef);
  const exists = snap.docs.some(d => d.data().name === name);
  if (!exists) {
    await addDoc(categoriesRef, { name, createdAt: serverTimestamp() });
  }
}

/**
 * 유저 문서 하위에서 커스텀 카테고리를 삭제합니다.
 */
export async function deleteCustomCategory(uid: string, name: string): Promise<void> {
  const categoriesRef = collection(db, 'users', uid, 'customCategories');
  const q = query(categoriesRef, where('name', '==', name));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'users', uid, 'customCategories', d.id));
  }
}

/**
 * 사용자의 회원 탈퇴를 처리합니다.
 * 안전성을 위해 Firebase Auth 계정을 먼저 삭제한 후 Firestore 문서를 삭제합니다.
 * (Auth 삭제 시 재인증(requires-recent-login) 에러가 발생하더라도 Firestore 데이터가 유실되지 않도록 보장)
 */
export async function deleteUserAccount(user: Pick<User, 'uid' | 'getIdTokenResult' | 'delete'>): Promise<void> {
  await removeAccount(db, user);
}


