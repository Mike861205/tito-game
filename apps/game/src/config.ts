import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@tito/shared';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { GameOverScene } from './scenes/GameOverScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0d1117',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 480, height: 270 },
    max: { width: 1920, height: 1080 },
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1800 },
      tileBias: 24,
      fps: 60,
      debug: import.meta.env.VITE_PHYSICS_DEBUG === 'true',
    },
  },
  input: {
    gamepad: true,
    activePointers: 3,
  },
  render: {
    powerPreference: 'high-performance',
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    WorldMapScene,
    GameScene,
    HudScene,
    PauseScene,
    LevelCompleteScene,
    GameOverScene,
    LeaderboardScene,
  ],
};
