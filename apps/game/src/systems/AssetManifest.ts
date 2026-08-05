import Phaser from 'phaser';
import { TITO_FRAME_HEIGHT, TITO_FRAME_WIDTH, WORLD_IDS } from '@tito/shared';
import { TITO_ART_KEY } from './TitoRig';

/**
 * ============================================================
 * MANIFIESTO DE ASSETS REEMPLAZABLES
 * ============================================================
 * Cada entrada = 1 archivo PNG que puedes poner en
 * `apps/game/public/assets/<url>` para sustituir el placeholder
 * dibujado por codigo. No hay que tocar nada mas: si el archivo
 * existe se usa, si no existe se genera el placeholder.
 *
 * Si el PNG trae varios frames (hoja horizontal) se registran
 * tambien las animaciones. Si pones una sola imagen estatica del
 * tamano de 1 frame, tambien funciona: simplemente no se anima.
 */

export interface AssetAnimDef {
  /** Clave de la animacion en Phaser */
  key: string;
  /** Primer frame (0-index) */
  start: number;
  /** Ultimo frame (se recorta si tu hoja trae menos frames) */
  end: number;
  frameRate: number;
  /** -1 = bucle infinito, 0 = una sola vez */
  repeat: number;
}

export interface AssetEntry {
  /** Clave de textura usada en el juego (NO cambiar) */
  key: string;
  /** Ruta relativa dentro de public/assets */
  url: string;
  /** Ancho de UN frame. Omitir = imagen estatica de una pieza. */
  frameWidth?: number;
  frameHeight?: number;
  /** Frames esperados en la hoja (solo informativo / docs) */
  frames?: number;
  anims?: AssetAnimDef[];
  /** Descripcion corta para la documentacion */
  note: string;
}

function enemy(key: string, file: string, note: string): AssetEntry {
  return {
    key,
    url: `enemies/${file}-sheet.png`,
    frameWidth: 256,
    frameHeight: 256,
    frames: 4,
    anims: [{ key: `${key}-walk`, start: 0, end: 3, frameRate: 11, repeat: -1 }],
    note,
  };
}

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  // ---------- Personaje ----------
  {
    key: 'tito',
    url: 'characters/tito.png',
    frameWidth: TITO_FRAME_WIDTH,
    frameHeight: TITO_FRAME_HEIGHT,
    frames: 12,
    note: '0-1 idle, 2-7 correr, 8 salto, 9 caida, 10 dano, 11 agachado',
  },
  {
    key: TITO_ART_KEY,
    url: 'branding/tito.png',
    note:
      'Ilustracion de Tito de cuerpo entero sobre fondo verde. Si no existe ' +
      'characters/tito.png, el juego recorta esta imagen y genera solo la hoja ' +
      'animada (pies, brazos, salto).',
  },

  // ---------- Enemigos ----------
  enemy('enemy-goomb', 'goomb', 'Conejo explorador: patrulla y salta, se puede pisar'),
  enemy('enemy-spiker', 'spiker', 'Dragon espinoso: acelera hacia Tito, NO se puede pisar'),
  enemy('enemy-flyer', 'flyer', 'Anguila celeste: vuela en onda y se aproxima'),
  enemy('enemy-slider', 'slider', 'Centauro corredor: carga rapidamente'),
  enemy('enemy-ghost', 'ghost', 'Avatar elemental: flota y persigue a Tito'),
  {
    key: 'enemy-boss',
    url: 'enemies/boss.png',
    frameWidth: 64,
    frameHeight: 64,
    frames: 4,
    anims: [{ key: 'enemy-boss-walk', start: 0, end: 3, frameRate: 6, repeat: -1 }],
    note: 'Jefe de mundo. Si no existe se usa goomb escalado x2.2',
  },

  // ---------- Coleccionables y objetos ----------
  {
    key: 'coin',
    url: 'props/coin-silver.png',
    note: 'Moneda conmemorativa de plata con ajolote',
  },
  {
    key: 'coin-gold',
    url: 'props/coin-gold.png',
    note: 'Centenario dorado ficticio de mayor valor',
  },
  {
    key: 'banknote-tito',
    url: 'props/banknote-tito.png',
    note: 'Billete conmemorativo ficticio de Tito',
  },
  {
    key: 'gem',
    url: 'props/gem.png',
    frameWidth: 26,
    frameHeight: 26,
    frames: 6,
    anims: [{ key: 'gem-shine', start: 0, end: 5, frameRate: 10, repeat: -1 }],
    note: 'Brillo que recorre la gema',
  },
  {
    key: 'spring',
    url: 'props/spring.png',
    frameWidth: 32,
    frameHeight: 20,
    frames: 4,
    anims: [{ key: 'spring-bounce', start: 0, end: 3, frameRate: 18, repeat: 0 }],
    note: 'Frame 0 = en reposo. 1-3 = estirandose. Origen abajo.',
  },
  {
    key: 'checkpoint',
    url: 'props/checkpoint.png',
    frameWidth: 44,
    frameHeight: 72,
    frames: 4,
    anims: [
      { key: 'checkpoint-off', start: 0, end: 1, frameRate: 4, repeat: -1 },
      { key: 'checkpoint-on', start: 2, end: 3, frameRate: 8, repeat: -1 },
    ],
    note: 'Bandera moderna 0-1 apagada, 2-3 activada. Origen abajo.',
  },
  {
    key: 'goal-flag',
    url: 'props/goal-flag.png',
    frameWidth: 54,
    frameHeight: 104,
    frames: 4,
    anims: [{ key: 'goal-flag-wave', start: 0, end: 3, frameRate: 6, repeat: -1 }],
    note: 'Bandera de meta ondeando. Origen abajo.',
  },
  {
    key: 'powerup-grande',
    url: 'props/powerup-grande.png',
    frameWidth: 26,
    frameHeight: 26,
    frames: 4,
    anims: [{ key: 'powerup-grande-idle', start: 0, end: 3, frameRate: 8, repeat: -1 }],
    note: 'Power-up de crecer',
  },
  {
    key: 'powerup-fuego',
    url: 'props/powerup-fuego.png',
    frameWidth: 26,
    frameHeight: 26,
    frames: 4,
    anims: [{ key: 'powerup-fuego-idle', start: 0, end: 3, frameRate: 8, repeat: -1 }],
    note: 'Power-up de fuego',
  },
  {
    key: 'powerup-estrella',
    url: 'props/powerup-estrella.png',
    frameWidth: 26,
    frameHeight: 26,
    frames: 4,
    anims: [{ key: 'powerup-estrella-idle', start: 0, end: 3, frameRate: 12, repeat: -1 }],
    note: 'Power-up de invencibilidad',
  },
  {
    key: 'powerup-hielo',
    url: 'props/powerup-hielo.png',
    frameWidth: 26,
    frameHeight: 26,
    frames: 4,
    anims: [{ key: 'powerup-hielo-idle', start: 0, end: 3, frameRate: 8, repeat: -1 }],
    note: 'Power-up de hielo: congela temporalmente a los enemigos',
  },
  {
    key: 'powerup-capa',
    url: 'props/powerup-capa.png',
    frameWidth: 30,
    frameHeight: 28,
    frames: 4,
    anims: [{ key: 'powerup-capa-idle', start: 0, end: 3, frameRate: 10, repeat: -1 }],
    note: 'Capa alada: se carga corriendo y permite planear y volar',
  },
  {
    key: 'platform-h',
    url: 'props/platform-h.png',
    frameWidth: 96,
    frameHeight: 20,
    frames: 4,
    anims: [{ key: 'platform-h-idle', start: 0, end: 3, frameRate: 6, repeat: -1 }],
    note: 'Plataforma movil (3 tiles de ancho)',
  },
  {
    key: 'particle',
    url: 'props/particle.png',
    note: 'Particula suelta 8 x 8, imagen estatica',
  },

  // ---------- Marca ----------
  { key: 'logo', url: 'branding/logo.png', note: 'Logo del menu, 1024 x 512' },

  // ---------- Mapa galactico ----------
  {
    key: 'universe-map',
    url: 'backgrounds/universe-map.png',
    note: 'Fondo 16:9 del selector de mundos con cinco planetas y galaxias',
  },

  // ---------- Tilesets y fondos por mundo ----------
  ...WORLD_IDS.map<AssetEntry>((id) => ({
    key: `tiles-w${id}`,
    url: `tilesets/world-${id}.png`,
    note: '8 tiles de 32x32 en fila: solido, plataforma, ladrillo, ?, poder, pinchos, lava, usado',
  })),
  ...WORLD_IDS.map<AssetEntry>((id) => ({
    key: `sky-w${id}`,
    url: `backgrounds/sky-w${id}.png`,
    note: 'Cielo, se repite en X',
  })),
  ...WORLD_IDS.map<AssetEntry>((id) => ({
    key: `far-w${id}`,
    url: `backgrounds/far-w${id}.png`,
    note: 'Capa de parallax lejana (scroll 0.25)',
  })),
  ...WORLD_IDS.map<AssetEntry>((id) => ({
    key: `scene-w${id}`,
    url: `backgrounds/scene-w${id}.png`,
    note: 'Escena panoramica 16:9 de alta calidad usada como fondo completo',
  })),
];

/** Cuantos frames reales tiene una textura ya cargada (0 si es canvas). */
export function frameCount(scene: Phaser.Scene, key: string): number {
  if (!scene.textures.exists(key)) return 0;
  return scene.textures.get(key).getFrameNames().length;
}

/**
 * Registra las animaciones de un asset recortando los rangos al
 * numero real de frames del PNG. Si solo hay 1 frame no crea nada
 * (la imagen se ve estatica, sin errores en consola).
 */
export function registerAssetAnims(scene: Phaser.Scene, entry: AssetEntry): void {
  if (!entry.anims) return;
  const total = frameCount(scene, entry.key);
  if (total <= 1) return;

  for (const def of entry.anims) {
    if (scene.anims.exists(def.key)) continue;
    const end = Math.min(def.end, total - 1);
    const start = Math.min(def.start, end);
    scene.anims.create({
      key: def.key,
      frames: scene.anims.generateFrameNumbers(entry.key, { start, end }),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
}

/** Registra todas las animaciones del manifiesto (se llama en Preload). */
export function registerAllAssetAnims(scene: Phaser.Scene): void {
  for (const entry of ASSET_MANIFEST) registerAssetAnims(scene, entry);
}

/**
 * Reproduce una animacion solo si existe.
 * Devuelve false cuando el asset es estatico, para poder usar
 * un tween de respaldo en su lugar.
 */
export function playAnim(sprite: Phaser.GameObjects.Sprite, key: string, ignoreIfPlaying = true): boolean {
  if (!sprite.scene?.anims.exists(key)) return false;
  sprite.play(key, ignoreIfPlaying);
  return true;
}
