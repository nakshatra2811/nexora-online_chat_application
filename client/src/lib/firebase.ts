// Nexora Firebase Client SDK
// Used exclusively for Google OAuth sign-in (signInWithPopup)
// Server-side token verification uses firebase-admin (in server.js)

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent re-initialization in hot-reload dev mode
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Opens Google sign-in popup and returns the Firebase ID token.
 * Returns null if the user cancels or an error occurs.
 */
export async function signInWithGoogle(): Promise<{ uid: string; email: string; displayName: string; photoURL: string | null; idToken: string } | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return {
      uid: result.user.uid,
      email: result.user.email || '',
      displayName: result.user.displayName || '',
      photoURL: result.user.photoURL,
      idToken,
    };
  } catch (err: any) {
    // User closed the popup — not an error worth surfacing
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      return null;
    }
    throw err;
  }
}

export async function firebaseSignOut() {
  await signOut(auth);
}
