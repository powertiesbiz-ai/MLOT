import React, { useContext, useState } from 'react';
import { identity, sendDeso } from 'deso-protocol';
import { DeSoIdentityContext } from 'react-deso-protocol';
import { Heart, X, Loader2, Check } from 'lucide-react';

// Keith's DeSo account - contributions are sent here. Must be a public key
// (the library rejects usernames for transfers).
const SUPPORT_RECIPIENT = 'BC1YLhKycfPLCb8YTin4RgJsw2ctmJ3bKD96HfmZQ7g9LhwEsJPh1nE';

const ASK_COPY =
  'If you found this useful and want more free business tools like this, ' +
  'consider a small DeSo contribution. Give what you can.';

const PRESETS = [0.1, 0.5, 1];
const NANOS_PER_DESO = 1e9;
// Padding on the permission request so the transfer's network fee doesn't tip
// the granted GlobalDESOLimit over and force a second identity prompt.
const FEE_BUFFER_NANOS = 100_000; // 0.0001 DESO

type Status = 'idle' | 'sending' | 'success' | 'error';

interface SupportButtonProps {
  /** Sit higher so the pill clears the chat's bottom input bar. */
  raised?: boolean;
}

/**
 * Persistent, unobtrusive "Support this app" pill. Rendered once at the App
 * root (outside the screen switch) so it stays put across intro -> chat ->
 * report. It owns all of its own state - opening, closing, or failing to
 * send never touches the diagnostic flow.
 */
export const SupportButton: React.FC<SupportButtonProps> = ({ raised = false }) => {
  const { currentUser } = useContext(DeSoIdentityContext);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('0.1');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const reset = () => {
    setStatus('idle');
    setMessage('');
  };

  const close = () => {
    setOpen(false);
    // leave a success message visible if they just gave; otherwise clear
    if (status !== 'success') reset();
  };

  const handleSend = async () => {
    const deso = Number(amount);
    if (!Number.isFinite(deso) || deso <= 0) {
      setStatus('error');
      setMessage('Enter an amount greater than 0.');
      return;
    }
    if (!currentUser) {
      setStatus('error');
      setMessage('Log in with DeSo first, then try again.');
      return;
    }

    const amountNanos = Math.round(deso * NANOS_PER_DESO);
    setStatus('sending');
    setMessage('Processing your contribution (approve any DeSo prompt)...');

    try {
      // Ask for transfer permission up front if this contribution exceeds the
      // derived key's current budget (it always will - the login-setup budget
      // in desoConfig.ts is 0.001 DESO, far below any preset). sendDeso still
      // guards internally as a safety net; the fee buffer keeps that from
      // firing a second prompt.
      const requiredLimit = amountNanos + FEE_BUFFER_NANOS;
      const hasPerm = await identity.hasPermissions({
        TransactionCountLimitMap: { BASIC_TRANSFER: 1 },
        GlobalDESOLimit: requiredLimit,
      });
      if (!hasPerm) {
        await identity.requestPermissions({
          TransactionCountLimitMap: { BASIC_TRANSFER: 1 },
          GlobalDESOLimit: requiredLimit,
        });
      }

      await sendDeso({
        SenderPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
        RecipientPublicKeyOrUsername: SUPPORT_RECIPIENT,
        AmountNanos: amountNanos,
      });

      setStatus('success');
      setMessage(`Thank you! ${deso} DESO sent. 💛`);
    } catch (err) {
      console.error('Contribution failed', err);
      setStatus('error');
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      setMessage(
        msg.includes('logged in')
          ? 'Your DeSo session needs a refresh — log out and back in, then try again.'
          : 'That didn’t go through (you may have cancelled). Nothing was sent — feel free to try again.'
      );
    }
  };

  const sending = status === 'sending';

  return (
    <div
      className={`fixed right-4 z-40 no-print flex flex-col items-end gap-2 ${
        raised ? 'bottom-24' : 'bottom-4 sm:bottom-6'
      }`}
    >
      {open && (
        <div className="w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-sm shadow-2xl p-4 text-left animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-yellow-400" />
              Support this app
            </h3>
            <button
              onClick={close}
              aria-label="Close"
              className="text-slate-400 hover:text-white transition-colors -mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-3">{ASK_COPY}</p>

          {status === 'success' ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm py-1">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{message}</span>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5 mb-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setAmount(String(p));
                      if (status === 'error') reset();
                    }}
                    disabled={sending}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      amount === String(p)
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (status === 'error') reset();
                    }}
                    disabled={sending}
                    className="w-full bg-slate-800 text-white text-sm border border-slate-700 rounded-lg pl-3 pr-14 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    DESO
                  </span>
                </div>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                </button>
              </div>

              {message && (
                <p
                  className={`text-xs mt-2 leading-relaxed ${
                    status === 'error' ? 'text-red-400' : 'text-slate-400'
                  }`}
                >
                  {message}
                </p>
              )}
              {!currentUser && status === 'idle' && (
                <p className="text-xs mt-2 text-slate-500">
                  You&rsquo;ll need to log in with DeSo to contribute.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => (open ? close() : (reset(), setOpen(true)))}
        className="inline-flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700 text-slate-100 text-sm font-medium py-2 px-4 rounded-full border border-slate-700 shadow-lg backdrop-blur-sm transition-colors"
      >
        <span aria-hidden>💛</span>
        {open ? 'Close' : 'Support this app'}
      </button>
    </div>
  );
};
