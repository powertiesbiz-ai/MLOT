import { configure } from 'deso-protocol';

/**
 * One-time DeSo configuration. Imported for its side effect once, at app
 * startup (see index.tsx), before anything touches `identity`.
 *
 * MLOT uses DeSo for login/identity, plus an optional "Support this app"
 * contribution (components/SupportButton.tsx). It never posts, and it holds
 * no pre-authorized spend budget:
 *
 *  - GlobalDESOLimit: 0  -> the app never pre-approves an amount. Each
 *    contribution triggers its own identity approval for its exact amount
 *    (deso-protocol's sendDeso requests the needed GlobalDESOLimit at send
 *    time).
 *  - BASIC_TRANSFER: 'UNLIMITED'  -> lets the app *request* permission to
 *    send DESO transfers at all. Without an entry here, a contribution can't
 *    even prompt for approval.
 */
configure({
  appName: 'MLOT Analyzer',
  spendingLimitOptions: {
    GlobalDESOLimit: 0,
    TransactionCountLimitMap: {
      BASIC_TRANSFER: 'UNLIMITED',
    },
  },
});
