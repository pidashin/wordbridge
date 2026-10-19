'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { MdScreenRotation } from 'react-icons/md';
import type { Game } from 'phaser';
import GET_WORDS from '../gql/getWords';
import { RUNNER_CONFIG, USE_DEMO_WORDS } from './config';
import { createGame } from './createGame';
import { DEMO_WORDS } from './demoWords';
import { normalisePool } from './logic/wordPool';
import type { RawWord } from './logic/wordPool';
import { readUser } from './storage';

export default function RunnerGame() {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const portraitRef = useRef(false);
  const exitRef = useRef(() => router.push('/'));
  const [portrait, setPortrait] = useState(false);

  const { data, loading, error } = useQuery<{ words: RawWord[] }>(GET_WORDS, {
    skip: USE_DEMO_WORDS,
  });
  const pool = useMemo(() => {
    if (USE_DEMO_WORDS) return normalisePool(DEMO_WORDS, RUNNER_CONFIG.words);
    return data ? normalisePool(data.words, RUNNER_CONFIG.words) : null;
  }, [data]);

  useEffect(() => {
    exitRef.current = () => router.push('/');
  }, [router]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !pool) return;

    // Deferred so React strict mode's mount/unmount/mount never boots (and
    // then has to tear down) a throwaway game.
    const timer = window.setTimeout(() => {
      const game = createGame(host, {
        words: pool,
        sourceLabel: USE_DEMO_WORDS ? 'Demo words' : 'All words',
        user: readUser(),
        onExit: () => exitRef.current(),
      });
      gameRef.current = game;
      if (portraitRef.current) game.pause();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [pool]);

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const apply = () => {
      portraitRef.current = query.matches;
      setPortrait(query.matches);
      if (query.matches) gameRef.current?.pause();
      else gameRef.current?.resume();
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return (
    <div className="relative h-dvh w-full touch-none select-none overflow-hidden bg-slate-900">
      <div ref={hostRef} className="h-full w-full" />
      {(loading || error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
          {loading ? (
            <p className="text-lg">Loading words...</p>
          ) : (
            <>
              <p className="text-lg">Could not load the word list.</p>
              <Link href="/" className="underline">
                Back home
              </Link>
            </>
          )}
        </div>
      )}
      {portrait && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-900 text-white">
          <MdScreenRotation className="h-16 w-16" aria-hidden />
          <p className="text-xl font-semibold">Rotate your device</p>
          <p className="text-sm text-slate-300">
            Word Runner plays in landscape.
          </p>
        </div>
      )}
    </div>
  );
}
