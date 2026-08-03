/**
 * Constantes compartidas entre el cliente (Phaser) y la API.
 * Cambiar aqui = cambiar en todo el juego.
 */

/** Tamano del tile base. Todo el arte se disena sobre esta rejilla. */
export const TILE_SIZE = 32;

/** Resolucion logica del juego (se escala a la ventana). 16:9 */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Medidas del sprite de Tito (un frame). */
export const TITO_FRAME_WIDTH = 48;
export const TITO_FRAME_HEIGHT = 48;

/** Fisica */
export const PHYSICS = {
  gravityY: 1800,
  runSpeed: 230,
  sprintSpeed: 340,
  acceleration: 1800,
  friction: 1500,
  airFriction: 400,
  jumpVelocity: -620,
  jumpHoldBoost: -900,
  maxJumpHoldMs: 190,
  maxFallSpeed: 900,
  coyoteTimeMs: 110,
  jumpBufferMs: 130,
  enemyStompBounce: -420,
  invulnerabilityMs: 1400,
} as const;

/** Puntajes */
export const SCORE = {
  coin: 100,
  gem: 500,
  enemyStomp: 200,
  enemyCombo: 100,
  checkpoint: 50,
  levelClear: 1000,
  timeBonusPerSecond: 10,
  livesBonus: 250,
  noDamageBonus: 2000,
} as const;

export const STARTING_LIVES = 3;
export const MAX_LIVES = 9;

/** Id de los 5 mundos. */
export const WORLD_IDS = [1, 2, 3, 4, 5] as const;
export type WorldId = (typeof WORLD_IDS)[number];

export const LEVELS_PER_WORLD = 4;
export const TOTAL_LEVELS = WORLD_IDS.length * LEVELS_PER_WORLD;

export interface WorldMeta {
  id: WorldId;
  slug: string;
  name: string;
  subtitle: string;
  /** Color de fondo (cielo) */
  skyTop: number;
  skyBottom: number;
  /** Color base del terreno */
  ground: number;
  groundTop: number;
  accent: number;
  /** Enemigos habilitados en el mundo */
  enemies: EnemyKind[];
  /** Modificadores de fisica por ambiente */
  modifiers?: {
    gravityScale?: number;
    frictionScale?: number;
    wind?: number;
  };
  boss: string;
}

export type EnemyKind = 'goomb' | 'spiker' | 'flyer' | 'slider' | 'ghost' | 'boss';

/** Metadata de los 5 mundos de Tito Game. */
export const WORLDS: readonly WorldMeta[] = [
  {
    id: 1,
    slug: 'praderas-de-tito',
    name: 'Praderas de Tito',
    subtitle: 'Mundo 1 - Verde y saltarin',
    skyTop: 0x5ec8ff,
    skyBottom: 0xbdf0ff,
    ground: 0x6b4423,
    groundTop: 0x4caf50,
    accent: 0xffd54f,
    enemies: ['goomb', 'flyer'],
    boss: 'Rey Bellota',
  },
  {
    id: 2,
    slug: 'desierto-dorado',
    name: 'Desierto Dorado',
    subtitle: 'Mundo 2 - Arena y trampas',
    skyTop: 0xffb74d,
    skyBottom: 0xffe0b2,
    ground: 0xc9a227,
    groundTop: 0xf4d35e,
    accent: 0xff7043,
    enemies: ['goomb', 'spiker', 'slider'],
    boss: 'Escorpio Mayor',
  },
  {
    id: 3,
    slug: 'cavernas-de-hielo',
    name: 'Cavernas de Hielo',
    subtitle: 'Mundo 3 - Resbaloso y frio',
    skyTop: 0x1e3a5f,
    skyBottom: 0x7ec8e3,
    ground: 0x4a6fa5,
    groundTop: 0xa8e6ff,
    accent: 0x80deea,
    enemies: ['spiker', 'flyer', 'slider'],
    boss: 'Yeti Glacial',
    modifiers: { frictionScale: 0.25 },
  },
  {
    id: 4,
    slug: 'fabrica-de-tuercas',
    name: 'Fabrica de Tuercas',
    subtitle: 'Mundo 4 - Maquinas y precision',
    skyTop: 0x2b2d42,
    skyBottom: 0x5c6378,
    ground: 0x3d405b,
    groundTop: 0x8d99ae,
    accent: 0xef476f,
    enemies: ['slider', 'spiker', 'ghost'],
    boss: 'Mecha-Tuerca',
  },
  {
    id: 5,
    slug: 'castillo-de-lava',
    name: 'Castillo de Lava',
    subtitle: 'Mundo 5 - El desafio final',
    skyTop: 0x1a0b0b,
    skyBottom: 0x7f1d1d,
    ground: 0x4a1414,
    groundTop: 0xb91c1c,
    accent: 0xff9500,
    enemies: ['ghost', 'spiker', 'flyer', 'boss'],
    boss: 'Lord Magma',
  },
] as const;

export function getWorld(id: number): WorldMeta {
  const world = WORLDS.find((w) => w.id === id);
  if (!world) throw new Error(`Mundo desconocido: ${id}`);
  return world;
}

/** Id canonico de nivel: "1-3" */
export function levelId(world: number, level: number): string {
  return `${world}-${level}`;
}

export function parseLevelId(id: string): { world: number; level: number } {
  const [w, l] = id.split('-');
  return { world: Number(w), level: Number(l) };
}

/** Siguiente nivel (o null si es el final del juego). */
export function nextLevel(world: number, level: number): { world: number; level: number } | null {
  if (level < LEVELS_PER_WORLD) return { world, level: level + 1 };
  if (world < WORLD_IDS.length) return { world: world + 1, level: 1 };
  return null;
}

/** Power-ups disponibles. */
export const POWER_UPS = ['none', 'grande', 'fuego', 'estrella'] as const;
export type PowerUp = (typeof POWER_UPS)[number];
