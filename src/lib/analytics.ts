import type { PostHogInterface, Properties } from 'posthog-js';

// Public, write-only project token from the separate Hot Wheels account.
// Vercel builds work immediately; an environment variable can override it.
const projectKey = import.meta.env.VITE_POSTHOG_KEY?.trim() ||
  'phc_CL7yqCsfEGLtsQmA2npAYLoyLMEbam9NAtxcFFxBCCu2';
const enabled = Boolean(projectKey) &&
  (import.meta.env.PROD || import.meta.env.VITE_POSTHOG_ENABLE_DEV === 'true');
let client: PostHogInterface | null = null;
let loading: Promise<void> | null = null;
const pending: { event: string; properties: Properties }[] = [];

/** Keep referral codes, preview state and other query values out of analytics. */
export function analyticsUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin + url.pathname;
  } catch {
    return '';
  }
}

export function initAnalytics(): void {
  if (!enabled || loading) return;
  // A separate chunk keeps the analytics SDK out of the initial app bundle.
  loading = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(projectKey!, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      ui_host: import.meta.env.VITE_POSTHOG_HOST?.includes('eu.i.posthog.com')
        ? 'https://eu.posthog.com' : 'https://us.posthog.com',
      defaults: '2026-05-30',
      capture_pageview: false,
      capture_pageleave: true,
      capture_exceptions: true,
      person_profiles: 'identified_only',
      mask_all_text: true,
      mask_all_element_attributes: true,
      disable_session_recording: import.meta.env.VITE_POSTHOG_SESSION_REPLAY !== 'true',
      session_recording: { maskAllInputs: true },
      before_send: (event) => {
        if (event?.properties) {
          for (const key of ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer']) {
            if (typeof event.properties[key] === 'string') {
              event.properties[key] = analyticsUrl(event.properties[key]);
            }
          }
          delete event.properties.$search;
          delete event.properties.$hash;
        }
        return event;
      },
      loaded: (sdk) => {
        sdk.register({ app: 'hotwheels', environment: import.meta.env.MODE });
        // Reuse the app's existing owner marker; dev analytics are also test traffic.
        try {
          if (import.meta.env.DEV || localStorage.getItem('rih_owner') === '1') {
            sdk.setInternalOrTestUser();
          }
        } catch { /* Storage can be blocked; analytics must not interrupt play. */ }
        client = sdk;
        for (const item of pending.splice(0)) sdk.capture(item.event, item.properties);
      },
    });
  }).catch(() => {
    // A blocked analytics script must never stop the app or race.
    pending.length = 0;
  });
}

export function track(event: string, properties: Properties = {}): void {
  if (!enabled) return;
  try {
    if (client) client.capture(event, properties);
    else {
      if (pending.length < 50) pending.push({ event, properties });
      initAnalytics();
    }
  } catch { /* Analytics is optional to the experience. */ }
}

export function trackException(error: Error): void {
  try { client?.captureException(error); } catch { /* Keep the recovery UI working. */ }
}
