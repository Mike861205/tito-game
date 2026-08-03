import Phaser from 'phaser';
import { TILE_SIZE, TITO_FRAME_HEIGHT, TITO_FRAME_WIDTH, type WorldMeta } from '@tito/shared';

/**
 * ============================================================
 * FABRICA DE TEXTURAS PLACEHOLDER
 * ============================================================
 * El juego es 100% jugable SIN archivos de arte: si un asset
 * real no existe en /public/assets, se dibuja aqui por codigo.
 * Cuando pongas tu sprite de Tito y tu logo, estas texturas se
 * reemplazan solas (ver PreloadScene).
 */

/** Indices del tileset generado. -1 = vacio */
export const TILE_INDEX = {
  EMPTY: -1,
  SOLID: 0,
  PLATFORM: 1,
  BRICK: 2,
  QUESTION: 3,
  POWER: 4,
  SPIKE: 5,
  LAVA: 6,
  USED: 7,
} as const;

const TILESET_COLUMNS = 8;

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function shade(color: number, amount: number): string {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function getCtx(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, width, height);
  return tex?.getContext() ?? null;
}

function refresh(scene: Phaser.Scene, key: string): void {
  (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
}

/** Tileset del mundo (8 tiles de 32x32). */
export function createTileset(scene: Phaser.Scene, world: WorldMeta): string {
  const key = `tiles-w${world.id}`;
  if (scene.textures.exists(key)) return key;

  const s = TILE_SIZE;
  const ctx = getCtx(scene, key, s * TILESET_COLUMNS, s);
  if (!ctx) return key;

  const at = (i: number): number => i * s;

  // 0: SOLID (tierra con capa superior)
  ctx.fillStyle = hex(world.ground);
  ctx.fillRect(at(0), 0, s, s);
  ctx.fillStyle = hex(world.groundTop);
  ctx.fillRect(at(0), 0, s, 8);
  ctx.fillStyle = shade(world.ground, -25);
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(at(0) + ((i * 11) % (s - 4)), 12 + ((i * 7) % 16), 3, 3);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.strokeRect(at(0) + 0.5, 0.5, s - 1, s - 1);

  // 1: PLATFORM (one-way)
  ctx.fillStyle = hex(world.groundTop);
  ctx.fillRect(at(1), 0, s, 10);
  ctx.fillStyle = shade(world.ground, -10);
  ctx.fillRect(at(1), 10, s, 4);

  // 2: BRICK
  ctx.fillStyle = shade(world.ground, 20);
  ctx.fillRect(at(2), 0, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(at(2), s / 2);
  ctx.lineTo(at(2) + s, s / 2);
  ctx.moveTo(at(2) + s / 2, 0);
  ctx.lineTo(at(2) + s / 2, s / 2);
  ctx.moveTo(at(2) + s / 4, s / 2);
  ctx.lineTo(at(2) + s / 4, s);
  ctx.stroke();

  // 3: QUESTION
  ctx.fillStyle = hex(world.accent);
  ctx.fillRect(at(3), 0, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeRect(at(3) + 2.5, 2.5, s - 5, s - 5);
  ctx.fillStyle = '#3b2200';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', at(3) + s / 2, s / 2 + 1);

  // 4: POWER (bloque con estrella)
  ctx.fillStyle = '#e53935';
  ctx.fillRect(at(4), 0, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeRect(at(4) + 2.5, 2.5, s - 5, s - 5);
  ctx.fillStyle = '#ffe082';
  ctx.fillText('*', at(4) + s / 2, s / 2 + 3);

  // 5: SPIKE
  ctx.clearRect(at(5), 0, s, s);
  ctx.fillStyle = '#cfd8dc';
  for (let i = 0; i < 4; i++) {
    const x = at(5) + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, s);
    ctx.lineTo(x + 4, s - 16);
    ctx.lineTo(x + 8, s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#78909c';
  ctx.fillRect(at(5), s - 4, s, 4);

  // 6: LAVA / agua mortal
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, '#ff7043');
  grad.addColorStop(1, '#b71c1c');
  ctx.fillStyle = grad;
  ctx.fillRect(at(6), 0, s, s);
  ctx.fillStyle = 'rgba(255,224,130,0.6)';
  ctx.fillRect(at(6), 0, s, 4);

  // 7: USED (bloque ya golpeado)
  ctx.fillStyle = shade(world.ground, -20);
  ctx.fillRect(at(7), 0, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(at(7) + 2.5, 2.5, s - 5, s - 5);

  refresh(scene, key);
  return key;
}

/** Hoja de sprites placeholder de Tito (12 frames de 48x48). */
export function createTitoSpritesheet(scene: Phaser.Scene, key = 'tito'): void {
  if (scene.textures.exists(key)) return;

  const fw = TITO_FRAME_WIDTH;
  const fh = TITO_FRAME_HEIGHT;
  const frames = 12;
  const srcKey = `${key}-canvas`;
  const ctx = getCtx(scene, srcKey, fw * frames, fh);
  if (!ctx) return;

  const body = '#2f80ed';
  const skin = '#ffcc80';
  const cap = '#e53935';
  const shoe = '#4e342e';

  for (let f = 0; f < frames; f++) {
    const ox = f * fw;
    // f0-1 idle, f2-7 correr, f8 salto, f9 caida, f10 dano, f11 agachado
    const run = f >= 2 && f <= 7;
    const phase = run ? Math.sin(((f - 2) / 6) * Math.PI * 2) : 0;
    const bob = f === 1 ? 1 : run ? Math.round(Math.abs(phase) * 2) : 0;
    const crouch = f === 11;
    const hurt = f === 10;
    const jump = f === 8;
    const fall = f === 9;

    const baseY = 44 - (crouch ? 6 : 0);
    const bodyH = crouch ? 14 : 20;
    const bodyY = baseY - bodyH - 6 + bob;

    ctx.save();
    if (hurt) ctx.globalAlpha = 0.85;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ox + fw / 2, 45, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Piernas
    ctx.fillStyle = shoe;
    const legSpread = run ? Math.round(phase * 6) : jump || fall ? 4 : 2;
    ctx.fillRect(ox + fw / 2 - 9 - legSpread, baseY - 6, 7, 6);
    ctx.fillRect(ox + fw / 2 + 2 + legSpread, baseY - 6, 7, 6);

    // Cuerpo
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(ox + fw / 2 - 11, bodyY + 12, 22, bodyH, 6);
    ctx.fill();

    // Brazos
    ctx.fillStyle = skin;
    const armY = jump ? bodyY + 8 : bodyY + 16;
    ctx.fillRect(ox + fw / 2 - 16, armY + (run ? Math.round(phase * 3) : 0), 6, 10);
    ctx.fillRect(ox + fw / 2 + 10, armY - (run ? Math.round(phase * 3) : 0), 6, 10);

    // Cabeza
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(ox + fw / 2, bodyY + 4, 10, 0, Math.PI * 2);
    ctx.fill();

    // Gorra
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(ox + fw / 2, bodyY + 2, 10, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(ox + fw / 2 - 2, bodyY - 8, 14, 4);

    // Ojos
    ctx.fillStyle = '#212121';
    if (hurt) {
      ctx.fillRect(ox + fw / 2 - 1, bodyY + 3, 6, 2);
      ctx.fillRect(ox + fw / 2 - 8, bodyY + 3, 6, 2);
    } else {
      ctx.fillRect(ox + fw / 2 + 1, bodyY + 2, 3, 4);
      ctx.fillRect(ox + fw / 2 - 5, bodyY + 2, 3, 4);
    }

    // Boca
    ctx.strokeStyle = '#8d4b1f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox + fw / 2 - 1, bodyY + 8, 3, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  refresh(scene, srcKey);
  const source = scene.textures.get(srcKey).getSourceImage() as HTMLCanvasElement;
  scene.textures.addSpriteSheet(key, source as unknown as HTMLImageElement, {
    frameWidth: fw,
    frameHeight: fh,
  });
}

/** Enemigos placeholder. */
export function createEnemyTextures(scene: Phaser.Scene): void {
  const defs: Array<{ key: string; color: string; shape: 'blob' | 'spike' | 'wing' | 'gear' | 'ghost' }> = [
    { key: 'enemy-goomb', color: '#8d6e63', shape: 'blob' },
    { key: 'enemy-spiker', color: '#7e57c2', shape: 'spike' },
    { key: 'enemy-flyer', color: '#26c6da', shape: 'wing' },
    { key: 'enemy-slider', color: '#ef5350', shape: 'gear' },
    { key: 'enemy-ghost', color: '#eceff1', shape: 'ghost' },
  ];

  for (const def of defs) {
    if (scene.textures.exists(def.key)) continue;
    const size = 32;
    const ctx = getCtx(scene, def.key, size, size);
    if (!ctx) continue;

    ctx.fillStyle = def.color;
    switch (def.shape) {
      case 'blob':
        ctx.beginPath();
        ctx.ellipse(16, 20, 13, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(6, 26, 7, 5);
        ctx.fillRect(19, 26, 7, 5);
        break;
      case 'spike':
        ctx.beginPath();
        ctx.arc(16, 18, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ede7f6';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(16 + Math.cos(a) * 10, 18 + Math.sin(a) * 10);
          ctx.lineTo(16 + Math.cos(a) * 16, 18 + Math.sin(a) * 16);
          ctx.lineTo(16 + Math.cos(a + 0.35) * 10, 18 + Math.sin(a + 0.35) * 10);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'wing':
        ctx.beginPath();
        ctx.ellipse(16, 16, 9, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b2ebf2';
        ctx.beginPath();
        ctx.ellipse(5, 14, 6, 3, -0.4, 0, Math.PI * 2);
        ctx.ellipse(27, 14, 6, 3, 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'gear':
        ctx.fillRect(3, 8, 26, 18);
        ctx.fillStyle = '#37474f';
        ctx.fillRect(3, 22, 26, 4);
        break;
      case 'ghost':
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(16, 14, 11, Math.PI, 0);
        ctx.lineTo(27, 26);
        ctx.lineTo(21, 22);
        ctx.lineTo(16, 26);
        ctx.lineTo(11, 22);
        ctx.lineTo(5, 26);
        ctx.closePath();
        ctx.fill();
        break;
    }
    // Ojos comunes
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, 12, 5, 5);
    ctx.fillRect(18, 12, 5, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(12, 14, 2, 3);
    ctx.fillRect(20, 14, 2, 3);
    refresh(scene, def.key);
  }
}

/** Coleccionables, meta, checkpoint, resorte, plataformas moviles, particulas. */
export function createPropTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void => {
    if (scene.textures.exists(key)) return;
    const ctx = getCtx(scene, key, w, h);
    if (!ctx) return;
    draw(ctx);
    refresh(scene, key);
  };

  make('coin', 24, 24, (c) => {
    c.fillStyle = '#ffd54f';
    c.beginPath();
    c.arc(12, 12, 10, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#f9a825';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#fff59d';
    c.fillRect(10, 5, 4, 14);
  });

  make('gem', 26, 26, (c) => {
    c.fillStyle = '#7c4dff';
    c.beginPath();
    c.moveTo(13, 1);
    c.lineTo(25, 10);
    c.lineTo(13, 25);
    c.lineTo(1, 10);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath();
    c.moveTo(13, 1);
    c.lineTo(19, 10);
    c.lineTo(13, 14);
    c.closePath();
    c.fill();
  });

  make('spring', 32, 20, (c) => {
    c.fillStyle = '#455a64';
    c.fillRect(4, 14, 24, 6);
    c.strokeStyle = '#90a4ae';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(8, 14);
    c.lineTo(24, 10);
    c.lineTo(8, 7);
    c.lineTo(24, 4);
    c.stroke();
    c.fillStyle = '#ef5350';
    c.fillRect(2, 0, 28, 5);
  });

  make('checkpoint', 24, 56, (c) => {
    c.fillStyle = '#607d8b';
    c.fillRect(9, 6, 5, 50);
    c.fillStyle = '#26a69a';
    c.beginPath();
    c.moveTo(14, 8);
    c.lineTo(24, 14);
    c.lineTo(14, 20);
    c.closePath();
    c.fill();
  });

  make('goal-flag', 32, 96, (c) => {
    c.fillStyle = '#cfd8dc';
    c.fillRect(13, 0, 6, 96);
    c.fillStyle = '#ffd54f';
    c.beginPath();
    c.arc(16, 4, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e53935';
    c.beginPath();
    c.moveTo(19, 12);
    c.lineTo(32, 22);
    c.lineTo(19, 32);
    c.closePath();
    c.fill();
  });

  make('platform-h', 96, 20, (c) => {
    c.fillStyle = '#8d6e63';
    c.fillRect(0, 0, 96, 20);
    c.fillStyle = '#a1887f';
    c.fillRect(0, 0, 96, 6);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.strokeRect(0.5, 0.5, 95, 19);
  });

  make('particle', 8, 8, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(4, 4, 4, 0, Math.PI * 2);
    c.fill();
  });

  make('powerup-grande', 26, 26, (c) => {
    c.fillStyle = '#66bb6a';
    c.beginPath();
    c.arc(13, 16, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8f5e9';
    c.beginPath();
    c.arc(13, 8, 8, Math.PI, 0);
    c.fill();
  });

  make('powerup-fuego', 26, 26, (c) => {
    c.fillStyle = '#ff7043';
    c.beginPath();
    c.arc(13, 13, 11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffe082';
    c.beginPath();
    c.arc(13, 15, 5, 0, Math.PI * 2);
    c.fill();
  });

  make('powerup-estrella', 26, 26, (c) => {
    c.fillStyle = '#ffd54f';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 12 : 5;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = 13 + Math.cos(a) * r;
      const y = 13 + Math.sin(a) * r;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
  });
}

/** Logo placeholder por si aun no cargas el tuyo. */
export function createLogoTexture(scene: Phaser.Scene, key = 'logo'): void {
  if (scene.textures.exists(key)) return;
  const w = 512;
  const h = 256;
  const ctx = getCtx(scene, key, w, h);
  if (!ctx) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 78px Trebuchet MS, sans-serif';

  const grad = ctx.createLinearGradient(0, 60, 0, 150);
  grad.addColorStop(0, '#ffe082');
  grad.addColorStop(1, '#ef6c00');
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#3e2723';
  ctx.strokeText('TITO', w / 2, 100);
  ctx.fillStyle = grad;
  ctx.fillText('TITO', w / 2, 100);

  ctx.font = 'bold 52px Trebuchet MS, sans-serif';
  ctx.strokeText('GAME', w / 2, 170);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('GAME', w / 2, 170);

  refresh(scene, key);
}

/** Fondo con degradado + parallax simple para cada mundo. */
export function createBackgroundTextures(scene: Phaser.Scene, world: WorldMeta): {
  sky: string;
  far: string;
} {
  const skyKey = `sky-w${world.id}`;
  const farKey = `far-w${world.id}`;

  if (!scene.textures.exists(skyKey)) {
    const ctx = getCtx(scene, skyKey, 64, 540);
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 540);
      g.addColorStop(0, hex(world.skyTop));
      g.addColorStop(1, hex(world.skyBottom));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 540);
      refresh(scene, skyKey);
    }
  }

  if (!scene.textures.exists(farKey)) {
    const ctx = getCtx(scene, farKey, 512, 220);
    if (ctx) {
      ctx.clearRect(0, 0, 512, 220);
      ctx.fillStyle = shade(world.ground, 45);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 7; i++) {
        const x = i * 80;
        const peak = 60 + ((i * 37) % 90);
        ctx.beginPath();
        ctx.moveTo(x - 40, 220);
        ctx.lineTo(x + 40, 220 - peak);
        ctx.lineTo(x + 120, 220);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      refresh(scene, farKey);
    }
  }

  return { sky: skyKey, far: farKey };
}
