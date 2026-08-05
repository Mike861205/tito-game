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

  // 0: roca organica. Las curvas y vetas evitan el aspecto de bloques lisos.
  const rock = ctx.createLinearGradient(at(0), 0, at(0) + s, s);
  rock.addColorStop(0, shade(world.ground, 24));
  rock.addColorStop(0.55, hex(world.ground));
  rock.addColorStop(1, shade(world.ground, -32));
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(at(0), 5);
  ctx.quadraticCurveTo(at(0) + 7, 0, at(0) + 14, 3);
  ctx.quadraticCurveTo(at(0) + 23, 7, at(0) + s, 2);
  ctx.lineTo(at(0) + s, s);
  ctx.lineTo(at(0), s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(world.ground, -38);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(at(0) + 4, 13);
  ctx.quadraticCurveTo(at(0) + 13, 9, at(0) + 19, 18);
  ctx.quadraticCurveTo(at(0) + 23, 24, at(0) + 30, 21);
  ctx.moveTo(at(0) + 8, 29);
  ctx.quadraticCurveTo(at(0) + 15, 22, at(0) + 22, 30);
  ctx.stroke();
  ctx.fillStyle = hex(world.groundTop);
  ctx.beginPath();
  ctx.moveTo(at(0), 6);
  ctx.quadraticCurveTo(at(0) + 8, 1, at(0) + 16, 5);
  ctx.quadraticCurveTo(at(0) + 25, 9, at(0) + s, 3);
  ctx.lineTo(at(0) + s, 9);
  ctx.quadraticCurveTo(at(0) + 22, 13, at(0), 10);
  ctx.closePath();
  ctx.fill();

  // 1: PLATFORM (one-way)
  ctx.fillStyle = shade(world.ground, 12);
  ctx.beginPath();
  ctx.moveTo(at(1), 5);
  ctx.quadraticCurveTo(at(1) + 8, 0, at(1) + 16, 4);
  ctx.quadraticCurveTo(at(1) + 25, 8, at(1) + s, 2);
  ctx.lineTo(at(1) + s - 4, 15);
  ctx.quadraticCurveTo(at(1) + 15, 20, at(1) + 3, 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hex(world.groundTop);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(at(1), 5);
  ctx.quadraticCurveTo(at(1) + 9, 0, at(1) + 17, 4);
  ctx.quadraticCurveTo(at(1) + 25, 8, at(1) + s, 2);
  ctx.stroke();

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

  make('checkpoint', 44, 72, (c) => {
    const aura = c.createRadialGradient(22, 24, 2, 22, 24, 22);
    aura.addColorStop(0, 'rgba(126,231,255,0.42)');
    aura.addColorStop(1, 'rgba(126,231,255,0)');
    c.fillStyle = aura;
    c.fillRect(0, 0, 44, 48);

    const pole = c.createLinearGradient(16, 0, 25, 0);
    pole.addColorStop(0, '#40546f');
    pole.addColorStop(0.45, '#f0fbff');
    pole.addColorStop(1, '#536b8e');
    c.fillStyle = pole;
    c.fillRect(19, 9, 6, 57);
    c.fillStyle = '#18243a';
    c.fillRect(17, 65, 10, 4);
    c.fillStyle = '#8be9ff';
    c.beginPath();
    c.arc(22, 8, 6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.stroke();

    const fabric = c.createLinearGradient(23, 13, 43, 36);
    fabric.addColorStop(0, '#8b5cf6');
    fabric.addColorStop(0.55, '#20c7df');
    fabric.addColorStop(1, '#087fbd');
    c.fillStyle = fabric;
    c.beginPath();
    c.moveTo(24, 14);
    c.quadraticCurveTo(34, 10, 43, 17);
    c.lineTo(39, 36);
    c.quadraticCurveTo(32, 30, 24, 34);
    c.closePath();
    c.fill();
    c.strokeStyle = '#baf6ff';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#fff4a8';
    c.font = 'bold 13px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('★', 33, 23);
  });

  make('goal-flag', 54, 104, (c) => {
    const glow = c.createRadialGradient(23, 19, 2, 23, 19, 24);
    glow.addColorStop(0, 'rgba(255,223,92,0.5)');
    glow.addColorStop(1, 'rgba(255,173,30,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, 54, 48);
    const pole = c.createLinearGradient(17, 0, 28, 0);
    pole.addColorStop(0, '#4c566d');
    pole.addColorStop(0.5, '#ffffff');
    pole.addColorStop(1, '#5f6f8d');
    c.fillStyle = pole;
    c.fillRect(20, 8, 7, 91);
    c.fillStyle = '#ffd75e';
    c.beginPath();
    c.arc(23.5, 7, 7, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff6ba';
    c.lineWidth = 2;
    c.stroke();
    const flag = c.createLinearGradient(26, 14, 53, 45);
    flag.addColorStop(0, '#ffcf45');
    flag.addColorStop(0.5, '#ff7043');
    flag.addColorStop(1, '#d52b58');
    c.fillStyle = flag;
    c.beginPath();
    c.moveTo(27, 14);
    c.quadraticCurveTo(41, 9, 53, 18);
    c.lineTo(49, 45);
    c.quadraticCurveTo(39, 37, 27, 43);
    c.closePath();
    c.fill();
    c.strokeStyle = '#fff0a0';
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = 'bold 17px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('T', 39, 27);
    c.fillStyle = '#24314a';
    c.beginPath();
    c.roundRect(14, 97, 19, 6, 3);
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

  make('coin-gold', 28, 28, (c) => {
    c.fillStyle = '#ffc107';
    c.beginPath();
    c.arc(14, 14, 12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff3b0';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#8d5b00';
    c.font = 'bold 15px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('*', 14, 15);
  });

  make('banknote-tito', 46, 26, (c) => {
    c.fillStyle = '#26c6da';
    c.beginPath();
    c.roundRect(1, 2, 44, 22, 4);
    c.fill();
    c.strokeStyle = '#ffd54f';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#6a1b9a';
    c.beginPath();
    c.arc(23, 13, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('T', 23, 13);
  });

  make('enemy-fire', 18, 18, (c) => {
    const g = c.createRadialGradient(8, 10, 1, 9, 9, 9);
    g.addColorStop(0, '#fff59d');
    g.addColorStop(0.45, '#ff9800');
    g.addColorStop(1, '#d84315');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(1, 11);
    c.quadraticCurveTo(5, 3, 10, 1);
    c.quadraticCurveTo(18, 7, 15, 15);
    c.quadraticCurveTo(7, 20, 1, 11);
    c.fill();
  });

  make('enemy-bubble', 18, 18, (c) => {
    c.fillStyle = 'rgba(41,182,246,0.82)';
    c.beginPath();
    c.arc(9, 9, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#e1f5fe';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(6, 5, 2, 0, Math.PI * 2);
    c.fill();
  });

  make('enemy-egg', 26, 32, (c) => {
    c.fillStyle = '#fff8e1';
    c.beginPath();
    c.ellipse(13, 17, 10, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8d6e63';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#7e57c2';
    c.beginPath();
    c.arc(10, 13, 3, 0, Math.PI * 2);
    c.arc(17, 20, 2.5, 0, Math.PI * 2);
    c.fill();
  });

  make('powerup-hielo', 26, 26, (c) => {
    c.fillStyle = '#29b6f6';
    c.beginPath();
    c.arc(13, 13, 11, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#e1f5fe';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      c.beginPath();
      c.moveTo(13 + Math.cos(a) * 8, 13 + Math.sin(a) * 8);
      c.lineTo(13 - Math.cos(a) * 8, 13 - Math.sin(a) * 8);
      c.stroke();
    }
  });

  make('powerup-capa', 30, 28, (c) => {
    const glow = c.createRadialGradient(15, 14, 2, 15, 14, 14);
    glow.addColorStop(0, '#fff7b2');
    glow.addColorStop(0.55, '#ffb83e');
    glow.addColorStop(1, 'rgba(255,92,35,0.15)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(15, 14, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f4512c';
    c.strokeStyle = '#7a1b20';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(9, 5);
    c.quadraticCurveTo(19, 8, 25, 4);
    c.quadraticCurveTo(23, 17, 15, 25);
    c.quadraticCurveTo(10, 18, 6, 9);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#ffd54f';
    c.beginPath();
    c.moveTo(11, 7);
    c.lineTo(19, 9);
    c.lineTo(15, 19);
    c.closePath();
    c.fill();
  });

  make('projectile-fire', 18, 18, (c) => {
    const g = c.createRadialGradient(9, 10, 1, 9, 9, 9);
    g.addColorStop(0, '#fff59d');
    g.addColorStop(0.45, '#ff9800');
    g.addColorStop(1, '#d84315');
    c.fillStyle = g;
    c.beginPath();
    c.arc(9, 9, 8, 0, Math.PI * 2);
    c.fill();
  });

  make('projectile-ice', 18, 18, (c) => {
    c.fillStyle = '#81d4fa';
    c.strokeStyle = '#e1f5fe';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(9, 0);
    c.lineTo(17, 7);
    c.lineTo(12, 18);
    c.lineTo(2, 13);
    c.lineTo(1, 5);
    c.closePath();
    c.fill();
    c.stroke();
  });

  make('throw-rock', 20, 18, (c) => {
    c.fillStyle = '#795548';
    c.strokeStyle = '#3e2723';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(2, 7);
    c.lineTo(7, 1);
    c.lineTo(16, 3);
    c.lineTo(19, 11);
    c.lineTo(13, 17);
    c.lineTo(4, 15);
    c.closePath();
    c.fill();
    c.stroke();
  });

  make('grapple-anchor', 24, 24, (c) => {
    c.strokeStyle = '#ffe082';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(12, 12, 8, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#fff8e1';
    c.beginPath();
    c.arc(12, 12, 3, 0, Math.PI * 2);
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
