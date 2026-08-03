import Phaser from 'phaser';
import { api, type LeaderboardRow } from '../systems/ApiClient';
import { createButton, createPanel, createTitle, formatTime } from '../ui/Widgets';

export class LeaderboardScene extends Phaser.Scene {
  private rows: LeaderboardRow[] = [];
  private scope: 'global' | 'weekly' | 'me' = 'global';
  private listGroup?: Phaser.GameObjects.Group;

  constructor() {
    super('Leaderboard');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x0d1117).setOrigin(0);
    this.add.tileSprite(0, 0, width, height, 'sky-w5').setOrigin(0).setAlpha(0.25);
    createPanel(this, width / 2, height / 2 + 10, width - 140, height - 130);
    createTitle(this, width / 2, 44, 'TABLA DE POSICIONES', 30);

    createButton(this, 220, 96, 'GLOBAL', () => this.setScope('global'), {
      width: 150,
      height: 36,
      fontSize: 15,
    });
    createButton(this, 390, 96, 'SEMANAL', () => this.setScope('weekly'), {
      width: 150,
      height: 36,
      fontSize: 15,
      color: 0x6e40c9,
      hoverColor: 0x8957e5,
    });
    createButton(this, 560, 96, 'MIS SCORES', () => this.setScope('me'), {
      width: 150,
      height: 36,
      fontSize: 15,
      color: 0x238636,
      hoverColor: 0x2ea043,
    });

    createButton(this, width - 120, height - 46, 'VOLVER', () => this.scene.start('Menu'), {
      width: 180,
      height: 42,
      fontSize: 17,
      color: 0x30363d,
      hoverColor: 0x3d444d,
    });

    this.listGroup = this.add.group();
    void this.loadRows();
  }

  private setScope(scope: 'global' | 'weekly' | 'me'): void {
    this.scope = scope;
    void this.loadRows();
  }

  private async loadRows(): Promise<void> {
    this.listGroup?.clear(true, true);
    const loading = this.add
      .text(this.scale.width / 2, 200, 'Cargando...', { fontSize: '18px', color: '#8b949e' })
      .setOrigin(0.5);
    this.listGroup?.add(loading);

    this.rows = await api.leaderboard({ scope: this.scope, limit: 12 });
    loading.destroy();
    this.renderRows();
  }

  private renderRows(): void {
    const { width } = this.scale;

    if (this.rows.length === 0) {
      const msg = api.online
        ? this.scope === 'me'
          ? 'Aun no tienes puntajes. Inicia sesion y juega!'
          : 'Todavia no hay puntajes registrados.'
        : 'Sin conexion con el servidor. Juega en modo offline.';
      this.listGroup?.add(
        this.add.text(width / 2, 220, msg, { fontSize: '17px', color: '#8b949e' }).setOrigin(0.5),
      );
      return;
    }

    const headerY = 140;
    const cols: Array<[string, number]> = [
      ['#', 130],
      ['JUGADOR', 200],
      ['NIVEL', 450],
      ['PUNTOS', 620],
      ['TIEMPO', 780],
    ];
    for (const [label, x] of cols) {
      this.listGroup?.add(
        this.add.text(x, headerY, label, { fontSize: '14px', color: '#ffd54f', fontStyle: 'bold' }),
      );
    }

    this.rows.forEach((r, i) => {
      const y = 170 + i * 28;
      const color = i === 0 ? '#ffd54f' : i < 3 ? '#e6edf3' : '#c9d1d9';
      const cells: Array<[string, number]> = [
        [`${r.rank}`, 130],
        [r.username, 200],
        [`${r.world}-${r.level}`, 450],
        [r.score.toLocaleString('es-MX'), 620],
        [formatTime(r.timeMs), 780],
      ];
      for (const [text, x] of cells) {
        this.listGroup?.add(this.add.text(x, y, text, { fontSize: '15px', color }));
      }
    });
  }
}
