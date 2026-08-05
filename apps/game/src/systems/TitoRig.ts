import Phaser from 'phaser';
import { TITO_FRAME_HEIGHT, TITO_FRAME_WIDTH } from '@tito/shared';

/**
 * ============================================================
 * RIG DE TITO (recorte + marioneta)
 * ============================================================
 * Toma la ilustracion de `branding/tito.png` (fondo croma verde),
 * la limpia, la recorta en partes del cuerpo y hornea una hoja de
 * 12 frames de 48x48 con poses reales: pies que caminan, brazos que
 * se balancean, salto, caida, golpe y agachado.
 *
 * Todo se hace en canvas al arrancar el juego, asi que basta con
 * cambiar el PNG del arte para que las animaciones se regeneren.
 */

/** Clave de la ilustracion original (branding/tito.png). */
export const TITO_ART_KEY = 'tito-art';

/** Hoja grande (192x192 por frame) para retratos de menu. */
export const TITO_HD_KEY = 'tito-hd';

/** Cuantas veces se supermuestrea antes de reducir a 48x48. */
const SUPERSAMPLE = 4;

/** Altura del personaje dentro del frame de 48px. */
const CHAR_HEIGHT = 43;
/** Linea del suelo dentro del frame (los zapatos apoyan aqui). */
const FEET_Y = 46.6;
const CENTER_X = TITO_FRAME_WIDTH / 2;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Una parte del cuerpo. `rect` es el recorte y `joint` la articulacion
 * sobre la que gira; ambos en fraccion del bounding box del personaje.
 * Con angulo 0 todas las partes reconstruyen la ilustracion original.
 */
interface PartDef {
  rect: Box;
  joint: { x: number; y: number };
}

const PARTS = {
  cape: { rect: { x: 0.0, y: 0.33, w: 0.35, h: 0.36 }, joint: { x: 0.32, y: 0.42 } },
  legBack: { rect: { x: 0.12, y: 0.57, w: 0.42, h: 0.45 }, joint: { x: 0.44, y: 0.605 } },
  legFront: { rect: { x: 0.46, y: 0.57, w: 0.56, h: 0.45 }, joint: { x: 0.6, y: 0.605 } },
  torso: { rect: { x: 0.26, y: 0.33, w: 0.54, h: 0.36 }, joint: { x: 0.5, y: 0.4 } },
  armBack: { rect: { x: 0.29, y: 0.43, w: 0.2, h: 0.24 }, joint: { x: 0.47, y: 0.45 } },
  armFront: { rect: { x: 0.7, y: 0.25, w: 0.32, h: 0.34 }, joint: { x: 0.76, y: 0.56 } },
  head: { rect: { x: 0.19, y: 0.0, w: 0.68, h: 0.43 }, joint: { x: 0.52, y: 0.4 } },
} as const satisfies Record<string, PartDef>;

/** Orden de dibujo: lo primero queda al fondo. */
const DRAW_ORDER = ['cape', 'legBack', 'legFront', 'torso', 'armBack', 'armFront', 'head'] as const;

type PartName = keyof typeof PARTS;

/** Angulos en grados. Positivo = horario (el pie va hacia atras). */
type Pose = Record<PartName, number> & {
  /** Desplazamiento vertical del cuerpo (px de frame, + = abajo). */
  bob: number;
  /** Inclinacion del cuerpo entero. */
  lean: number;
  /** Aplastado vertical (1 = normal). */
  squash: number;
};

function pose(p: Partial<Pose>): Pose {
  return {
    bob: 0,
    lean: 0,
    squash: 1,
    cape: 0,
    legBack: 0,
    legFront: 0,
    torso: 0,
    armBack: 0,
    armFront: 0,
    head: 0,
    ...p,
  };
}

/**
 * 12 poses: 0-1 quieto, 2-7 ciclo de carrera, 8 salto, 9 caida,
 * 10 golpe, 11 agachado. Coincide con `createTitoAnimations`.
 */
const POSES: Pose[] = [
  // 0-1 QUIETO (respiracion)
  pose({}),
  pose({ bob: 0.6, squash: 0.99, head: 1.5, armFront: -3, armBack: 2, cape: 3 }),

  // 2-7 CARRERA (contacto / apoyo / impulso, x2)
  pose({ legFront: -24, legBack: 22, armFront: 15, armBack: -17, lean: 4, bob: 0, cape: 5, head: -1.5 }),
  pose({ legFront: -12, legBack: 11, armFront: 8, armBack: -9, lean: 5, bob: 1, cape: 2 }),
  pose({ legFront: 6, legBack: -7, armFront: -4, armBack: 6, lean: 4, bob: -1, cape: 7, head: 1.5 }),
  pose({ legFront: 22, legBack: -24, armFront: -17, armBack: 15, lean: 4, bob: 0, cape: 5, head: -1.5 }),
  pose({ legFront: 11, legBack: -12, armFront: -9, armBack: 8, lean: 5, bob: 1, cape: 2 }),
  pose({ legFront: -7, legBack: 6, armFront: 6, armBack: -4, lean: 4, bob: -1, cape: 7, head: 1.5 }),

  // 8 SALTO (rodillas recogidas, brazos arriba)
  pose({ legFront: -30, legBack: 16, armFront: -26, armBack: 20, lean: 5, bob: -0.8, cape: 9, head: -3 }),
  // 9 CAIDA (piernas abiertas, brazos abiertos)
  pose({ legFront: 18, legBack: -20, armFront: -12, armBack: -16, lean: -4, bob: 0.4, cape: 12, head: 4 }),
  // 10 GOLPE (echado hacia atras)
  pose({ legFront: 14, legBack: -10, armFront: -20, armBack: -24, lean: -12, bob: -0.4, cape: 14, head: 7 }),
  // 11 AGACHADO
  pose({ squash: 0.78, legFront: -17, legBack: 15, armFront: 8, armBack: -7, head: 2 }),
];

/** Quita el fondo croma verde y devuelve el canvas limpio + el bounding box. */
function cleanChroma(image: HTMLImageElement | HTMLCanvasElement): { canvas: HTMLCanvasElement; box: Box } | null {
  const w = image.width;
  const h = image.height;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      const greenness = g - Math.max(r, b);

      // Recorte suave: el borde queda semitransparente en vez de dentado.
      if (greenness > 60) {
        d[i + 3] = 0;
        continue;
      }
      if (greenness > 22) {
        d[i + 3] = Math.round(d[i + 3]! * (1 - (greenness - 22) / 38));
        // Quita el reflejo verde del contorno.
        d[i + 1] = Math.max(r, b) + 22;
      }

      if (d[i + 3]! > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  ctx.putImageData(img, 0, 0);
  return { canvas, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

function drawPose(
  ctx: CanvasRenderingContext2D,
  art: HTMLCanvasElement,
  box: Box,
  originX: number,
  p: Pose,
  zoom: number,
): void {
  const ss = SUPERSAMPLE * zoom;
  const artToFrame = CHAR_HEIGHT / box.h;
  const charW = box.w * artToFrame;
  const scale = artToFrame * ss;

  const jointX = (f: number): number => originX + (CENTER_X + (f - 0.5) * charW) * ss;
  const jointY = (f: number): number => (FEET_Y - (1 - f) * CHAR_HEIGHT) * ss;

  const pivotX = originX + CENTER_X * ss;
  const pivotY = FEET_Y * ss;

  ctx.save();
  ctx.translate(pivotX, pivotY + p.bob * ss);
  ctx.rotate(Phaser.Math.DegToRad(p.lean));
  ctx.scale(1, p.squash);
  ctx.translate(-pivotX, -pivotY);

  for (const name of DRAW_ORDER) {
    const part: PartDef = PARTS[name];
    const sx = box.x + part.rect.x * box.w;
    const sy = box.y + part.rect.y * box.h;
    const sw = Math.min(part.rect.w * box.w, box.x + box.w - sx);
    const sh = Math.min(part.rect.h * box.h, box.y + box.h - sy);
    const dw = sw * scale;
    const dh = sh * scale;
    const offX = ((part.joint.x - part.rect.x) / part.rect.w) * dw;
    const offY = ((part.joint.y - part.rect.y) / part.rect.h) * dh;

    ctx.save();
    ctx.translate(jointX(part.joint.x), jointY(part.joint.y));
    ctx.rotate(Phaser.Math.DegToRad(p[name]));
    ctx.drawImage(art, sx, sy, sw, sh, -offX, -offY, dw, dh);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Genera la hoja `tito` (12 frames de 48x48) a partir de la ilustracion.
 * Con `frameScale` > 1 hornea una version grande (para retratos de menu),
 * que ademas se filtra en LINEAR para que no se vea difuminada.
 * Devuelve false si el arte no esta cargado, para poder caer al placeholder.
 */
export function buildTitoSheetFromArt(
  scene: Phaser.Scene,
  artKey = TITO_ART_KEY,
  outKey = 'tito',
  frameScale = 1,
): boolean {
  if (!scene.textures.exists(artKey)) return false;

  const source = scene.textures.get(artKey).getSourceImage();
  if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) return false;

  const cleaned = cleanChroma(source);
  if (!cleaned) return false;

  const ss = SUPERSAMPLE;
  const frames = POSES.length;
  const fw = TITO_FRAME_WIDTH * frameScale;
  const fh = TITO_FRAME_HEIGHT * frameScale;

  const big = document.createElement('canvas');
  big.width = fw * ss * frames;
  big.height = fh * ss;
  const bctx = big.getContext('2d');
  if (!bctx) return false;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';

  POSES.forEach((p, i) => drawPose(bctx, cleaned.canvas, cleaned.box, i * fw * ss, p, frameScale));

  const canvasKey = `${outKey}-rig`;
  if (scene.textures.exists(canvasKey)) scene.textures.remove(canvasKey);
  const tex = scene.textures.createCanvas(canvasKey, fw * frames, fh);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return false;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(big, 0, 0, big.width, big.height, 0, 0, fw * frames, fh);
  tex.refresh();

  if (scene.textures.exists(outKey)) scene.textures.remove(outKey);
  const sheet = scene.textures.addSpriteSheet(
    outKey,
    tex.getSourceImage() as unknown as HTMLImageElement,
    { frameWidth: fw, frameHeight: fh },
  );
  if (frameScale > 1) sheet?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}
