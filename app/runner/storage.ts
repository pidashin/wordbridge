// localStorage access that never throws (private mode, blocked storage).

const USER_ID_KEY = 'wordbridge_user_id';
const USER_NAME_KEY = 'wordbridge_username';
const BEST_KEY_PREFIX = 'wordbridge_runner_best_';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the game still works, it just forgets.
  }
}

export type RunnerUser = { id: string; username: string } | null;

export function readUser(): RunnerUser {
  const id = read(USER_ID_KEY);
  const username = read(USER_NAME_KEY);
  return id && username ? { id, username } : null;
}

export type BestScore = { words: number; wrongLetters: number };

function bestKey(userId: string | null): string {
  return `${BEST_KEY_PREFIX}${userId ?? 'guest'}`;
}

export function readBest(userId: string | null): BestScore | null {
  const raw = read(bestKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BestScore>;
    if (
      typeof parsed.words === 'number' &&
      typeof parsed.wrongLetters === 'number'
    ) {
      return { words: parsed.words, wrongLetters: parsed.wrongLetters };
    }
  } catch {
    // fall through
  }
  return null;
}

// More words wins; on a tie, fewer wrong letters.
export function isBetter(score: BestScore, best: BestScore | null): boolean {
  if (!best) return true;
  if (score.words !== best.words) return score.words > best.words;
  return score.wrongLetters < best.wrongLetters;
}

export function writeBest(userId: string | null, score: BestScore): void {
  write(bestKey(userId), JSON.stringify(score));
}
