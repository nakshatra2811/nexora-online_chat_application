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

// Initialize Firebase only on the client side and ONLY if we have an API key
// This prevents 'auth/invalid-api-key' errors during static build time (prerendering)
let app;
let auth: any = null;

if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    console.error("Firebase Initialization Error:", err);
  }
}

export { auth };

export const googleProvider = new GoogleAuthProvider();
if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

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
