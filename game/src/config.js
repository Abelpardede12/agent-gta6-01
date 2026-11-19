// Sunset Keys — every tuning number and colour in one place.
// The world is a fixed 2560x1920 sun-soaked coastal city; the camera follows the player and
// the renderer scales the view to the window, so no rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = { width: 2560, height: 1920 };

/** Road centrelines: a grid of streets, 120 px wide, with a beach strip on the east edge. */
export const ROAD_W = 120;
export const ROADS_V = [160, 560, 960, 1360, 1760, 2160];
export const ROADS_H = [160, 480, 800, 1120, 1440, 1760];
/** Sand starts here; the sea starts a little further east. */
export const BEACH_X = 2340;
export const SEA_X = 2470;

export const PLAYER = {
  walkSpeed: 178,
  carAccel: 470,
  carBrake: 720,
  carReverse: 210,
  carMaxSpeed: 545,
  carGrip: 6.2,
  carRadius: 15,
  enterRange: 54,
};

export const TRAFFIC_CARS = 10;
export const PEDESTRIANS = 22;
export const PARKED_CARS = 14;

/** Wanted stars, 0 to 5. A crime adds one; clean driving lets one fade away. */
export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 18;

export const MISSION = {
  minTime: 22,
  maxTime: 55,
  baseReward: 150,
  streakBonus: 25,
  reachRadius: 48,
  failCooldown: 8,
  firstCooldown: 5,
};

export const POLICE = {
  maxActive: 4,
  chaseSpeed: 505,
  chasePerStar: 16,
  ramDamage: 9,
  ramCooldown: 1.1,
  spawnDistance: 720,
};

export const PALETTE = {
  asphalt: '#3d3a46',
  asphaltLine: '#e0c67c',
  sidewalk: '#9a8d7a',
  block: '#7d7268',
  sand: '#eccf92',
  sea: '#2e8296',
  seaDeep: '#1d6074',
  grass: '#7fae62',
  roof: ['#e8a87c', '#e07856', '#f2c14e', '#7fb3a3', '#c9a0c4', '#f4ead8', '#8fa8c8', '#e5b8a0'],
  palm: '#3f8f4f',
  palmTrunk: '#8a6b4a',
  carColors: ['#e84a4a', '#f2c14e', '#4fa3e8', '#7fd08a', '#e8e8e8', '#9b7fd4', '#ff8c42', '#3ec6c6'],
  playerCar: '#ffcf3f',
  police: '#2b4acb',
  text: '#fff6e8',
  muted: '#d8c49a',
  sun: '#ff9e4f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (best cash, missions done, best streak) is kept between visits. */
export const SAVE_KEY = 'sunset-keys.save.v1';
