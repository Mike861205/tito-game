import Phaser from 'phaser';
import { getWorld } from '@tito/shared';
import type { HudData } from './GameScene';
import { createButton, formatTime } from '../ui/Widgets';

export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private tipBox?: Phaser.GameObjects.Container;

  constructor() {
    super('Hud');
  }

  create(data: { gameScene: Phaser.Scene }): void {
    const { width } = this.scale;

    this.add.rectangle(0, 0, width, 46, 0x0d1117, 0.6).setOrigin(0);

    const style = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontSize: `${size}px`,
      fontFamily: 'Trebuchet MS, sans-serif',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });

    this.levelText = this.add.text(14, 12, '', style(17, '#ffd54f'));
    this.scoreText = this.add.text(250, 12, '', style(17, '#ffffff'));
    this.coinText = this.add.text(430, 12, '', style(17, '#ffd54f'));
    this.livesText = this.add.text(560, 12, '', style(17, '#ff8a80'));
    this.powerText = this.add.text(670, 12, '', style(15, '#a5d6a7'));
    this.timeText = this.add.text(width - 16, 12, '', style(17, '#e6edf3')).setOrigin(1, 0);

    const touchCapable =
      this.sys.game.device.input.touch || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    if (!touchCapable) {
      this.add
        .text(width - 16, this.scale.height - 20, 'SHIFT = impulso  |  ESPACIO = saltar / volar  |  ABAJO = bajar  |  E / R = disparar  |  Q = lazo', {
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: 'rgba(13,17,23,0.65)',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(1, 0.5);
    }

    const game = data.gameScene;
    if (!touchCapable) {
      createButton(this, 76, this.scale.height - 24, 'SALIR / PAUSA', () => game.events.emit('game:pause-request'), {
        width: 132,
        height: 32,
        fontSize: 12,
        color: 0x3a294d,
        hoverColor: 0x60407d,
        radius: 12,
      }).setDepth(1100);
    }
    game.events.on('hud:update', (d: HudData) => this.refresh(d));
    game.events.on('hud:tip', (tip: string, taunt: string) => this.showTip(tip, taunt));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      game.events.off('hud:update');
      game.events.off('hud:tip');
    });
  }

  private refresh(d: HudData): void {
    const world = getWorld(d.world);
    this.levelText.setText(`${world.name}  ${d.world}-${d.level}`);
    this.scoreText.setText(`PUNTOS ${d.score.toString().padStart(6, '0')}`);
    this.coinText.setText(`TESORO ${d.coins}`);
    this.livesText.setText(`VIDAS ${d.lives}`);
    if (d.power === 'capa') {
      const energy = Math.round(d.flightEnergy);
      this.powerText
        .setText(`CAPA: ${d.flying ? 'VOLANDO' : 'IMPULSO'} ${energy}%`)
        .setColor(d.flying ? '#ffd166' : '#ffcc80');
    } else {
      const weapon = d.power === 'fuego' || d.power === 'hielo' ? d.power.toUpperCase() : 'ROCA';
      this.powerText.setText(`ARMA: ${weapon}`).setColor('#a5d6a7');
    }
    this.timeText.setText(`TIEMPO ${formatTime(d.timeLeft * 1000)}`);
    this.timeText.setColor(d.timeLeft <= 30 ? '#ff5252' : '#e6edf3');
  }

  private showTip(tip: string, taunt: string): void {
    this.tipBox?.destroy(true);
    const { width, height } = this.scale;

    const boxWidth = Phaser.Math.Clamp(width * 0.46, 320, 440);
    const bg = this.add.rectangle(0, 0, boxWidth, 58, 0x07111d, 0.88).setStrokeStyle(2, 0xffd54f, 0.85);
    const tipText = this.add
      .text(-boxWidth / 2 + 16, -18, tip, {
        fontSize: '12px',
        color: '#e6edf3',
        wordWrap: { width: boxWidth - 32 },
      })
      .setOrigin(0, 0);
    const tauntText = this.add
      .text(-boxWidth / 2 + 16, 12, `Tito: ${taunt}`, { fontSize: '10px', color: '#ffd54f', fontStyle: 'italic' })
      .setOrigin(0, 0);

    // Arriba, debajo del marcador: deja libres el escenario y los controles táctiles.
    this.tipBox = this.add.container(width / 2, Math.min(116, height * 0.23), [bg, tipText, tauntText]).setAlpha(0);
    this.tweens.add({ targets: this.tipBox, alpha: 1, y: '+=4', duration: 140 });
    this.time.delayedCall(2600, () => {
      if (!this.tipBox) return;
      this.tweens.add({
        targets: this.tipBox,
        alpha: 0,
        y: '-=5',
        duration: 220,
        onComplete: () => this.tipBox?.destroy(true),
      });
    });
  }
}
