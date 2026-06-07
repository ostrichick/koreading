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
} from 'firebase/firestore';
import { db } from './firebase';
import type { CEFRLevel, NativeLanguage } from './gemini';

// Firestore의 'users' 컬렉션에 매핑되는 사용자 프로필 데이터 인터페이스
export interface UserProfile {
  uid: string;                 // Firebase Auth 사용자 고유 식별값
  email: string;               // 이메일 주소
  displayName: string;         // 표시 이름
  photoURL: string;            // 프로필 사진 URL
  nativeLanguage: NativeLanguage; // 사용자의 모국어 (영어/스페인어/일본어/중국어)
  level: CEFRLevel | null;     // 사용자의 한국어 학습 레벨 (A1 ~ C2)
  createdAt: Timestamp;        // 회원 가입 일시
}

// Firestore의 'articles' 컬렉션에 매핑되는 독해 지문(아티클) 데이터 인터페이스
export interface Article {
  id: string;                  // 아티클 고유 식별 ID
  title: string;               // 아티클 한글 제목
  content: string;             // 아티클 본문 내용
  summary: string;             // 아티클 모국어 번역 요약본
  topicCategory: string;       // 아티클의 주제 분류 (예: fairy-tales, history)
  level: CEFRLevel;            // 아티클이 타겟팅하는 한국어 레벨 (CEFR)
  estimatedMinutes: number;    // 예상 독해 소요 시간 (분)
  keyVocabulary: string[];     // 아티클 핵심 단어 리스트
  createdAt: Timestamp;        // 생성 일시
  averageRating?: number;      // 아티클의 평균 별점 (리뷰 집계용)
  ratingCount?: number;        // 아티클에 등록된 총 리뷰 수
  generatorModel?: string;     // 해당 아티클을 생성하는 데 사용된 AI 모델 명칭
}

// 아티클 리뷰 데이터 인터페이스 (각 아티클 하위의 'reviews' 서브컬렉션)
export interface Review {
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
}

/**
 * 신규 가입 유저를 저장하거나 기존 유저의 프로필을 업데이트하는 함수입니다.
 * merge: true 설정을 적용하여 전달되지 않은 기존 필드는 유지하면서 특정 필드만 부분 갱신합니다.
 */
export async function createOrUpdateUser(uid: string, data: Partial<UserProfile>) {
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

/**
 * 생성된 아티클 정보를 Firestore의 'articles' 컬렉션에 새 문서로 추가(저장)합니다.
 * 초기 별점 및 별점 카운트는 0으로 초기화되며 서버 시간 기준 타임스탬프를 부여합니다.
 */
export async function saveArticle(article: Omit<Article, 'id' | 'createdAt'>) {
  const ref = collection(db, 'articles');
  const docRef = await addDoc(ref, {
    ...article,
    averageRating: 0,
    ratingCount: 0,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * 특정 레벨(CEFRLevel)에 해당하는 모든 아티클을 Firestore에서 가져와 최신 생성 시간 순으로 내림차순 정렬하여 반환합니다.
 */
export async function getArticlesByLevel(level: CEFRLevel): Promise<Article[]> {
  const ref = collection(db, 'articles');
  const q = query(ref, where('level', '==', level));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
  return list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/**
 * 특정 아티클 ID에 대응되는 아티클 상세 정보를 조회합니다.
 */
export async function getArticleById(id: string): Promise<Article | null> {
  const ref = doc(db, 'articles', id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id, ...snap.data() } as Article) : null;
}

/**
 * 사용자가 아티클 읽기를 완료했을 때, 해당 아티클을 읽었다는 흔적을 
 * 유저 문서 하위의 'readArticles' 서브컬렉션에 아티클 ID를 키값으로 삼아 타임스탬프와 함께 저장합니다.
 */
export async function markArticleRead(uid: string, articleId: string) {
  const ref = doc(db, 'users', uid, 'readArticles', articleId);
  await setDoc(ref, { readAt: serverTimestamp() });
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
  const ref = collection(db, 'users', uid, 'vocabulary');
  const docRef = await addDoc(ref, { ...entry, savedAt: serverTimestamp() });
  return docRef.id;
}

/**
 * 유저의 개인 단어장에 등록된 모든 단어들을 가져와, 저장 일시(savedAt) 기준 최신순으로 내림차순 정렬하여 반환합니다.
 */
export async function getVocabulary(uid: string): Promise<VocabularyEntry[]> {
  const ref = collection(db, 'users', uid, 'vocabulary');
  const q = query(ref, orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VocabularyEntry));
}

/**
 * 아티클의 하위 서브컬렉션 'reviews'에 사용자의 신규 리뷰를 추가하고,
 * 동시에 상위 아티클 문서의 평점(averageRating)과 리뷰 수(ratingCount) 집계 값을 동적으로 산출하여 병합 업데이트합니다.
 */
export async function saveReview(articleId: string, review: Omit<Review, 'id' | 'createdAt'>) {
  const reviewsRef = collection(db, 'articles', articleId, 'reviews');
  await addDoc(reviewsRef, { ...review, createdAt: serverTimestamp() });

  // 상위 아티클 문서의 리뷰 카운트와 평균 별점을 업데이트합니다.
  const articleRef = doc(db, 'articles', articleId);
  const snap = await getDoc(articleRef);
  if (snap.exists()) {
    const articleData = snap.data();
    const oldCount = articleData.ratingCount || 0;
    const oldAverage = articleData.averageRating || 0;
    const newCount = oldCount + 1;
    const newAverage = (oldAverage * oldCount + review.rating) / newCount;
    
    await setDoc(articleRef, {
      ratingCount: newCount,
      averageRating: Number(newAverage.toFixed(1)),
    }, { merge: true });
  }
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
 * Firestore의 'articles' 컬렉션에 등록된 모든 아티클 목록을 최신 생성 시간 순으로 내림차순 정렬하여 반환합니다.
 * 도서관 전체 조회 필터 선택 시 단 한 번의 쿼리로 전체 데이터를 로드하기 위해 사용됩니다.
 */
export async function getAllArticles(): Promise<Article[]> {
  const ref = collection(db, 'articles');
  const snap = await getDocs(ref);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
  return list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/**
 * AI가 생성한 한국어 독해 지문 중 품질이 미비하거나 비정상적인 지문을 완전히 영구 삭제합니다.
 * 주로 테스트 모드 및 아티클 조회 화면 하단에서 사용자가 품질 저하 텍스트 영구 삭제를 요청할 때 구동됩니다.
 */
export async function deleteArticle(id: string): Promise<void> {
  const ref = doc(db, 'articles', id);
  await deleteDoc(ref);
}

/**
 * 사용자가 저장한 단어(VocabularyEntry)를 유저 문서 하위의 'vocabulary' 서브컬렉션에서 완전히 삭제합니다.
 */
export async function deleteVocabulary(uid: string, entryId: string): Promise<void> {
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


