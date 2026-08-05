import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  color?: number;
  hoverColor?: number;
  disabled?: boolean;
  /** Radio de las esquinas. Por defecto ~1/3 del alto (estilo "pill" suave). */
  radius?: number;
  /** Halo pulsante para el boton principal de la pantalla. */
  glow?: boolean;
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color entero. */
function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number): number =>
    Phaser.Math.Clamp(Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount)), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const {
    width = 300,
    height = 54,
    fontSize = 22,
    color = 0x1f6feb,
    hoverColor = 0x2f81f7,
    disabled = false,
    radius = Math.round(Math.min(height / 3, 18)),
    glow = false,
  } = options;

  const halfW = width / 2;
  const halfH = height / 2;
  const baseColor = disabled ? 0x30363d : color;

  // El contenedor exterior NUNCA se escala ni se mueve: asi el area de clic
  // coincide siempre con lo que se ve (antes la sombra sobresalia y esa franja
  // no respondia al clic).
  const container = scene.add.container(x, y);
  const visual = scene.add.container(0, 0);
  container.add(visual);

  const glowG = scene.add.graphics();
  const shadowG = scene.add.graphics();
  const faceG = scene.add.graphics();
  const text = scene.add
    .text(0, -1, label, {
      fontSize: `${fontSize}px`,
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      color: disabled ? '#8b949e' : '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5);
  text.setShadow(0, 2, 'rgba(0,0,0,0.45)', 2, false, true);
  // Etiquetas largas: se encogen para no salirse del boton.
  if (text.width > width - 26) text.setScale((width - 26) / text.width);

  visual.add([glowG, shadowG, faceG, text]);

  shadowG.fillStyle(0x000000, 0.32);
  shadowG.fillRoundedRect(-halfW + 2, -halfH + 6, width - 4, height, radius);
  shadowG.fillStyle(0x000000, 0.22);
  shadowG.fillRoundedRect(-halfW, -halfH + 3, width, height, radius);

  const paintFace = (fill: number): void => {
    faceG.clear();
    // Canto inferior oscuro: da volumen sin necesitar degradados reales.
    faceG.fillStyle(shade(fill, -0.4), 1);
    faceG.fillRoundedRect(-halfW, -halfH, width, height, radius);
    faceG.fillStyle(fill, 1);
    faceG.fillRoundedRect(-halfW, -halfH, width, height - 4, radius);
    // Brillo superior tipo cristal.
    faceG.fillStyle(shade(fill, 0.6), 0.28);
    faceG.fillRoundedRect(-halfW + 4, -halfH + 4, width - 8, (height - 4) * 0.45, {
      tl: Math.max(2, radius - 3),
      tr: Math.max(2, radius - 3),
      bl: 6,
      br: 6,
    });
    faceG.lineStyle(2, shade(fill, 0.55), 0.9);
    faceG.strokeRoundedRect(-halfW + 1, -halfH + 1, width - 2, height - 6, radius);
  };

  paintFace(baseColor);

  if (glow && !disabled) {
    glowG.lineStyle(6, hoverColor, 0.55);
    glowG.strokeRoundedRect(-halfW - 3, -halfH - 3, width + 6, height + 2, radius + 3);
    glowG.setAlpha(0.25);
    scene.tweens.add({
      targets: glowG,
      alpha: 0.7,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  if (disabled) return container;

  // Zona sensible con un pequeno margen extra (mejor puntería con el dedo).
  const pad = 4;
  // Phaser normaliza los puntos de un Container sumando su displayOrigin. Un
  // Rectangle con coordenadas negativas solo cubre la mitad izquierda. Al
  // definir el tamano total, Phaser crea desde 0,0 una zona centrada que cubre
  // toda la superficie visual, incluidos el borde y la sombra.
  container.setSize(width + pad * 2, height + pad * 2 + 6);
  container.setInteractive({ useHandCursor: true });

  const moveTo = (faceY: number, shadowY: number, shadowAlpha: number, scale: number): void => {
    scene.tweens.killTweensOf([faceG, text, shadowG, visual]);
    scene.tweens.add({ targets: [faceG, text], y: faceY, duration: 110, ease: 'Quad.easeOut' });
    scene.tweens.add({
      targets: shadowG,
      y: shadowY,
      alpha: shadowAlpha,
      duration: 110,
      ease: 'Quad.easeOut',
    });
    scene.tweens.add({ targets: visual, scale, duration: 110, ease: 'Quad.easeOut' });
  };

  let hovered = false;
  const idle = (): void => {
    paintFace(baseColor);
    moveTo(0, 0, 1, 1);
  };
  const hover = (): void => {
    paintFace(hoverColor);
    moveTo(-4, 4, 1, 1.03);
  };
  const down = (): void => {
    paintFace(shade(hoverColor, -0.12));
    moveTo(3, -2, 0.6, 0.985);
  };

  let lastFiredAt = -Infinity;
  const press = (): void => {
    // Antirrebote: evita que pointerdown y pointerup cuenten como dos clics,
    // pero deja volver a pulsar el boton mas adelante.
    const now = scene.time.now;
    if (now - lastFiredAt < 250) return;
    lastFiredAt = now;

    // El sonido nunca debe poder tumbar el clic: la primera pulsacion es la
    // que crea el AudioContext y es justo donde puede fallar.
    try {
      audio.play('select');
    } catch {
      /* sin audio */
    }
    onClick();
  };

  container.on('pointerover', () => {
    hovered = true;
    hover();
  });
  container.on('pointerout', () => {
    hovered = false;
    idle();
  });
  container.on('pointerdown', () => {
    down();
    press();
  });
  // Respaldo: si el navegador se come el pointerdown (primer clic tras dar
  // foco a la ventana), el pointerup igual dispara la accion.
  container.on('pointerup', () => {
    if (hovered) hover();
    else idle();
    press();
  });

  return container;
}

export function createTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 42,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontSize: `${size}px`,
      fontFamily: 'Trebuchet MS, sans-serif',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#3e2723',
      strokeThickness: 6,
    })
    .setOrigin(0.5);
}

export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.88,
): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(x, y, width, height, 0x0d1117, alpha)
    .setStrokeStyle(4, 0xffd54f, 0.85);
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
