import Phaser from 'phaser';
import { LEVELS, LEVELS_PER_WORLD, WORLDS, getLevelDesign, levelId } from '@tito/shared';
import { save } from '../systems/SaveManager';
import { audio } from '../systems/AudioManager';
import { createButton } from '../ui/Widgets';

const DISPLAY_FONT = 'Arial Black, Trebuchet MS, sans-serif';
const UI_FONT = 'Segoe UI, Arial, sans-serif';

interface PlanetTheme {
  light: number;
  base: number;
  dark: number;
  glow: number;
  shortName: string;
}

const PLANETS: readonly PlanetTheme[] = [
  { light: 0x8cffba, base: 0x20b86a, dark: 0x063e32, glow: 0x39ffb2, shortName: 'PRADERAS' },
  { light: 0xffe08a, base: 0xe69b32, dark: 0x6d2e16, glow: 0xffc857, shortName: 'DESIERTO' },
  { light: 0xd9fbff, base: 0x5bbcff, dark: 0x173f7a, glow: 0x72e7ff, shortName: 'HIELO' },
  { light: 0xff8bd8, base: 0x7b4fd6, dark: 0x251545, glow: 0xd56bff, shortName: 'FÁBRICA' },
  { light: 0xffc15c, base: 0xe73f35, dark: 0x59131a, glow: 0xff5c35, shortName: 'MAGMA' },
];

/** Selector galactico responsivo de los 5 mundos y sus niveles. */
export class WorldMapScene extends Phaser.Scene {
  private selectedWorld = 1;
  private builtFor = { width: 0, height: 0 };
  private resizeTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('WorldMap');
  }

  create(): void {
    this.selectedWorld = save.progress.currentWorld;
    this.render();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.resizeTimer?.remove();
    });
  }

  private render(): void {
    this.tweens.killAll();
    this.children.removeAll();

    const { width, height } = this.scale;
    this.builtFor = { width, height };
    const world = WORLDS.find((item) => item.id === this.selectedWorld)!;
    const theme = PLANETS[this.selectedWorld - 1]!;

    this.createUniverseBackground(width, height, theme.glow);

    const titleY = Phaser.Math.Clamp(height * 0.064, 26, 38);
    this.add
      .text(width / 2, titleY - 13, 'TITO GAME  •  CARTA ESTELAR', {
        fontFamily: UI_FONT,
        fontSize: `${Phaser.Math.Clamp(width * 0.011, 9, 12)}px`,
        color: '#9ddcff',
        fontStyle: 'bold',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#27a7ff', 8);
    this.add
      .text(width / 2, titleY + 11, 'UNIVERSO DE MUNDOS', {
        fontFamily: DISPLAY_FONT,
        fontSize: `${Phaser.Math.Clamp(width * 0.035, 25, 36)}px`,
        color: '#ffffff',
        stroke: '#161044',
        strokeThickness: 7,
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 8, true, true);

    const nodeY = Phaser.Math.Clamp(height * 0.235, 100, 128);
    const nodeRadius = Phaser.Math.Clamp(Math.min(width * 0.036, height * 0.064), 24, 35);
    const sideMargin = Phaser.Math.Clamp(width * 0.09, 44, 86);
    const usableWidth = width - sideMargin * 2;
    const routePoints = WORLDS.map((_, index) => ({
      x: sideMargin + (usableWidth * index) / (WORLDS.length - 1),
      y: nodeY + [7, -5, 4, -6, 7][index]!,
    }));

    this.drawGalaxyRoute(routePoints, theme.glow);
    WORLDS.forEach((item, index) => {
      const point = routePoints[index]!;
      this.createPlanetNode(point.x, point.y, nodeRadius, item.id, item.name);
    });

    const panelTop = Phaser.Math.Clamp(height * 0.4, 205, 220);
    const footerY = height - Phaser.Math.Clamp(height * 0.055, 25, 32);
    const panelBottom = footerY - 31;
    const panelX = Phaser.Math.Clamp(width * 0.025, 10, 24);
    const panelWidth = width - panelX * 2;
    const panelHeight = Math.max(180, panelBottom - panelTop);
    this.drawGlassPanel(panelX, panelTop, panelWidth, panelHeight, theme.glow);

    this.add
      .text(panelX + 24, panelTop + 18, `ÓRBITA ${world.id.toString().padStart(2, '0')}`, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        color: '#9ba7ca',
        fontStyle: 'bold',
        letterSpacing: 2,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(panelX + 24, panelTop + 39, world.name.toUpperCase(), {
        fontFamily: DISPLAY_FONT,
        fontSize: `${Phaser.Math.Clamp(width * 0.021, 16, 22)}px`,
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
      .setShadow(0, 2, '#000000', 5);
    this.add
      .text(panelX + panelWidth - 24, panelTop + 36, this.worldProgressLabel(world.id), {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: Phaser.Display.Color.IntegerToColor(theme.light).rgba,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    const levels = LEVELS.filter((level) => level.world === this.selectedWorld);
    const cardGap = Phaser.Math.Clamp(width * 0.013, 7, 13);
    const cardAreaX = panelX + 18;
    const cardAreaTop = panelTop + 65;
    const cardAreaWidth = panelWidth - 36;
    const cardAreaHeight = panelHeight - 79;
    const twoRows = width < 680 && cardAreaHeight >= 210;
    const columns = twoRows ? 2 : 4;
    const rows = twoRows ? 2 : 1;
    const cardWidth = (cardAreaWidth - cardGap * (columns - 1)) / columns;
    const cardHeight = (cardAreaHeight - cardGap * (rows - 1)) / rows;

    levels.forEach((level, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = cardAreaX + cardWidth / 2 + column * (cardWidth + cardGap);
      const y = cardAreaTop + cardHeight / 2 + row * (cardHeight + cardGap);
      this.createLevelCard(x, y, cardWidth, cardHeight, level, theme);
    });

    const buttonWidth = Phaser.Math.Clamp(width * 0.2, 145, 190);
    createButton(this, panelX + buttonWidth / 2, footerY, '←  MENÚ', () => this.scene.start('Menu'), {
      width: buttonWidth,
      height: 42,
      fontSize: 16,
      color: 0x252b46,
      hoverColor: 0x343d65,
      radius: 18,
    });

    const next = getLevelDesign(save.progress.currentWorld, save.progress.currentLevel);
    const playWidth = Phaser.Math.Clamp(width * 0.25, 190, 245);
    createButton(
      this,
      width - panelX - playWidth / 2,
      footerY,
      `CONTINUAR  ${next.id}  ▶`,
      () => this.startLevel(next.world, next.level),
      {
        width: playWidth,
        height: 42,
        fontSize: 16,
        color: 0x235ee7,
        hoverColor: 0x3d7bff,
        radius: 18,
        glow: true,
      },
    );
  }

  private createUniverseBackground(width: number, height: number, accent: number): void {
    this.add.rectangle(0, 0, width, height, 0x050817).setOrigin(0);
    if (this.textures.exists('universe-map')) {
      const background = this.add.image(width / 2, height / 2, 'universe-map');
      const scale = Math.max(width / background.width, height / background.height);
      background.setScale(scale).setAlpha(0.88);
      this.tweens.add({
        targets: background,
        scale: scale * 1.025,
        duration: 16000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.add.tileSprite(0, 0, width, height, 'sky-w3').setOrigin(0).setTint(0x17234f);
    }

    const shade = this.add.graphics();
    shade.fillGradientStyle(0x030511, 0x030511, 0x071127, 0x071127, 0.48, 0.48, 0.82, 0.82);
    shade.fillRect(0, 0, width, height);
    shade.fillStyle(accent, 0.055);
    shade.fillCircle(width / 2, height * 0.28, Math.max(width, height) * 0.42);

    // Estrellas cercanas: una capa sutil en movimiento aporta profundidad.
    for (let i = 0; i < 28; i++) {
      const x = ((i * 137 + 43) % 997) / 997 * width;
      const y = ((i * 83 + 29) % 541) / 541 * height;
      const star = this.add.circle(x, y, i % 5 === 0 ? 1.4 : 0.8, i % 3 === 0 ? accent : 0xffffff, 0.5);
      this.tweens.add({
        targets: star,
        alpha: { from: 0.18, to: 0.8 },
        duration: 1100 + (i % 7) * 230,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private drawGalaxyRoute(points: Array<{ x: number; y: number }>, color: number): void {
    const route = this.add.graphics();
    route.lineStyle(7, color, 0.08);
    route.beginPath();
    route.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1]!;
      const point = points[i]!;
      route.lineTo(point.x, point.y);
      for (let step = 1; step < 7; step += 2) {
        const t1 = step / 7;
        const t2 = Math.min(1, (step + 1) / 7);
        route.lineStyle(2, 0x9bdcff, 0.34);
        route.lineBetween(
          Phaser.Math.Linear(previous.x, point.x, t1),
          Phaser.Math.Linear(previous.y, point.y, t1),
          Phaser.Math.Linear(previous.x, point.x, t2),
          Phaser.Math.Linear(previous.y, point.y, t2),
        );
      }
    }
    route.strokePath();
  }

  private createPlanetNode(x: number, y: number, radius: number, worldId: number, fullName: string): void {
    const theme = PLANETS[worldId - 1]!;
    const unlocked = save.isUnlocked(worldId, 1);
    const selected = worldId === this.selectedWorld;
    const container = this.add.container(x, y);
    const visual = this.add.container(0, 0);
    const graphics = this.add.graphics();
    visual.add(graphics);
    container.add(visual);

    const paint = (hovered = false): void => {
      graphics.clear();
      const glowColor = unlocked ? theme.glow : 0x596174;
      graphics.fillStyle(glowColor, selected ? 0.2 : hovered ? 0.15 : 0.07);
      graphics.fillCircle(0, 0, radius * (selected ? 1.42 : 1.24));
      graphics.lineStyle(selected ? 3 : 1.5, glowColor, selected ? 0.95 : 0.45);
      graphics.strokeEllipse(0, 0, radius * 2.75, radius * 1.05);

      graphics.fillStyle(unlocked ? theme.dark : 0x151a2b, 1);
      graphics.fillCircle(0, 2, radius);
      graphics.fillStyle(unlocked ? theme.base : 0x353b4e, 1);
      graphics.fillCircle(-radius * 0.08, -radius * 0.08, radius * 0.9);
      graphics.fillStyle(unlocked ? theme.light : 0x697086, 0.48);
      graphics.fillCircle(-radius * 0.34, -radius * 0.34, radius * 0.48);
      graphics.fillStyle(0xffffff, unlocked ? 0.5 : 0.12);
      graphics.fillEllipse(-radius * 0.38, -radius * 0.42, radius * 0.28, radius * 0.14);

      this.drawPlanetDetails(graphics, worldId, radius, unlocked);
      graphics.lineStyle(1.5, 0xffffff, unlocked ? 0.32 : 0.1);
      graphics.strokeCircle(-radius * 0.04, -radius * 0.04, radius * 0.91);
      if (!unlocked) this.drawLock(graphics, radius);
    };
    paint();

    const labelY = radius + 12;
    this.add
      .text(x, y + labelY, `${worldId.toString().padStart(2, '0')}  ${theme.shortName}`, {
        fontFamily: DISPLAY_FONT,
        fontSize: `${Phaser.Math.Clamp(radius * 0.38, 10, 13)}px`,
        color: unlocked ? '#ffffff' : '#778099',
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 2, '#000000', 4);
    this.add
      .text(x, y + labelY + 17, unlocked ? this.worldProgressLabel(worldId) : 'BLOQUEADO', {
        fontFamily: UI_FONT,
        fontSize: `${Phaser.Math.Clamp(radius * 0.31, 9, 11)}px`,
        color: unlocked ? '#b9c9e8' : '#687086',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    container.setSize(radius * 2.7, radius * 2.35);
    if (!unlocked) return;
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => {
      paint(true);
      this.tweens.add({ targets: visual, scale: 1.1, duration: 130, ease: 'Back.easeOut' });
    });
    container.on('pointerout', () => {
      paint(false);
      this.tweens.add({ targets: visual, scale: 1, duration: 130, ease: 'Quad.easeOut' });
    });
    container.on('pointerdown', () => {
      audio.play('select');
      this.selectedWorld = worldId;
      this.render();
    });

    if (selected) {
      this.tweens.add({
        targets: visual,
        y: { from: -2, to: 2 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    container.setName(fullName);
  }

  private drawPlanetDetails(graphics: Phaser.GameObjects.Graphics, worldId: number, radius: number, unlocked: boolean): void {
    const alpha = unlocked ? 0.72 : 0.18;
    if (worldId === 1) {
      graphics.fillStyle(0x0a6f50, alpha);
      graphics.fillEllipse(radius * 0.2, -radius * 0.08, radius * 0.8, radius * 0.36);
      graphics.fillEllipse(-radius * 0.12, radius * 0.35, radius * 0.62, radius * 0.24);
    } else if (worldId === 2) {
      graphics.lineStyle(radius * 0.12, 0xffd56a, alpha);
      graphics.strokeEllipse(0, radius * 0.12, radius * 1.65, radius * 0.42);
      graphics.lineStyle(2, 0x8f421c, alpha);
      graphics.strokeEllipse(0, -radius * 0.22, radius * 1.25, radius * 0.3);
    } else if (worldId === 3) {
      graphics.fillStyle(0xd7f8ff, alpha);
      graphics.fillTriangle(-radius * 0.5, radius * 0.2, -radius * 0.22, -radius * 0.55, 0, radius * 0.22);
      graphics.fillTriangle(0, radius * 0.35, radius * 0.28, -radius * 0.45, radius * 0.52, radius * 0.3);
    } else if (worldId === 4) {
      graphics.lineStyle(radius * 0.14, 0xff63d2, alpha);
      graphics.strokeCircle(0, 0, radius * 0.48);
      graphics.lineStyle(2, 0x95e6ff, alpha);
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        graphics.lineBetween(
          Math.cos(angle) * radius * 0.5,
          Math.sin(angle) * radius * 0.5,
          Math.cos(angle) * radius * 0.77,
          Math.sin(angle) * radius * 0.77,
        );
      }
    } else {
      graphics.lineStyle(2.5, 0xffc247, alpha);
      graphics.beginPath();
      graphics.moveTo(-radius * 0.55, -radius * 0.5);
      graphics.lineTo(-radius * 0.12, -radius * 0.12);
      graphics.lineTo(-radius * 0.3, radius * 0.25);
      graphics.lineTo(radius * 0.12, radius * 0.55);
      graphics.moveTo(radius * 0.5, -radius * 0.35);
      graphics.lineTo(radius * 0.18, 0);
      graphics.lineTo(radius * 0.55, radius * 0.24);
      graphics.strokePath();
    }
  }

  private drawLock(graphics: Phaser.GameObjects.Graphics, radius: number): void {
    graphics.fillStyle(0x080b14, 0.7);
    graphics.fillCircle(0, 0, radius * 0.58);
    graphics.lineStyle(3, 0xa0a8bb, 0.9);
    graphics.strokeRoundedRect(-radius * 0.22, -radius * 0.22, radius * 0.44, radius * 0.38, 4);
    graphics.fillStyle(0xa0a8bb, 1);
    graphics.fillRoundedRect(-radius * 0.29, -radius * 0.02, radius * 0.58, radius * 0.46, 4);
    graphics.fillStyle(0x252b3d, 1);
    graphics.fillCircle(0, radius * 0.13, radius * 0.07);
  }

  private drawGlassPanel(x: number, y: number, width: number, height: number, accent: number): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x02050e, 0.7);
    panel.fillRoundedRect(x, y, width, height, 22);
    panel.fillStyle(0x101936, 0.56);
    panel.fillRoundedRect(x + 3, y + 3, width - 6, height - 6, 19);
    panel.fillStyle(accent, 0.08);
    panel.fillRoundedRect(x + 3, y + 3, width - 6, 55, { tl: 19, tr: 19, bl: 5, br: 5 });
    panel.lineStyle(5, accent, 0.1);
    panel.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, 24);
    panel.lineStyle(1.5, accent, 0.65);
    panel.strokeRoundedRect(x, y, width, height, 22);
    panel.lineStyle(1, 0xffffff, 0.12);
    panel.lineBetween(x + 18, y + 57, x + width - 18, y + 57);
  }

  private createLevelCard(
    x: number,
    y: number,
    width: number,
    height: number,
    level: (typeof LEVELS)[number],
    theme: PlanetTheme,
  ): void {
    const unlocked = save.isUnlocked(level.world, level.level);
    const stats = save.progress.levelStats[level.id];
    const current = level.world === save.progress.currentWorld && level.level === save.progress.currentLevel;
    const container = this.add.container(x, y);
    const visual = this.add.container(0, 0);
    const card = this.add.graphics();
    visual.add(card);
    container.add(visual);

    const paint = (hovered = false): void => {
      card.clear();
      const border = unlocked ? theme.glow : 0x46506a;
      card.fillStyle(0x000000, 0.25);
      card.fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width - 6, height, 15);
      card.fillStyle(unlocked ? (hovered ? 0x1b2b52 : 0x11182d) : 0x111522, 0.96);
      card.fillRoundedRect(-width / 2, -height / 2, width, height - 5, 15);
      card.fillStyle(border, current ? 0.18 : hovered ? 0.13 : 0.07);
      card.fillRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, Math.min(46, height * 0.36), {
        tl: 13,
        tr: 13,
        bl: 4,
        br: 4,
      });
      card.lineStyle(current ? 3 : 1.5, border, current ? 1 : unlocked ? 0.58 : 0.25);
      card.strokeRoundedRect(-width / 2, -height / 2, width, height - 5, 15);
      if (current) {
        card.fillStyle(border, 1);
        card.fillCircle(-width / 2 + 15, -height / 2 + 15, 4);
      }
    };
    paint();

    const top = -height / 2;
    const compact = height < 100;
    const numberSize = Phaser.Math.Clamp(height * 0.22, 17, 27);
    visual.add(
      this.add
        .text(0, top + (compact ? 20 : 25), level.id, {
          fontFamily: DISPLAY_FONT,
          fontSize: `${numberSize}px`,
          color: unlocked ? '#ffffff' : '#667087',
        })
        .setOrigin(0.5),
    );
    visual.add(
      this.add
        .text(0, top + (compact ? 47 : 59), unlocked ? level.name : 'ACCESO BLOQUEADO', {
          fontFamily: UI_FONT,
          fontSize: `${Phaser.Math.Clamp(width * 0.062, 10, 13)}px`,
          color: unlocked ? '#cbd7f2' : '#667087',
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: width - 22 },
        })
        .setOrigin(0.5),
    );

    if (!compact) {
      const stars = stats?.stars ?? 0;
      visual.add(
        this.add
          .text(0, top + height * 0.68, unlocked ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '—  —  —', {
            fontFamily: UI_FONT,
            fontSize: `${Phaser.Math.Clamp(height * 0.16, 15, 21)}px`,
            color: stars ? '#ffd75e' : '#536079',
            letterSpacing: 4,
          })
          .setOrigin(0.5),
      );
      visual.add(
        this.add
          .text(0, top + height * 0.87, stats?.bestScore ? `RÉCORD  ${stats.bestScore.toLocaleString('es-MX')}` : unlocked ? 'SIN RÉCORD' : '', {
            fontFamily: UI_FONT,
            fontSize: '10px',
            color: '#7f8dab',
            fontStyle: 'bold',
            letterSpacing: 1,
          })
          .setOrigin(0.5),
      );
    }

    if (level.boss) {
      const badge = this.add
        .text(width / 2 - 11, top + 9, 'JEFE', {
          fontFamily: DISPLAY_FONT,
          fontSize: '8px',
          color: '#ffffff',
          backgroundColor: '#e23b3b',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(1, 0);
      visual.add(badge);
    }

    container.setSize(width, height);
    if (!unlocked) return;
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => {
      paint(true);
      this.tweens.add({ targets: visual, scale: 1.025, y: -3, duration: 120, ease: 'Quad.easeOut' });
    });
    container.on('pointerout', () => {
      paint(false);
      this.tweens.add({ targets: visual, scale: 1, y: 0, duration: 120, ease: 'Quad.easeOut' });
    });
    container.on('pointerdown', () => {
      audio.play('select');
      this.startLevel(level.world, level.level);
    });
  }

  private worldProgressLabel(worldId: number): string {
    const stars = Array.from({ length: LEVELS_PER_WORLD }, (_, index) =>
      save.progress.levelStats[levelId(worldId, index + 1)]?.stars ?? 0,
    ).reduce((total, value) => total + value, 0);
    return `${stars}/${LEVELS_PER_WORLD * 3}  ESTRELLAS`;
  }

  private onResize(): void {
    if (this.scale.width === this.builtFor.width && this.scale.height === this.builtFor.height) return;
    this.resizeTimer?.remove();
    this.resizeTimer = this.time.delayedCall(100, () => this.render());
  }

  private startLevel(world: number, level: number): void {
    this.scene.start('Game', { world, level, lives: save.progress.lives });
  }
}
