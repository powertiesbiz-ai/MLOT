import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebaseConfig';

export { isFirebaseConfigured };

/**
 * Current Google user, shared across components.
 * - `undefined`: auth state not resolved yet (or Firebase not configured)
 * - `null`: signed out
 * - `User`: signed in
 */
export function useGoogleUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      return;
    }
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  return user;
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Google sign-in is not configured yet.');
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOutGoogle(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}
