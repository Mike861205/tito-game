import Phaser from 'phaser';
import { WORLDS } from '@tito/shared';
import { createTitoAnimations } from '../objects/Tito';
import { ASSET_MANIFEST, registerAllAssetAnims } from '../systems/AssetManifest';
import {
  createBackgroundTextures,
  createEnemyTextures,
  createLogoTexture,
  createPropTextures,
  createTileset,
  createTitoSpritesheet,
} from '../systems/TextureFactory';
import { buildTitoSheetFromArt, TITO_ART_KEY, TITO_HD_KEY } from '../systems/TitoRig';

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
    for (const entry of ASSET_MANIFEST) {
      if (!this.available.includes(entry.key)) continue;
      if (entry.frameWidth && entry.frameHeight) {
        this.load.spritesheet(entry.key, entry.url, {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
        });
      } else {
        this.load.image(entry.key, entry.url);
      }
    }
  }

  create(): void {
    // Tito: primero la hoja propia, si no la que se hornea del arte de branding.
    if (!this.textures.exists('tito')) buildTitoSheetFromArt(this);
    if (!this.textures.exists('tito')) createTitoSpritesheet(this, 'tito');
    // Version grande y sin pixelar para el retrato del menu.
    buildTitoSheetFromArt(this, TITO_ART_KEY, TITO_HD_KEY, 4);
    if (!this.textures.exists('logo')) createLogoTexture(this, 'logo');

    createEnemyTextures(this);
    createPropTextures(this);
    for (const world of WORLDS) {
      createTileset(this, world);
      createBackgroundTextures(this, world);
    }

    createTitoAnimations(this);
    createTitoAnimations(this, TITO_HD_KEY);
    registerAllAssetAnims(this);

    this.scene.start('Menu');
  }
}
