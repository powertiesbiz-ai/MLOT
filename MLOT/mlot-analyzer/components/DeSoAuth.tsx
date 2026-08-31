import React, { useContext } from 'react';
import { identity } from 'deso-protocol';
import type { User } from 'deso-protocol';
import { DeSoIdentityContext } from 'react-deso-protocol';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

// Username if the account has a profile, otherwise the raw public key.
const getDisplayName = (user: User): string =>
  user.ProfileEntryResponse?.Username ?? user.PublicKeyBase58Check;

/**
 * DeSo login / identity control. Login-only: `identity.login()` opens the
 * identity.deso.org popup, and the DeSoIdentityProvider re-renders this with
 * `currentUser` populated. No transactions, no permission requests.
 */
export const DeSoAuth: React.FC = () => {
  const { currentUser, isLoading } = useContext(DeSoIdentityContext);

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting to DeSo...
      </div>
    );
  }

  if (currentUser) {
    return (
      <div className="inline-flex items-center gap-3">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="font-mono truncate max-w-[10rem] sm:max-w-[16rem]">
            {getDisplayName(currentUser)}
          </span>
        </span>
        <button
          onClick={() => identity.logout()}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => identity.login()}
      className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-2.5 px-5 rounded-xl border border-slate-700 transition-colors"
    >
      <LogIn className="w-4 h-4" />
      Log in with DeSo
    </button>
  );
};
