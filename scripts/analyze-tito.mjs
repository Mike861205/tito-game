/**
 * Analiza apps/game/public/assets/branding/tito.png para calcular, en
 * porcentajes del bounding box del personaje, donde estan cabeza, torso,
 * brazos y piernas. Esos porcentajes se copian a TitoRig.ts.
 *
 * Uso: node scripts/analyze-tito.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../apps/game/public/assets/branding/tito.png');

/** Decodificador PNG minimo (solo lo que produce un export normal: 8 bits RGB/RGBA). */
function decodePng(buffer) {
  let pos = 8; // firma
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];

  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += len + 12;
  }

  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} no soportado`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`colorType ${colorType} no soportado`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const x = line[i];
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`filtro ${filter} desconocido`);
      }
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }

  return { width, height, channels, data: out };
}

/** true si el pixel es fondo croma verde. */
function isGreen(r, g, b) {
  return g > 110 && g > r * 1.45 && g > b * 1.45;
}

const png = decodePng(readFileSync(SRC));
const { width, height, channels, data } = png;
const at = (x, y) => (y * width + x) * channels;

// --- Bounding box del personaje ---
let minX = width; let maxX = -1; let minY = height; let maxY = -1;
const solid = new Uint8Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = at(x, y);
    const a = channels === 4 ? data[i + 3] : 255;
    if (a < 40 || isGreen(data[i], data[i + 1], data[i + 2])) continue;
    solid[y * width + x] = 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
console.log(`Imagen      : ${width}x${height} (canales ${channels})`);
console.log(`Bounding box: x=${minX} y=${minY} w=${bw} h=${bh}`);
console.log(`             pct  x=${(minX / width * 100).toFixed(1)}%  y=${(minY / height * 100).toFixed(1)}%  w=${(bw / width * 100).toFixed(1)}%  h=${(bh / height * 100).toFixed(1)}%`);

// --- Perfil por filas: ancho ocupado y primer/ultimo x ---
console.log('\nPerfil por filas (cada 4% de la altura del personaje):');
console.log('  y%    xIni%  xFin%  ancho%  huecos');
for (let p = 0; p <= 100; p += 4) {
  const y = Math.min(maxY, minY + Math.round((bh - 1) * (p / 100)));
  let first = -1; let last = -1; let count = 0; let runs = 0; let inRun = false;
  for (let x = minX; x <= maxX; x++) {
    const s = solid[y * width + x];
    if (s) {
      if (first < 0) first = x;
      last = x;
      count++;
      if (!inRun) { runs++; inRun = true; }
    } else {
      inRun = false;
    }
  }
  if (first < 0) { console.log(`  ${String(p).padStart(3)}%   (vacio)`); continue; }
  const f = ((first - minX) / bw * 100).toFixed(1);
  const l = ((last - minX) / bw * 100).toFixed(1);
  const w = (count / bw * 100).toFixed(1);
  console.log(`  ${String(p).padStart(3)}%  ${f.padStart(5)}  ${l.padStart(5)}  ${w.padStart(5)}   ${runs}`);
}

// --- Centro de masa por franjas (util para ubicar el eje del cuerpo) ---
console.log('\nCentro horizontal del cuerpo por franja:');
for (const [name, a, b] of [['cabeza', 0, 0.36], ['torso', 0.36, 0.62], ['piernas', 0.62, 1]]) {
  let sum = 0; let n = 0;
  for (let y = minY + Math.round(bh * a); y < minY + Math.round(bh * b); y++) {
    for (let x = minX; x <= maxX; x++) {
      if (solid[y * width + x]) { sum += x; n++; }
    }
  }
  console.log(`  ${name.padEnd(8)} centro=${((sum / n - minX) / bw * 100).toFixed(1)}%  pixeles=${n}`);
}
