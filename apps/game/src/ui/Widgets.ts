import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  color?: number;
  hoverColor?: number;
  disabled?: boolean;
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
  } = options;

  const bg = scene.add
    .rectangle(0, 0, width, height, disabled ? 0x30363d : color, 1)
    .setStrokeStyle(3, 0x0d1117, 0.9);
  const shadow = scene.add.rectangle(0, 5, width, height, 0x000000, 0.35).setDepth(-1);
  const text = scene.add
    .text(0, 0, label, {
      fontSize: `${fontSize}px`,
      fontFamily: 'Trebuchet MS, sans-serif',
      color: disabled ? '#8b949e' : '#ffffff',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [shadow, bg, text]).setSize(width, height);

  if (!disabled) {
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerover', () => {
      bg.setFillStyle(hoverColor);
      scene.tweens.add({ targets: container, scale: 1.04, duration: 100 });
    });
    container.on('pointerout', () => {
      bg.setFillStyle(color);
      scene.tweens.add({ targets: container, scale: 1, duration: 100 });
    });
    container.on('pointerdown', () => {
      audio.play('select');
      scene.tweens.add({ targets: container, scale: 0.96, duration: 60, yoyo: true, onComplete: onClick });
    });
  }

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
