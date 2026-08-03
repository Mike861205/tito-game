import { LEVELS_PER_WORLD, WORLD_IDS, type EnemyKind, type WorldId } from './constants.js';

/**
 * ============================================================
 * SISTEMA DE NIVELES DE TITO GAME
 * ============================================================
 * Los niveles se generan de forma DETERMINISTA a partir de una
 * semilla + parametros de diseno. Misma semilla = mismo nivel
 * siempre, en cliente y servidor (anti-trampa y reproducible).
 *
 * Si mas adelante quieres niveles hechos a mano en Tiled, solo
 * agrega `tilemap: 'ruta.json'` al LevelDesign y el cliente lo
 * cargara en lugar de generarlo.
 */

/** Simbolos del mapa (1 caracter = 1 tile). */
export const TILE = {
  EMPTY: '.',
  SOLID: '#',
  PLATFORM: '=', // atraviesas desde abajo
  BRICK: 'B', // rompible
  QUESTION: '?', // bloque sorpresa -> moneda
  POWER: 'M', // bloque sorpresa -> power-up
  COIN: 'o',
  GEM: 'G',
  SPIKE: '^',
  LAVA: '~',
  SPRING: '*',
  MOVING_H: '>',
  MOVING_V: 'v',
  CHECKPOINT: 'C',
  SPAWN: 'P',
  GOAL: 'X',
  ENEMY_GOOMB: 'E',
  ENEMY_SPIKER: 'S',
  ENEMY_FLYER: 'F',
  ENEMY_SLIDER: 'L',
  ENEMY_GHOST: 'H',
  BOSS: '@',
} as const;

export const MAP_HEIGHT = 20;
/** Fila donde empieza el terreno solido por defecto. */
export const GROUND_ROW = 16;

export interface LevelDesign {
  id: string;
  world: WorldId;
  level: number;
  name: string;
  seed: number;
  /** Ancho del nivel en tiles. */
  width: number;
  /** 0..1 dificultad general. */
  difficulty: number;
  /** Probabilidad de abismo por segmento. */
  gapChance: number;
  /** Ancho maximo de abismo en tiles (max 4 = saltable). */
  maxGap: number;
  /** Densidad de plataformas flotantes 0..1 */
  platformDensity: number;
  /** Densidad de enemigos 0..1 */
  enemyDensity: number;
  /** Densidad de peligros (pinchos/lava) 0..1 */
  hazardDensity: number;
  /** Enemigos permitidos. */
  enemies: EnemyKind[];
  /** Segundos disponibles. */
  timeLimit: number;
  /** Nivel de jefe. */
  boss?: string;
  /** Tilemap hecho a mano (opcional, sobreescribe la generacion). */
  tilemap?: string;
  music: string;
}

const LEVEL_NAMES: Record<number, string[]> = {
  1: ['Primeros Saltos', 'Colinas Alegres', 'Bosque de Bellotas', 'Guarida del Rey Bellota'],
  2: ['Dunas Ardientes', 'Oasis Traicionero', 'Ruinas de Arena', 'Nido del Escorpio'],
  3: ['Lago Congelado', 'Grutas Resbalosas', 'Puente de Cristal', 'Trono del Yeti'],
  4: ['Linea de Ensamblaje', 'Engranajes Locos', 'Cinta Sin Fin', 'Sala de Mecha-Tuerca'],
  5: ['Puertas de Magma', 'Rio de Lava', 'Torre Ardiente', 'Duelo con Lord Magma'],
};

const WORLD_ENEMIES: Record<number, EnemyKind[]> = {
  1: ['goomb', 'flyer'],
  2: ['goomb', 'spiker', 'slider'],
  3: ['spiker', 'flyer', 'slider'],
  4: ['slider', 'spiker', 'ghost'],
  5: ['ghost', 'spiker', 'flyer'],
};

const WORLD_BOSS: Record<number, string> = {
  1: 'Rey Bellota',
  2: 'Escorpio Mayor',
  3: 'Yeti Glacial',
  4: 'Mecha-Tuerca',
  5: 'Lord Magma',
};

const WORLD_MUSIC: Record<number, string> = {
  1: 'bgm-pradera',
  2: 'bgm-desierto',
  3: 'bgm-hielo',
  4: 'bgm-fabrica',
  5: 'bgm-lava',
};

/** Los 20 niveles (5 mundos x 4 niveles). */
export const LEVELS: readonly LevelDesign[] = WORLD_IDS.flatMap((world) =>
  Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
    const level = i + 1;
    const isBoss = level === LEVELS_PER_WORLD;
    // Dificultad global 0..1 a lo largo de los 20 niveles
    const index = (world - 1) * LEVELS_PER_WORLD + i;
    const difficulty = index / 19;

    const design: LevelDesign = {
      id: `${world}-${level}`,
      world,
      level,
      name: LEVEL_NAMES[world]?.[i] ?? `Nivel ${world}-${level}`,
      seed: world * 1000 + level * 37 + 12345,
      width: isBoss ? 60 : Math.round(110 + difficulty * 90),
      difficulty,
      gapChance: isBoss ? 0 : 0.18 + difficulty * 0.3,
      maxGap: isBoss ? 0 : Math.min(4, 2 + Math.floor(difficulty * 3)),
      platformDensity: 0.25 + difficulty * 0.4,
      enemyDensity: isBoss ? 0.25 : 0.18 + difficulty * 0.35,
      hazardDensity: isBoss ? 0.15 : difficulty * 0.35,
      enemies: WORLD_ENEMIES[world] ?? ['goomb'],
      timeLimit: isBoss ? 240 : Math.round(300 - difficulty * 80),
      music: WORLD_MUSIC[world] ?? 'bgm-pradera',
      ...(isBoss ? { boss: WORLD_BOSS[world] } : {}),
    };
    return design;
  }),
);

export function getLevelDesign(world: number, level: number): LevelDesign {
  const found = LEVELS.find((l) => l.world === world && l.level === level);
  if (!found) throw new Error(`Nivel inexistente: ${world}-${level}`);
  return found;
}

/** ---------- RNG determinista (mulberry32) ---------- */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratedLevel {
  design: LevelDesign;
  /** grid[row][col] */
  grid: string[][];
  width: number;
  height: number;
  spawn: { col: number; row: number };
  goal: { col: number; row: number };
  checkpoints: Array<{ col: number; row: number }>;
}

function makeEmptyGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => TILE.EMPTY));
}

/**
 * Genera el nivel completo. Garantiza jugabilidad:
 * - abismos <= maxGap (max 4 tiles, salto alcanza ~5)
 * - saltos verticales <= 3 tiles
 * - zona segura al inicio y al final
 */
export function generateLevel(design: LevelDesign): GeneratedLevel {
  const rng = createRng(design.seed);
  const width = design.width;
  const height = MAP_HEIGHT;
  const grid = makeEmptyGrid(width, height);

  const SAFE_START = 8;
  const SAFE_END = 8;
  const enemyPool = design.enemies;
  const enemyChar: Record<EnemyKind, string> = {
    goomb: TILE.ENEMY_GOOMB,
    spiker: TILE.ENEMY_SPIKER,
    flyer: TILE.ENEMY_FLYER,
    slider: TILE.ENEMY_SLIDER,
    ghost: TILE.ENEMY_GHOST,
    boss: TILE.BOSS,
  };

  /** Altura del terreno por columna (fila de la superficie). -1 = abismo. */
  const surface: number[] = new Array(width).fill(GROUND_ROW);

  let col = 0;
  let currentRow = GROUND_ROW;
  while (col < width) {
    const inSafeZone = col < SAFE_START || col >= width - SAFE_END;

    if (!inSafeZone && rng() < design.gapChance && design.maxGap > 0) {
      // Abismo (nunca mas ancho que maxGap: siempre saltable)
      const gap = Math.min(design.maxGap, 2 + Math.floor(rng() * Math.max(1, design.maxGap - 1)));
      for (let g = 0; g < gap && col < width - SAFE_END; g++, col++) surface[col] = -1;

      // Zona de aterrizaje obligatoria despues de cada abismo: nunca
      // hay dos abismos seguidos y siempre hay donde caer.
      const landing = 4 + Math.floor(rng() * 3);
      for (let r = 0; r < landing && col < width; r++, col++) surface[col] = currentRow;
      continue;
    }

    // Meseta de terreno
    const runLen = inSafeZone ? SAFE_START : 3 + Math.floor(rng() * 8);
    if (!inSafeZone && rng() < 0.35) {
      // escalon +-1..2 filas, sin pasarse
      const step = (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2));
      currentRow = Math.min(GROUND_ROW + 1, Math.max(GROUND_ROW - 5, currentRow + step));
    }
    for (let r = 0; r < runLen && col < width; r++, col++) surface[col] = currentRow;
  }

  // Pasada de seguridad: garantiza que el nivel siempre se pueda pasar.
  // 1) Ningun abismo mas ancho que maxGap.
  for (let c = 1; c < width; c++) {
    if (surface[c]! >= 0) continue;
    let end = c;
    while (end < width && surface[end]! < 0) end++;
    if (end - c > design.maxGap) {
      const landRow = surface[c - 1] ?? GROUND_ROW;
      for (let k = c + design.maxGap; k < end; k++) surface[k] = landRow;
    }
    c = end;
  }
  // 2) Ningun escalon de subida mayor a 3 tiles (el salto alcanza ~3.3).
  for (let c = 1; c < width; c++) {
    const prev = surface[c - 1]!;
    const cur = surface[c]!;
    if (prev < 0 || cur < 0) continue;
    if (prev - cur > 3) surface[c] = prev - 3;
  }

  // Pintar terreno solido
  for (let c = 0; c < width; c++) {
    const s = surface[c]!;
    if (s < 0) continue;
    for (let r = s; r < height; r++) grid[r]![c] = TILE.SOLID;
  }

  // Rellenar abismos con peligro (lava en mundo 5, vacio en el resto)
  const pitHazard = design.world === 5 ? TILE.LAVA : null;
  if (pitHazard) {
    for (let c = 0; c < width; c++) {
      if (surface[c]! < 0) {
        for (let r = height - 3; r < height; r++) grid[r]![c] = pitHazard;
      }
    }
  }

  // Plataformas flotantes + monedas
  const platformRowsAbove = [4, 5, 6, 7];
  for (let c = SAFE_START; c < width - SAFE_END; c++) {
    if (surface[c]! < 0) continue;
    if (rng() > design.platformDensity * 0.45) continue;

    const len = 3 + Math.floor(rng() * 5);
    if (c + len >= width - SAFE_END) continue;
    const above = platformRowsAbove[Math.floor(rng() * platformRowsAbove.length)]!;
    const row = Math.max(3, surface[c]! - above);

    let blocked = false;
    for (let k = 0; k < len; k++) {
      if (grid[row]![c + k] !== TILE.EMPTY || grid[row - 1]![c + k] !== TILE.EMPTY) blocked = true;
    }
    if (blocked) continue;

    for (let k = 0; k < len; k++) {
      const roll = rng();
      grid[row]![c + k] =
        roll < 0.08 ? TILE.POWER : roll < 0.24 ? TILE.QUESTION : roll < 0.4 ? TILE.BRICK : TILE.PLATFORM;
      if (rng() < 0.5) grid[row - 1]![c + k] = TILE.COIN;
    }
    c += len + 2;
  }

  // Monedas en arco sobre los abismos (recompensa por saltar bien)
  for (let c = 1; c < width - 1; c++) {
    if (surface[c]! >= 0 || surface[c - 1]! < 0) continue;
    let gapLen = 0;
    while (c + gapLen < width && surface[c + gapLen]! < 0) gapLen++;
    const base = surface[c - 1]!;
    for (let k = 0; k < gapLen; k++) {
      const t = gapLen > 1 ? k / (gapLen - 1) : 0.5;
      const arc = Math.round(Math.sin(t * Math.PI) * 3) + 2;
      const row = Math.max(2, base - arc);
      if (grid[row]![c + k] === TILE.EMPTY) grid[row]![c + k] = TILE.COIN;
    }
    c += gapLen;
  }

  // Peligros en el suelo (pinchos)
  for (let c = SAFE_START; c < width - SAFE_END; c++) {
    const s = surface[c]!;
    if (s < 0) continue;
    if (grid[s - 1]![c] !== TILE.EMPTY) continue;
    if (rng() < design.hazardDensity * 0.25) {
      grid[s - 1]![c] = TILE.SPIKE;
      c += 2;
    }
  }

  // Trampolines
  for (let c = SAFE_START; c < width - SAFE_END; c++) {
    const s = surface[c]!;
    if (s < 0 || grid[s - 1]![c] !== TILE.EMPTY) continue;
    if (rng() < 0.015) {
      grid[s - 1]![c] = TILE.SPRING;
      c += 6;
    }
  }

  // Plataformas moviles (a partir del mundo 2)
  if (design.world >= 2) {
    for (let c = SAFE_START; c < width - SAFE_END; c++) {
      if (surface[c]! >= 0) continue;
      if (rng() < 0.35) {
        const row = Math.max(4, GROUND_ROW - 3);
        if (grid[row]![c] === TILE.EMPTY) {
          grid[row]![c] = design.world >= 4 && rng() < 0.5 ? TILE.MOVING_V : TILE.MOVING_H;
          c += 6;
        }
      }
    }
  }

  // Enemigos
  if (design.boss) {
    // Arena de jefe: terreno plano al final
    const bossCol = width - 12;
    grid[GROUND_ROW - 3]![bossCol] = TILE.BOSS;
  }
  for (let c = SAFE_START + 4; c < width - SAFE_END; c++) {
    const s = surface[c]!;
    if (s < 0) continue;
    if (grid[s - 1]![c] !== TILE.EMPTY) continue;
    if (rng() > design.enemyDensity * 0.45) continue;

    const kind = enemyPool[Math.floor(rng() * enemyPool.length)]!;
    if (kind === 'flyer' || kind === 'ghost') {
      const row = Math.max(3, s - 4 - Math.floor(rng() * 3));
      if (grid[row]![c] === TILE.EMPTY) grid[row]![c] = enemyChar[kind];
    } else {
      grid[s - 1]![c] = enemyChar[kind];
    }
    c += 4;
  }

  // Gemas escondidas (3 por nivel). Busca la columna mas cercana con hueco.
  const gemSpots = [0.25, 0.55, 0.85];
  for (const p of gemSpots) {
    const start = Math.floor(width * p);
    let placed = false;
    for (let offset = 0; offset < 12 && !placed; offset++) {
      for (const c of [start + offset, start - offset]) {
        if (c < SAFE_START || c >= width - SAFE_END) continue;
        if (surface[c]! < 0) continue;
        for (let r = 3; r < GROUND_ROW - 2; r++) {
          if (grid[r]![c] === TILE.EMPTY && grid[r + 1]![c] !== TILE.EMPTY) {
            grid[r]![c] = TILE.GEM;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }
  }

  // Garantiza un minimo de monedas (importante en las arenas de jefe).
  const countCoins = (): number =>
    grid.reduce((sum, row) => sum + row.filter((ch) => ch === TILE.COIN).length, 0);
  const minCoins = Math.max(12, Math.round(width * 0.12));
  for (let c = SAFE_START; c < width - SAFE_END && countCoins() < minCoins; c += 2) {
    const s = surface[c]!;
    if (s < 0) continue;
    const row = s - 3 - (c % 3);
    if (row > 2 && grid[row]![c] === TILE.EMPTY) grid[row]![c] = TILE.COIN;
  }

  // Spawn
  const spawnCol = 3;
  const spawnRow = (surface[spawnCol] ?? GROUND_ROW) - 1;
  grid[spawnRow]![spawnCol] = TILE.SPAWN;

  // Checkpoints (1 o 2 segun largo). Busca la primera columna libre.
  const checkpoints: Array<{ col: number; row: number }> = [];
  const cpPositions = design.width > 140 ? [0.35, 0.68] : [0.5];
  for (const p of cpPositions) {
    const start = Math.floor(width * p);
    for (let c = start; c < width - SAFE_END; c++) {
      if (surface[c]! < 0) continue;
      const row = surface[c]! - 1;
      if (row <= 2 || grid[row]![c] !== TILE.EMPTY) continue;
      grid[row]![c] = TILE.CHECKPOINT;
      checkpoints.push({ col: c, row });
      break;
    }
  }

  // Meta
  const goalCol = width - 4;
  const goalRow = (surface[goalCol] ?? GROUND_ROW) - 1;
  grid[goalRow]![goalCol] = TILE.GOAL;

  return {
    design,
    grid,
    width,
    height,
    spawn: { col: spawnCol, row: spawnRow },
    goal: { col: goalCol, row: goalRow },
    checkpoints,
  };
}

/** Util para depurar: convierte el grid en texto. */
export function levelToString(level: GeneratedLevel): string {
  return level.grid.map((row) => row.join('')).join('\n');
}
