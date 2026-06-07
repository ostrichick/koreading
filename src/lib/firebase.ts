// Firebase SDK 초기화 및 서비스 인스턴스를 설정하는 파일입니다.
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// .env.local 파일 또는 배포 환경에 등록된 Firebase 설정 값
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Next.js의 핫 리로딩(Hot Reloading) 시 Firebase 앱이 중복 초기화되지 않도록 설정합니다.
// 이미 초기화된 앱이 있다면 첫 번째 앱을 재사용하고, 없다면 새로 초기화합니다.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 다른 파일에서 가져다 사용할 수 있도록 Firebase 서비스 객체들을 내보냅니다.
export const auth = getAuth(app);                       // 사용자 인증 모듈
export const db = getFirestore(app);                     // Firestore 데이터베이스 모듈
export const googleProvider = new GoogleAuthProvider();  // 구글 간편 로그인 제공자

