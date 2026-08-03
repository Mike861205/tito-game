import Phaser from 'phaser';
import { save } from '../systems/SaveManager';
import { api } from '../systems/ApiClient';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.setPath('assets');
  }

  create(): void {
    save.load();
    void api.health().then(() => {
      if (api.isAuthenticated) void save.syncFromServer();
    });

    this.scene.start('Preload');
  }
}
