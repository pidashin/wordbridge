import type { RunnerWord } from './logic/wordPool';

// Everything the Phaser scenes need from the React page, passed through the
// game registry.
export type RunnerSession = {
  words: RunnerWord[];
  // Shown on the title screen, e.g. "Demo words".
  sourceLabel: string;
  user: { id: string; username: string } | null;
  onExit: () => void;
};

export const SESSION_KEY = 'runnerSession';

export type SpelledWord = { en: string; zh: string; wrongLetters: number };

export type RoundResult = {
  spelled: SpelledWord[];
  wrongLetters: number;
};
