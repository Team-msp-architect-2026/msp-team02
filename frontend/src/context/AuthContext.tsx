'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';

import { AuthApiError, fetchAuthMe } from '@/lib/auth-api';
import {
  createGoogleAuthProvider,
  ensureFirebaseSessionPersistence,
  getFirebaseAuth,
  getFirebaseClientStatus,
} from '@/lib/firebase';
import type { AuthMeResponse, FirebaseUserSummary } from '@/types/auth';

const loggedOutAuthMe: AuthMeResponse = {
  logged_in: false,
  user_id: null,
  display_name: null,
  email: null,
};

interface RefreshBackendAuthOptions {
  forceRefresh?: boolean;
}

interface AuthContextValue {
  firebaseConfigured: boolean;
  missingFirebaseConfig: string[];
  firebaseUser: FirebaseUserSummary | null;
  backendUser: AuthMeResponse;
  isInitializing: boolean;
  isSigningIn: boolean;
  isCheckingBackend: boolean;
  errorMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshBackendAuth: (options?: RefreshBackendAuthOptions) => Promise<AuthMeResponse | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const firebaseStatus = useMemo(() => getFirebaseClientStatus(), []);
  const [authInstance, setAuthInstance] = useState<Auth | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUserSummary | null>(null);
  const [backendUser, setBackendUser] = useState<AuthMeResponse>(loggedOutAuthMe);
  const [isInitializing, setIsInitializing] = useState(firebaseStatus.isConfigured);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const backendCheckRequestIdRef = useRef(0);

  const verifyBackendUser = useCallback(
    async (
      user: User,
      options: RefreshBackendAuthOptions = {},
    ): Promise<AuthMeResponse | null> => {
      const requestId = backendCheckRequestIdRef.current + 1;
      const expectedUid = user.uid;
      backendCheckRequestIdRef.current = requestId;
      setIsCheckingBackend(true);
      setErrorMessage(null);
      const canApplyResponse = () => {
        const currentUid = getFirebaseAuth()?.currentUser?.uid ?? null;
        return backendCheckRequestIdRef.current === requestId && currentUid === expectedUid;
      };

      try {
        const idToken = await user.getIdToken(options.forceRefresh ?? false);
        let response: AuthMeResponse;

        try {
          response = await fetchAuthMe(idToken);
        } catch (error) {
          if (
            error instanceof AuthApiError &&
            error.status === 401 &&
            !options.forceRefresh
          ) {
            const refreshedIdToken = await user.getIdToken(true);
            response = await fetchAuthMe(refreshedIdToken);
          } else {
            throw error;
          }
        }

        if (!canApplyResponse()) {
          return null;
        }

        setBackendUser(response);
        return response;
      } catch (error) {
        if (!canApplyResponse()) {
          return null;
        }

        setBackendUser(loggedOutAuthMe);
        setErrorMessage(getAuthErrorMessage(error));
        return null;
      } finally {
        if (backendCheckRequestIdRef.current === requestId) {
          setIsCheckingBackend(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!firebaseStatus.isConfigured) {
      setIsInitializing(false);
      return undefined;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setIsInitializing(false);
      setErrorMessage('브라우저에서만 Firebase 로그인을 사용할 수 있습니다.');
      return undefined;
    }

    setAuthInstance(auth);
    void ensureFirebaseSessionPersistence(auth).catch((error: unknown) => {
      setErrorMessage(getAuthErrorMessage(error));
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        backendCheckRequestIdRef.current += 1;
        setFirebaseUser(null);
        setBackendUser(loggedOutAuthMe);
        setIsCheckingBackend(false);
        setIsInitializing(false);
        return;
      }

      setFirebaseUser(toFirebaseUserSummary(user));
      setIsInitializing(false);
      void verifyBackendUser(user);
    });

    return unsubscribe;
  }, [firebaseStatus.isConfigured, verifyBackendUser]);

  const signInWithGoogle = useCallback(async () => {
    const auth = authInstance ?? getFirebaseAuth();
    if (!firebaseStatus.isConfigured || !auth) {
      setErrorMessage('Firebase public web config 설정이 필요합니다.');
      return;
    }

    setIsSigningIn(true);
    setErrorMessage(null);

    try {
      await ensureFirebaseSessionPersistence(auth);
      const credential = await signInWithPopup(auth, createGoogleAuthProvider());
      setFirebaseUser(toFirebaseUserSummary(credential.user));
      await verifyBackendUser(credential.user);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSigningIn(false);
    }
  }, [authInstance, firebaseStatus.isConfigured, verifyBackendUser]);

  const signOut = useCallback(async () => {
    const auth = authInstance ?? getFirebaseAuth();
    if (!auth) {
      backendCheckRequestIdRef.current += 1;
      setFirebaseUser(null);
      setBackendUser(loggedOutAuthMe);
      setIsCheckingBackend(false);
      return;
    }

    backendCheckRequestIdRef.current += 1;
    setIsCheckingBackend(false);
    setErrorMessage(null);
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setBackendUser(loggedOutAuthMe);
  }, [authInstance]);

  const refreshBackendAuth = useCallback(
    async (options: RefreshBackendAuthOptions = {}) => {
      const auth = authInstance ?? getFirebaseAuth();
      const currentUser = auth?.currentUser ?? null;

      if (!currentUser) {
        setBackendUser(loggedOutAuthMe);
        return loggedOutAuthMe;
      }

      return verifyBackendUser(currentUser, options);
    },
    [authInstance, verifyBackendUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseConfigured: firebaseStatus.isConfigured,
      missingFirebaseConfig: firebaseStatus.missingKeys,
      firebaseUser,
      backendUser,
      isInitializing,
      isSigningIn,
      isCheckingBackend,
      errorMessage,
      signInWithGoogle,
      signOut,
      refreshBackendAuth,
      clearError: () => setErrorMessage(null),
    }),
    [
      backendUser,
      errorMessage,
      firebaseStatus.isConfigured,
      firebaseStatus.missingKeys,
      firebaseUser,
      isCheckingBackend,
      isInitializing,
      isSigningIn,
      refreshBackendAuth,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

function toFirebaseUserSummary(user: User): FirebaseUserSummary {
  return {
    display_name: user.displayName ?? null,
    email: user.email ?? null,
    photo_url: user.photoURL ?? null,
  };
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  const code = getFirebaseErrorCode(error);
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google 로그인이 취소되었습니다.';
  }

  if (code === 'auth/unauthorized-domain') {
    return '현재 도메인이 Firebase Authentication 승인 도메인에 없습니다.';
  }

  if (code === 'auth/network-request-failed') {
    return '네트워크 연결을 확인한 후 다시 시도해주세요.';
  }

  return '로그인 또는 인증 확인 중 오류가 발생했습니다.';
}

function getFirebaseErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}
