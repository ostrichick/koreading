'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { createOrUpdateUser, getUserProfile, UserProfile } from '@/lib/db';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { getGuestLang, getGuestLevel } from '@/lib/storage';

// 애플리케이션 전체에서 공유할 인증 컨텍스트 데이터 구조 정의
interface AuthContextType {
  user: User | null;              // Firebase Auth가 반환하는 기본 유저 객체
  profile: UserProfile | null;    // Firestore DB에 저장된 유저 커스텀 프로필 정보
  loading: boolean;               // 현재 로그인 여부를 판별하고 있는 중인지 확인하는 로딩 상태
  signInWithGoogle: () => Promise<void>; // 구글 팝업 로그인 함수
  logout: () => Promise<void>;           // 로그아웃 함수
  refreshProfile: () => Promise<void>;   // 수동 프로필 데이터 최신화 함수
}

// 초기 기본값을 지정하여 인증 React Context를 생성합니다.
const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

// React 트리에 로그인 인증 상태를 공급해 주는 Provider 컴포넌트입니다.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 사용자의 Firestore 프로필 데이터를 수동으로 다시 불러와 로컬 상태에 동기화합니다.
  const refreshProfile = async () => {
    if (!user) return;
    const p = await getUserProfile(user.uid);
    setProfile(p);
  };

  // 컴포넌트가 마운트될 때 Firebase의 인증 상태 변화 감지 리스너를 실행합니다.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Firebase Auth 로그인 성공 시, Firestore에 사용자 프로필 정보가 등록되어 있는지 조회합니다.
        const existing = await getUserProfile(firebaseUser.uid);
        if (!existing) {
          // 가입 정보가 없는 최초 로그인 유저라면 기본 설정을 바탕으로 DB에 새 유저 문서를 생성합니다.
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            nativeLanguage: getGuestLang() || 'en', // 게스트 설정이 있다면 계승, 기본은 영어
            level: getGuestLevel() || null,          // 게스트 설정이 있다면 계승, 기본은 null
            createdAt: Timestamp.now(), // DB에는 serverTimestamp()를 쓰되 로컬 상태는 현재 시간으로 즉시 주입
          };

          await createOrUpdateUser(firebaseUser.uid, {
            ...newProfile,
            createdAt: serverTimestamp() as any,
          });

          // 데이터베이스 재조회 쿼리 없이 즉시 프로필 상태값으로 설정하여 1회 쿼리 비용을 절약합니다.
          setProfile(newProfile);
        } else {
          // 기존 유저인 경우 조회된 프로필을 상태로 설정합니다.
          setProfile(existing);
        }
      } else {
        // 비로그인 상태일 때는 프로필 값을 비워둡니다.
        setProfile(null);
      }
      setLoading(false); // 인증 상태 감지가 완료되었으므로 로딩을 비활성화합니다.
    });
    // 언마운트 시 리스너 구독을 해제합니다.
    return unsub;
  }, []);

  // 구글 로그인을 시도합니다. (웹뷰 환경인 경우 리다이렉트 로그인 사용)
  const signInWithGoogle = async () => {
    const isWebView = typeof window !== 'undefined' && 
      (/wv|Android/i.test(navigator.userAgent) || navigator.userAgent.includes('Koreading'));

    if (isWebView) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  };

  // 로그아웃을 요청합니다.
  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// 하위 컴포넌트에서 쉽게 로그인 컨텍스트를 접근할 수 있도록 돕는 커스텀 훅입니다.
export const useAuth = () => useContext(AuthContext);

