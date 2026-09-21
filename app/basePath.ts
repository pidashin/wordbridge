// Single source of truth for this app's URL prefix on the shared NAS domain
// (nginx routes /wordbridge/* here — see next.config.ts's `basePath`).
// Next.js auto-prefixes page routing, API routes, static assets, and
// next/link/useRouter — this constant is only needed for the handful of raw
// fetch()/window.location calls that bypass those helpers.
export const BASE_PATH = '/wordbridge';
