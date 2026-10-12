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
const heatmapPaths = new Set(['/', '/hot-wheels', '/race/play']);

function isInternalBrowser(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('me') === '1') {
      localStorage.setItem('rih_owner', '1');
    }
    return import.meta.env.DEV || localStorage.getItem('rih_owner') === '1';
  }
  catch { return import.meta.env.DEV; }
}

/** Keep referral codes, preview state and other query values out of analytics. */
export function analyticsUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.origin + url.pathname;
  } catch {
    return '';
  }
}

export function initAnalytics(): void {
  if (!enabled || loading) return;
  // A separate chunk keeps the analytics SDK out of the initial app bundle.
  loading = import('posthog-js').then(({ default: posthog }) => {
    const internal = isInternalBrowser();
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
      capture_heatmaps: { flush_interval_milliseconds: 5000 },
      capture_performance: { web_vitals: true, network_timing: false },
      enable_recording_console_log: true,
      // Sample 10% of visitor sessions; owner/development browsers never record.
      disable_session_recording: internal || import.meta.env.VITE_POSTHOG_SESSION_REPLAY === 'false',
      session_recording: {
        sampleRate: 0.1,
        maskAllInputs: true,
        blockSelector: 'video, canvas',
        recordHeaders: false,
        recordBody: false,
        captureCanvas: { recordCanvas: false },
      },
      before_send: (event) => {
        if (event?.event === '$$heatmap') {
          if (internal) return null;
          const data = event.properties?.$heatmap_data as Record<string, unknown[]> | undefined;
          const allowed: Record<string, unknown[]> = {};
          for (const [url, points] of Object.entries(data || {})) {
            const clean = analyticsUrl(url);
            if (clean && Array.isArray(points) && heatmapPaths.has(new URL(clean).pathname)) {
              allowed[clean] = [...(allowed[clean] || []), ...points];
            }
          }
          if (!Object.keys(allowed).length) return null;
          event.properties.$heatmap_data = allowed;
        }
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
        sdk.register({ app: 'hotwheels', environment: import.meta.env.MODE, $internal_or_test_user: internal });
        // Owner browsers and development analytics are test traffic.
        try {
          if (internal) {
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
