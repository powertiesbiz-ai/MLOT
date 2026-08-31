import { configure } from 'deso-protocol';

/**
 * One-time DeSo configuration. Imported for its side effect once, at app
 * startup (see index.tsx), before anything touches `identity`.
 *
 * MLOT uses DeSo for login / identity only - it never builds, signs, or
 * submits an on-chain transaction - so we request no spending permission at
 * all: `GlobalDESOLimit: 0`. If we later add token-gating or micropayments,
 * this is where spendingLimitOptions grow and where a
 * `identity.requestPermissions(...)` flow would hang off.
 */
configure({
  appName: 'MLOT Analyzer',
  spendingLimitOptions: {
    GlobalDESOLimit: 0,
  },
});
