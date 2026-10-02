import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Set these in Vercel (Project Settings -> Environment Variables) from the
// Firebase console: Project settings -> General -> Your apps -> Web app.
// The app runs fine without them - the Google login button simply stays hidden
// until they are configured.
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

export const isFirebaseConfigured = Boolean(apiKey && authDomain && projectId && appId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  app = getApps().length
    ? getApps()[0]
    : initializeApp({ apiKey, authDomain, projectId, appId });
  authInstance = getAuth(app);
}

/** Firebase Auth instance, or null when the env vars are not configured yet. */
export const auth: Auth | null = authInstance;
