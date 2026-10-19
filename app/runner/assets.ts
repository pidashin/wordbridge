import { BASE_PATH } from '../basePath';

// Phaser's loader does not apply Next's basePath, so build URLs by hand.
export const RUNNER_ASSET_BASE = `${BASE_PATH}/runner/`;

export type SvgAsset = {
  key: string;
  file: string;
  width?: number;
  height?: number;
};

const PLAYER_SIZE = 112;

export const PLAYER_RUN_KEYS = [
  'fox_run_0',
  'fox_run_1',
  'fox_run_2',
  'fox_run_3',
] as const;
export const PLAYER_JUMP_KEY = 'fox_jump';
export const PLAYER_STUMBLE_KEY = 'fox_stumble';

// Theme-independent art. Sizes rasterise the 128px-viewBox fox at the size it
// is drawn, so nothing is resampled at run time.
export const COMMON_ASSETS: SvgAsset[] = [
  ...[...PLAYER_RUN_KEYS, PLAYER_JUMP_KEY, PLAYER_STUMBLE_KEY].map((key) => ({
    key,
    file: `${key}.svg`,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
  })),
  { key: 'block', file: 'block.svg' }, // low obstacle, not used yet
];
