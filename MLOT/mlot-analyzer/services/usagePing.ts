// Anonymous usage counter — fires once when an analysis completes.
// Payload is ONLY the app slug, the event type, and a shared token.
// No user data, no inputs, no identity ever leave the browser in this call.
// Counting must never break the app: every failure is swallowed.
const PING_URL = 'https://n8n.powerties.us/webhook/app-usage-ping';
const APP_SLUG = 'mlot';
const PING_TOKEN = '02d4241fc2cfcfad3c5e9919c31b1ef32dd795c4b210318f';

export function pingUse(event: string = 'analysis_completed'): void {
  try {
    const payload = JSON.stringify({ slug: APP_SLUG, event, token: PING_TOKEN });
    // text/plain keeps the request CORS-safelisted (no preflight) for beacons.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon(PING_URL, blob)) return;
    }
    void fetch(PING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: payload,
      keepalive: true,
      mode: 'no-cors',
    }).catch(() => undefined);
  } catch {
    // Never surface counting errors to the user.
  }
}
