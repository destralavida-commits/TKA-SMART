import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
auth.languageCode = 'id';

export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Keep session persisted across page reloads (IndexedDB -> localStorage -> sessionStorage fallback)
export const authPersistenceReady: Promise<void> = setPersistence(
  auth,
  indexedDBLocalPersistence,
)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch(() => setPersistence(auth, browserSessionPersistence))
  .catch(() => undefined);

export function getAuthErrorCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  if (error instanceof Error) {
    const match = error.message.match(/\((auth\/[a-z0-9-]+)\)/i);
    if (match) return match[1];
  }
  return null;
}

export function isPopupBlockedError(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  return code === 'auth/popup-blocked';
}

export function formatFirebaseAuthError(error: unknown): string {
  const code = getAuthErrorCode(error);
  const currentHost =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'domain ini';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Domain "${currentHost}" belum diizinkan di Firebase Authentication. Tambahkan "${currentHost}" pada Firebase Console → Authentication → Settings → Authorized domains. (${code})`;
    case 'auth/operation-not-allowed':
      return `Login dengan Google belum diaktifkan di Firebase Authentication. Aktifkan penyedia Google pada Firebase Console → Authentication → Sign-in method. (${code})`;
    case 'auth/popup-blocked':
      return `Jendela popup login Google diblokir oleh browser. Izinkan popup untuk situs ini atau gunakan tombol "Masuk via Pengalihan (Redirect)". (${code})`;
    case 'auth/popup-closed-by-user':
      return `Jendela login Google ditutup sebelum proses masuk selesai. Silakan coba masuk kembali. (${code})`;
    case 'auth/cancelled-popup-request':
      return `Permintaan popup login dibatalkan karena ada jendela login lain yang masih terbuka. (${code})`;
    case 'auth/network-request-failed':
      return `Gagal terhubung ke layanan Google/Firebase. Periksa koneksi internet Anda lalu coba lagi. (${code})`;
    case 'auth/user-disabled':
      return `Akun Google ini dinonaktifkan pada Firebase Authentication. (${code})`;
    case 'auth/account-exists-with-different-credential':
      return `Email ini sudah terdaftar menggunakan metode autentikasi lain. (${code})`;
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return `Konfigurasi Firebase API Key atau aplikasi belum diotorisasi untuk project ${firebaseConfig.projectId}. (${code})`;
    case 'auth/web-storage-unsupported':
    case 'auth/internal-error':
      return `Browser memblokir penyimpanan sesi atau popup autentikasi. Pastikan cookie & penyimpanan situs tidak diblokir (nonaktifkan mode Incognito ketat). (${code})`;
    default: {
      if (error instanceof Error && error.message) {
        return code ? `${error.message} (${code})` : error.message;
      }
      return 'Login Google gagal atau dibatalkan. Silakan coba lagi.';
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
      return false;
    }
    // Permission denied or not-found still confirms live server reachability
    return true;
  }
}
