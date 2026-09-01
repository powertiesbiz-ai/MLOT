import { configure } from 'deso-protocol';

/**
 * One-time DeSo configuration. Imported for its side effect once, at app
 * startup (see index.tsx), before anything touches `identity`.
 *
 * MLOT uses DeSo for login/identity, plus an optional "Support this app"
 * contribution (components/SupportButton.tsx). It never posts and holds only
 * a token pre-authorized spend budget:
 *
 *  - GlobalDESOLimit: 1_000_000 nanos (0.001 DESO) -> just enough for the
 *    derived-key authorization transaction that login itself performs.
 *    GlobalDESOLimit: 0 makes that txn fail with
 *    RuleErrorDerivedKeyTxnSpendsMoreThanGlobalDESOLimit. This value is far
 *    below any real contribution (presets start at 0.1 DESO), so every
 *    contribution still exceeds the standing budget and SupportButton's
 *    identity.hasPermissions check returns false -> requestPermissions still
 *    prompts per contribution for its exact amount.
 *  - BASIC_TRANSFER: 'UNLIMITED' -> lets the app *request* permission to send
 *    DESO transfers at all. Without an entry here, a contribution can't even
 *    prompt for approval.
 */
const LOGIN_SETUP_BUDGET_NANOS = 1_000_000; // 0.001 DESO

configure({
  appName: 'MLOT Analyzer',
  spendingLimitOptions: {
    GlobalDESOLimit: LOGIN_SETUP_BUDGET_NANOS,
    TransactionCountLimitMap: {
      BASIC_TRANSFER: 'UNLIMITED',
    },
  },
});
