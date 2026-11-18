import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  code?: string;
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function extractFirebaseError(error: unknown): { code: string; message: string } {
  if (error && typeof error === 'object') {
    const maybe = error as { code?: unknown; message?: unknown };
    const message =
      typeof maybe.message === 'string'
        ? maybe.message
        : error instanceof Error
          ? error.message
          : String(error);
    const code = typeof maybe.code === 'string' ? maybe.code : 'unknown';

    // Unwrap serialized FirestoreErrorInfo if already wrapped
    if (message.startsWith('{') && message.includes('"operationType"')) {
      try {
        const parsed = JSON.parse(message) as FirestoreErrorInfo;
        return {
          code: parsed.code || code,
          message: parsed.error || message,
        };
      } catch {
        // Fall through
      }
    }
    return { code, message };
  }
  return { code: 'unknown', message: String(error) };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const { code, message } = extractFirebaseError(error);
  const errInfo: FirestoreErrorInfo = {
    code,
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function isFirestoreConfigured(): boolean {
  return (
    Boolean(firebaseConfig?.projectId) &&
    firebaseConfig.projectId !== 'remixed-project-id' &&
    Boolean(firebaseConfig?.firestoreDatabaseId)
  );
}
