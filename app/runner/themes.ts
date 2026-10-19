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
};

export const MEADOW: Theme = {
  id: 'meadow',
  name: 'Meadow',
  sky: { top: '#6ec6ff', bottom: '#d7f0ff' },
  layers: [
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
};

export const THEMES: Theme[] = [MEADOW];
export const DEFAULT_THEME = THEMES[0];
