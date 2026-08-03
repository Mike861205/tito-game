import Phaser from 'phaser';
import { TITO_FRAME_HEIGHT, TITO_FRAME_WIDTH, WORLDS } from '@tito/shared';
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
  private missing = new Set<string>();

  constructor() {
    super('Preload');
  }

  preload(): void {
    const { width, height } = this.scale;

    const barBg = this.add.rectangle(width / 2, height / 2 + 60, 420, 22, 0x000000, 0.4);
    const bar = this.add.rectangle(barBg.x - 208, barBg.y, 4, 14, 0xffd54f).setOrigin(0, 0.5);
    const label = this.add
      .text(width / 2, height / 2 + 100, 'Cargando...', { fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5);

    this.load.on('progress', (p: number) => {
      bar.width = 416 * p;
      label.setText(`Cargando ${Math.round(p * 100)}%`);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.missing.add(file.key);
    });

    this.load.setPath('assets');

    // --- Assets opcionales (si no existen, se generan) ---
    this.load.spritesheet('tito', 'characters/tito.png', {
      frameWidth: TITO_FRAME_WIDTH,
      frameHeight: TITO_FRAME_HEIGHT,
    });
    this.load.image('logo', 'branding/logo.png');
  }

  create(): void {
    // Placeholders para lo que falto
    if (this.missing.has('tito') || !this.textures.exists('tito')) {
      this.textures.remove('tito');
      createTitoSpritesheet(this, 'tito');
    }
    if (this.missing.has('logo') || !this.textures.exists('logo')) {
      this.textures.remove('logo');
      createLogoTexture(this, 'logo');
    }

    createEnemyTextures(this);
    createPropTextures(this);
    for (const world of WORLDS) {
      createTileset(this, world);
      createBackgroundTextures(this, world);
    }

    this.scene.start('Menu');
  }
}
