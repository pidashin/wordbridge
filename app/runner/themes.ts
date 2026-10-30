type ArtFile = { key: string; file: string };

export type Theme = {
  id: string;
  name: string;
  sky: { top: string; bottom: string };
  // y is the screen-space top edge of the layer (layers are screen-fixed and
  // scroll their texture by cameraScrollX * scrollFactor).
  layers: { key: string; file: string; scrollFactor: number; y: number }[];
  // bodyColor fills the ground below the surface; it must match the tile's
  // dirt colour so the tile blends into it.
  ground: { key: string; file: string; bodyColor: string };
  // One-way ledges are drawn as left cap + middle tiles + right cap.
  platform: { left: ArtFile; mid: ArtFile; right: ArtFile };
  // Gaps: dark pit interior plus a lip cap on the ground edge beside it.
  pit: { lip: ArtFile; color: string };
  // Mud patch drawn on the ground surface, stretched to the patch width.
  mud: ArtFile;
};

export const MEADOW: Theme = {
  id: 'meadow',
  name: 'Meadow',
  sky: { top: '#6ec6ff', bottom: '#d7f0ff' },
  layers: [
    // Pale, small far clouds drift slower than the near ones.
    {
      key: 'meadow-clouds-far',
      file: 'meadow-clouds-far.svg',
      scrollFactor: 0.02,
      y: 50,
    },
    {
      key: 'meadow-clouds',
      file: 'meadow-clouds.svg',
      scrollFactor: 0.05,
      y: 30,
    },
    {
      key: 'meadow-far-hills',
      file: 'meadow-far-hills.svg',
      scrollFactor: 0.15,
      y: 300,
    },
    {
      key: 'meadow-near-hills',
      file: 'meadow-near-hills.svg',
      scrollFactor: 0.4,
      y: 400,
    },
  ],
  ground: {
    key: 'meadow-ground',
    file: 'meadow-ground.svg',
    bodyColor: '#9a6b3f',
  },
  platform: {
    left: { key: 'meadow-platform-left', file: 'platform_left.svg' },
    mid: { key: 'meadow-platform-mid', file: 'platform_mid.svg' },
    right: { key: 'meadow-platform-right', file: 'platform_right.svg' },
  },
  mud: { key: 'meadow-mud', file: 'mud.svg' },
  pit: {
    lip: { key: 'meadow-pit-lip', file: 'pit_lip.svg' },
    color: '#2a1b14',
  },
};

export const THEMES: Theme[] = [MEADOW];
export const DEFAULT_THEME = THEMES[0];
