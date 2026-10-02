import React, { useState } from 'react';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signOutGoogle,
  useGoogleUser,
} from '../services/googleAuth';

/**
 * Google login / identity control via Firebase Authentication.
 * Renders nothing until the Firebase env vars are configured (see
 * services/firebaseConfig.ts), so the app keeps working on DeSo-only
 * until Keith finishes the Firebase setup.
 */
export const GoogleAuth: React.FC = () => {
  const user = useGoogleUser();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isFirebaseConfigured) return null;

  if (user === undefined) {
    return (
      <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking Google session...
      </div>
    );
  }

  if (user) {
    const displayName = user.displayName ?? user.email ?? 'Google user';
    return (
      <div className="inline-flex items-center gap-3">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          <span className="truncate max-w-[10rem] sm:max-w-[16rem]">{displayName}</span>
        </span>
        <button
          onClick={() => signOutGoogle()}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    );
  }

  const handleLogin = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('Google sign-in failed', e);
      setError('Google sign-in failed - please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleLogin}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-2.5 px-5 rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Log in with Google
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};
