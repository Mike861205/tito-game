import Phaser from 'phaser';
import { save } from '../systems/SaveManager';
import { api } from '../systems/ApiClient';

/** Assets opcionales: si el archivo no esta, se usa un placeholder generado. */
const OPTIONAL_ASSETS: Array<{ key: string; url: string }> = [
  { key: 'tito', url: 'assets/characters/tito.png' },
  { key: 'logo', url: 'assets/branding/logo.png' },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    save.load();
    void api.health().then(() => {
      if (api.isAuthenticated) void save.syncFromServer();
    });

    // Comprueba que assets existen ANTES de pedirselos al loader,
    // asi la consola queda limpia de errores 404.
    void this.detectAssets().then((available) => {
      this.registry.set('availableAssets', available);
      this.scene.start('Preload');
    });
  }

  private async detectAssets(): Promise<string[]> {
    const results = await Promise.all(
      OPTIONAL_ASSETS.map(async ({ key, url }) => {
        try {
          const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
          const type = res.headers.get('content-type') ?? '';
          return res.ok && type.startsWith('image/') ? key : null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((k): k is string => k !== null);
  }
}
