import Phaser from 'phaser';
import {
  TILE,
  TILE_SIZE,
  generateLevel,
  getWorld,
  type EnemyKind,
  type GeneratedLevel,
  type LevelDesign,
} from '@tito/shared';
import { Enemy } from '../objects/Enemy';
import { playAnim } from './AssetManifest';
import { TILE_INDEX, createBackgroundTextures, createTileset } from './TextureFactory';

export interface BuiltLevel {
  data: GeneratedLevel;
  map: Phaser.Tilemaps.Tilemap;
  layer: Phaser.Tilemaps.TilemapLayer;
  coins: Phaser.Physics.Arcade.Group;
  gems: Phaser.Physics.Arcade.Group;
  enemies: Phaser.Physics.Arcade.Group;
  springs: Phaser.Physics.Arcade.StaticGroup;
  platforms: Phaser.Physics.Arcade.Group;
  checkpoints: Phaser.Physics.Arcade.StaticGroup;
  grappleAnchors: Phaser.Physics.Arcade.StaticGroup;
  goal: Phaser.Physics.Arcade.Sprite;
  spawnX: number;
  spawnY: number;
  widthPx: number;
  heightPx: number;
}

const CHAR_TO_INDEX: Record<string, number> = {
  [TILE.SOLID]: TILE_INDEX.SOLID,
  [TILE.PLATFORM]: TILE_INDEX.PLATFORM,
  [TILE.BRICK]: TILE_INDEX.BRICK,
  [TILE.QUESTION]: TILE_INDEX.QUESTION,
  [TILE.POWER]: TILE_INDEX.POWER,
  [TILE.SPIKE]: TILE_INDEX.SPIKE,
  [TILE.LAVA]: TILE_INDEX.LAVA,
};

const CHAR_TO_ENEMY: Record<string, EnemyKind> = {
  [TILE.ENEMY_GOOMB]: 'goomb',
  [TILE.ENEMY_SPIKER]: 'spiker',
  [TILE.ENEMY_FLYER]: 'flyer',
  [TILE.ENEMY_SLIDER]: 'slider',
  [TILE.ENEMY_GHOST]: 'ghost',
};

/** Construye el nivel completo en la escena. */
export function buildLevel(scene: Phaser.Scene, design: LevelDesign): BuiltLevel {
  const data = generateLevel(design);
  const world = getWorld(design.world);
  const s = TILE_SIZE;

  // ---------- Fondo con parallax ----------
  const bg = createBackgroundTextures(scene, world);
  const widthPx = data.width * s;
  const heightPx = data.height * s;

  const sceneArtKey = `scene-w${world.id}`;
  if (scene.textures.exists(sceneArtKey)) {
    scene.add
      .image(0, 0, sceneArtKey)
      .setOrigin(0)
      .setDisplaySize(scene.scale.width, scene.scale.height)
      .setScrollFactor(0)
      .setDepth(-30)
      .setTint(0xddeeff);
    scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x07111d, 0.13)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(-29);
  } else {
    scene.add
      .tileSprite(0, 0, scene.scale.width, scene.scale.height, bg.sky)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(-30);

    scene.add
      .tileSprite(0, scene.scale.height - 260, scene.scale.width, 220, bg.far)
      .setOrigin(0)
      .setScrollFactor(0.25)
      .setDepth(-20);
  }

  // ---------- Tilemap ----------
  const indexGrid: number[][] = data.grid.map((row) =>
    row.map((ch) => CHAR_TO_INDEX[ch] ?? TILE_INDEX.EMPTY),
  );

  const tilesetKey = createTileset(scene, world);
  const map = scene.make.tilemap({ data: indexGrid, tileWidth: s, tileHeight: s });
  const tileset = map.addTilesetImage(tilesetKey, tilesetKey, s, s, 0, 0);
  if (!tileset) throw new Error('No se pudo crear el tileset');

  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error('No se pudo crear la capa del mapa');
  layer.setDepth(5);

  layer.setCollision([TILE_INDEX.SOLID, TILE_INDEX.BRICK, TILE_INDEX.QUESTION, TILE_INDEX.POWER, TILE_INDEX.USED]);

  // Plataformas de un solo sentido: solo colisionan por arriba
  layer.forEachTile((tile) => {
    if (tile.index === TILE_INDEX.PLATFORM) {
      tile.setCollision(false, false, true, false);
    }
  });

  // ---------- Grupos ----------
  const coins = scene.physics.add.group({ allowGravity: false, immovable: true });
  const gems = scene.physics.add.group({ allowGravity: false, immovable: true });
  const enemies = scene.physics.add.group({ runChildUpdate: true });
  const springs = scene.physics.add.staticGroup();
  const platforms = scene.physics.add.group({ allowGravity: false, immovable: true });
  const checkpoints = scene.physics.add.staticGroup();
  const grappleAnchors = scene.physics.add.staticGroup();
  let checkpointIndex = 0;

  const px = (col: number): number => col * s + s / 2;
  const py = (row: number): number => row * s + s;

  for (let row = 0; row < data.height; row++) {
    for (let col = 0; col < data.width; col++) {
      const ch = data.grid[row]![col]!;
      switch (ch) {
        case TILE.COIN: {
          const coin = coins.create(px(col), py(row) - s / 2, 'coin') as Phaser.Physics.Arcade.Sprite;
          coin.setDepth(10).setDisplaySize(21, 21).setData({ currency: 'silver', units: 1, score: 100 });
          // Con hoja animada usa el giro real; si no, se simula con un tween.
          if (!playAnim(coin, 'coin-spin')) {
            const normalScaleX = coin.scaleX;
            scene.tweens.add({
              targets: coin,
              scaleX: normalScaleX * 0.14,
              duration: 420,
              yoyo: true,
              repeat: -1,
              delay: (col % 7) * 60,
            });
          }
          break;
        }
        case TILE.GOLD_COIN: {
          const coin = coins.create(px(col), py(row) - s / 2, 'coin-gold') as Phaser.Physics.Arcade.Sprite;
          coin.setDepth(11).setDisplaySize(25, 25).setData({ currency: 'gold', units: 5, score: 500 });
          scene.tweens.add({
            targets: coin,
            scaleX: coin.scaleX * 0.22,
            duration: 360,
            yoyo: true,
            repeat: -1,
            delay: (col % 5) * 70,
          });
          break;
        }
        case TILE.BANKNOTE: {
          const note = coins.create(px(col), py(row) - s / 2, 'banknote-tito') as Phaser.Physics.Arcade.Sprite;
          note.setDepth(11).setDisplaySize(38, 20).setData({ currency: 'note', units: 10, score: 1000 });
          scene.tweens.add({
            targets: note,
            y: note.y - 7,
            angle: { from: -4, to: 4 },
            duration: 650,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
          break;
        }
        case TILE.GEM: {
          const gem = gems.create(px(col), py(row) - s / 2, 'gem') as Phaser.Physics.Arcade.Sprite;
          gem.setDepth(10);
          playAnim(gem, 'gem-shine');
          scene.tweens.add({
            targets: gem,
            y: gem.y - 8,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
          break;
        }
        case TILE.SPRING: {
          const spring = springs.create(px(col), py(row), 'spring') as Phaser.Physics.Arcade.Sprite;
          spring.setOrigin(0.5, 1).setDepth(10).refreshBody();
          break;
        }
        case TILE.CHECKPOINT: {
          const cp = checkpoints.create(px(col), py(row), 'checkpoint') as Phaser.Physics.Arcade.Sprite;
          cp
            .setOrigin(0.5, 1)
            .setDepth(8)
            .setData({ taken: false, index: checkpointIndex++ })
            .refreshBody();
          playAnim(cp, 'checkpoint-off');
          break;
        }
        case TILE.GRAPPLE: {
          const anchor = grappleAnchors.create(px(col), py(row) - s / 2, 'grapple-anchor') as Phaser.Physics.Arcade.Sprite;
          anchor.setDepth(12).refreshBody();
          scene.tweens.add({
            targets: anchor,
            scale: 1.12,
            duration: 850,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
          break;
        }
        case TILE.MOVING_H:
        case TILE.MOVING_V: {
          const plat = platforms.create(px(col), py(row), 'platform-h') as Phaser.Physics.Arcade.Sprite;
          plat.setOrigin(0.5, 0.5).setDepth(9);
          playAnim(plat, 'platform-h-idle');
          (plat.body as Phaser.Physics.Arcade.Body).setImmovable(true);
          const range = ch === TILE.MOVING_H ? 140 : 110;
          scene.tweens.add({
            targets: plat,
            [ch === TILE.MOVING_H ? 'x' : 'y']: ch === TILE.MOVING_H ? plat.x + range : plat.y - range,
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: () => (plat.body as Phaser.Physics.Arcade.Body).updateFromGameObject(),
          });
          break;
        }
        case TILE.BOSS: {
          const boss = new Enemy(scene, px(col), py(row), 'boss', true);
          enemies.add(boss);
          boss.startMoving();
          break;
        }
        default: {
          const kind = CHAR_TO_ENEMY[ch];
          if (kind) {
            const enemy = new Enemy(scene, px(col), py(row), kind);
            enemies.add(enemy);
            enemy.startMoving();
          }
          break;
        }
      }
    }
  }

  // ---------- Meta ----------
  const goal = scene.physics.add.staticSprite(px(data.goal.col), py(data.goal.row), 'goal-flag');
  goal.setOrigin(0.5, 1).setDepth(8).refreshBody();
  playAnim(goal, 'goal-flag-wave');

  return {
    data,
    map,
    layer,
    coins,
    gems,
    enemies,
    springs,
    platforms,
    checkpoints,
    grappleAnchors,
    goal: goal as unknown as Phaser.Physics.Arcade.Sprite,
    spawnX: px(data.spawn.col),
    spawnY: py(data.spawn.row),
    widthPx,
    heightPx,
  };
}
