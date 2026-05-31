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
} from 'firebase/firestore';
import { db } from './firebase';
import type { CEFRLevel, NativeLanguage } from './gemini';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  nativeLanguage: NativeLanguage;
  level: CEFRLevel | null;
  createdAt: Timestamp;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  summary: string;
  topicCategory: string;
  level: CEFRLevel;
  estimatedMinutes: number;
  keyVocabulary: string[];
  createdAt: Timestamp;
}

export interface VocabularyEntry {
  id: string;
  word: string;
  pronunciation: string;
  definition: string;
  translation: string;
  partOfSpeech: string;
  examples: { korean: string; translation: string }[];
  level: string;
  topic: string;
  articleTitle: string;
  savedAt: Timestamp;
}

// User profile
export async function createOrUpdateUser(uid: string, data: Partial<UserProfile>) {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ uid, ...snap.data() } as UserProfile) : null;
}

// Articles
export async function saveArticle(article: Omit<Article, 'id' | 'createdAt'>) {
  const ref = collection(db, 'articles');
  const docRef = await addDoc(ref, { ...article, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function getArticlesByLevel(level: CEFRLevel): Promise<Article[]> {
  const ref = collection(db, 'articles');
  const q = query(ref, where('level', '==', level), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
}

export async function getArticleById(id: string): Promise<Article | null> {
  const ref = doc(db, 'articles', id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id, ...snap.data() } as Article) : null;
}

// Read tracking
export async function markArticleRead(uid: string, articleId: string) {
  const ref = doc(db, 'users', uid, 'readArticles', articleId);
  await setDoc(ref, { readAt: serverTimestamp() });
}

export async function getReadArticles(uid: string): Promise<string[]> {
  const ref = collection(db, 'users', uid, 'readArticles');
  const snap = await getDocs(ref);
  return snap.docs.map(d => d.id);
}

// Vocabulary
export async function saveVocabulary(uid: string, entry: Omit<VocabularyEntry, 'id' | 'savedAt'>) {
  const ref = collection(db, 'users', uid, 'vocabulary');
  const docRef = await addDoc(ref, { ...entry, savedAt: serverTimestamp() });
  return docRef.id;
}

export async function getVocabulary(uid: string): Promise<VocabularyEntry[]> {
  const ref = collection(db, 'users', uid, 'vocabulary');
  const q = query(ref, orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VocabularyEntry));
}
