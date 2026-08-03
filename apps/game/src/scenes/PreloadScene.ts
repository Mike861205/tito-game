import Phaser from 'phaser';
import { TITO_FRAME_HEIGHT, TITO_FRAME_WIDTH, WORLDS } from '@tito/shared';
import { createTitoAnimations } from '../objects/Tito';
import {
  createBackgroundTextures,
  createEnemyTextures,
  createLogoTexture,
  createPropTextures,
  createTileset,
  createTitoSpritesheet,
} from '../systems/TextureFactory';

/**
 * Intenta cargar tus assets reales desde /public/assets.
 * Si alguno no existe, genera un placeholder por codigo para que
 * el juego SIEMPRE arranque. Ver assets/README.md para medidas.
 */
export class PreloadScene extends Phaser.Scene {
  private available: string[] = [];

  constructor() {
    super('Preload');
  }

  preload(): void {
    const { width, height } = this.scale;
    this.available = (this.registry.get('availableAssets') as string[] | undefined) ?? [];

    const barBg = this.add.rectangle(width / 2, height / 2 + 60, 420, 22, 0x000000, 0.4);
    const bar = this.add.rectangle(barBg.x - 208, barBg.y, 4, 14, 0xffd54f).setOrigin(0, 0.5);
    const label = this.add
      .text(width / 2, height / 2 + 100, 'Cargando...', { fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5);

    this.load.on('progress', (p: number) => {
      bar.width = 416 * p;
      label.setText(`Cargando ${Math.round(p * 100)}%`);
    });

    this.load.setPath('assets');

    // Solo se cargan los assets que existen (detectados en BootScene).
    if (this.available.includes('tito')) {
      this.load.spritesheet('tito', 'characters/tito.png', {
        frameWidth: TITO_FRAME_WIDTH,
        frameHeight: TITO_FRAME_HEIGHT,
      });
    }
    if (this.available.includes('logo')) {
      this.load.image('logo', 'branding/logo.png');
    }
  }

  create(): void {
    // Placeholders para lo que no exista
    if (!this.textures.exists('tito')) createTitoSpritesheet(this, 'tito');
    if (!this.textures.exists('logo')) createLogoTexture(this, 'logo');

    createEnemyTextures(this);
    createPropTextures(this);
    for (const world of WORLDS) {
      createTileset(this, world);
      createBackgroundTextures(this, world);
    }

    createTitoAnimations(this);

    this.scene.start('Menu');
  }
}
