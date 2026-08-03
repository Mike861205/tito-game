import Phaser from 'phaser';
import { LEVELS, LEVELS_PER_WORLD, WORLDS, getLevelDesign, levelId } from '@tito/shared';
import { save } from '../systems/SaveManager';
import { audio } from '../systems/AudioManager';
import { createButton, createPanel, createTitle } from '../ui/Widgets';

/** Mapa de los 5 mundos con sus 4 niveles cada uno. */
export class WorldMapScene extends Phaser.Scene {
  private selectedWorld = 1;

  constructor() {
    super('WorldMap');
  }

  create(): void {
    this.selectedWorld = save.progress.currentWorld;
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    const { width, height } = this.scale;
    const world = WORLDS.find((w) => w.id === this.selectedWorld)!;

    this.add.rectangle(0, 0, width, height, world.skyBottom, 1).setOrigin(0);
    this.add.tileSprite(0, 0, width, height, `sky-w${world.id}`).setOrigin(0).setAlpha(0.9);
    this.add
      .tileSprite(0, height - 260, width, 220, `far-w${world.id}`)
      .setOrigin(0)
      .setAlpha(0.8);

    createTitle(this, width / 2, 48, 'MAPA DE MUNDOS', 34);

    // --- Selector de mundos ---
    WORLDS.forEach((w, i) => {
      const x = 110 + i * 185;
      const unlocked = save.isUnlocked(w.id, 1);
      const selected = w.id === this.selectedWorld;

      const card = this.add
        .rectangle(x, 130, 160, 76, unlocked ? w.ground : 0x30363d, selected ? 1 : 0.75)
        .setStrokeStyle(selected ? 4 : 2, selected ? 0xffd54f : 0x0d1117);

      this.add
        .text(x, 112, `MUNDO ${w.id}`, { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.add
        .text(x, 136, unlocked ? w.name : 'Bloqueado', {
          fontSize: '13px',
          color: unlocked ? '#e6edf3' : '#8b949e',
          wordWrap: { width: 150 },
          align: 'center',
        })
        .setOrigin(0.5);

      const worldStars = Array.from({ length: LEVELS_PER_WORLD }, (_, k) =>
        save.progress.levelStats[levelId(w.id, k + 1)]?.stars ?? 0,
      ).reduce((a, b) => a + b, 0);
      this.add
        .text(x, 158, `${worldStars}/${LEVELS_PER_WORLD * 3} estrellas`, {
          fontSize: '11px',
          color: '#ffd54f',
        })
        .setOrigin(0.5);

      if (unlocked) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => {
          audio.play('select');
          this.selectedWorld = w.id;
          this.render();
        });
      }
    });

    // --- Niveles del mundo seleccionado ---
    createPanel(this, width / 2, 340, width - 120, 210);
    this.add
      .text(width / 2, 258, `${world.name} - ${world.subtitle}`, {
        fontSize: '18px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const levels = LEVELS.filter((l) => l.world === this.selectedWorld);
    levels.forEach((l, i) => {
      const x = width / 2 - 300 + i * 200;
      const y = 350;
      const unlocked = save.isUnlocked(l.world, l.level);
      const stats = save.progress.levelStats[l.id];

      const box = this.add
        .rectangle(x, y, 170, 110, unlocked ? 0x161b22 : 0x21262d, 1)
        .setStrokeStyle(3, unlocked ? world.accent : 0x30363d);

      this.add
        .text(x, y - 36, `${l.world}-${l.level}`, {
          fontSize: '22px',
          color: unlocked ? '#ffffff' : '#6e7681',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.add
        .text(x, y - 8, unlocked ? l.name : 'Bloqueado', {
          fontSize: '12px',
          color: unlocked ? '#c9d1d9' : '#6e7681',
          wordWrap: { width: 160 },
          align: 'center',
        })
        .setOrigin(0.5);

      // Estrellas
      const stars = stats?.stars ?? 0;
      for (let s = 0; s < 3; s++) {
        this.add
          .text(x - 24 + s * 24, y + 22, s < stars ? '*' : '-', {
            fontSize: '24px',
            color: s < stars ? '#ffd54f' : '#484f58',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
      }

      if (stats?.bestScore) {
        this.add
          .text(x, y + 44, `Mejor: ${stats.bestScore}`, { fontSize: '11px', color: '#8b949e' })
          .setOrigin(0.5);
      }
      if (l.boss) {
        this.add
          .text(x + 70, y - 46, 'JEFE', {
            fontSize: '10px',
            color: '#ffffff',
            backgroundColor: '#da3633',
            padding: { x: 4, y: 2 },
          })
          .setOrigin(1, 0);
      }

      if (unlocked) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerover', () => box.setFillStyle(0x1f2630));
        box.on('pointerout', () => box.setFillStyle(0x161b22));
        box.on('pointerdown', () => {
          audio.play('select');
          this.startLevel(l.world, l.level);
        });
      }
    });

    createButton(this, 130, height - 46, 'MENU', () => this.scene.start('Menu'), {
      width: 180,
      height: 44,
      fontSize: 18,
      color: 0x30363d,
      hoverColor: 0x3d444d,
    });

    const next = getLevelDesign(save.progress.currentWorld, save.progress.currentLevel);
    createButton(
      this,
      width - 170,
      height - 46,
      `JUGAR ${next.id}`,
      () => this.startLevel(next.world, next.level),
      { width: 250, height: 44, fontSize: 18 },
    );
  }

  private startLevel(world: number, level: number): void {
    this.scene.start('Game', { world, level, lives: save.progress.lives });
  }
}
