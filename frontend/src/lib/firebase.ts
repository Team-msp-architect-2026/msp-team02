'use client';

import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';

type FirebaseRequiredEnvKey =
  | 'NEXT_PUBLIC_FIREBASE_API_KEY'
  | 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  | 'NEXT_PUBLIC_FIREBASE_APP_ID';

interface FirebaseClientStatus {
  isConfigured: boolean;
  missingKeys: FirebaseRequiredEnvKey[];
}

const firebaseApiKey = optionalEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
const firebaseAuthDomain = optionalEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
const firebaseProjectId = optionalEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const firebaseAppId = optionalEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
const firebaseMessagingSenderId = optionalEnv(
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
);
const firebaseStorageBucket = optionalEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

const firebaseConfig: FirebaseOptions = {
  apiKey: firebaseApiKey,
  authDomain: firebaseAuthDomain,
  projectId: firebaseProjectId,
  appId: firebaseAppId,
  messagingSenderId: firebaseMessagingSenderId,
  storageBucket: firebaseStorageBucket,
};

const firebaseClientStatus: FirebaseClientStatus = {
  isConfigured: Boolean(
    firebaseApiKey && firebaseAuthDomain && firebaseProjectId && firebaseAppId,
  ),
  missingKeys: [
    ...missingRequiredEnv('NEXT_PUBLIC_FIREBASE_API_KEY', firebaseApiKey),
    ...missingRequiredEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', firebaseAuthDomain),
    ...missingRequiredEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', firebaseProjectId),
    ...missingRequiredEnv('NEXT_PUBLIC_FIREBASE_APP_ID', firebaseAppId),
  ],
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let sessionPersistenceReady: Promise<void> | null = null;

export function getFirebaseClientStatus(): FirebaseClientStatus {
  return firebaseClientStatus;
}

export function getFirebaseAuth(): Auth | null {
  if (!firebaseClientStatus.isConfigured || typeof window === 'undefined') {
    return null;
  }

  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = getFirebaseApp();

  try {
    firebaseAuth = initializeAuth(app, {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    if (!isAuthAlreadyInitializedError(error)) {
      throw error;
    }

    firebaseAuth = getAuth(app);
  }

  return firebaseAuth;
}

export function createGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function ensureFirebaseSessionPersistence(auth: Auth): Promise<void> {
  if (!sessionPersistenceReady) {
    // Keep Firebase auth across reloads in the browser session; raw flow payloads stay out of Web Storage.
    sessionPersistenceReady = setPersistence(auth, browserSessionPersistence);
  }

  return sessionPersistenceReady;
}

function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
}

function optionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function missingRequiredEnv(
  key: FirebaseRequiredEnvKey,
  value: string | undefined,
): FirebaseRequiredEnvKey[] {
  return value ? [] : [key];
}

function isAuthAlreadyInitializedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === 'auth/already-initialized';
}
