'use client';

import dynamic from 'next/dynamic';

// Phaser is browser-only and large; keep it out of the server bundle and
// every other route.
const RunnerGame = dynamic(() => import('./RunnerGame'), { ssr: false });

export default function RunnerPage() {
  return <RunnerGame />;
}
