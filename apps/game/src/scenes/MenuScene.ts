import Phaser from 'phaser';
import { save } from '../systems/SaveManager';
import { api } from '../systems/ApiClient';
import { audio } from '../systems/AudioManager';
import { createButton } from '../ui/Widgets';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x0d1117).setOrigin(0);
    this.add
      .tileSprite(0, 0, width, height, 'sky-w1')
      .setOrigin(0)
      .setAlpha(0.35);

    const logo = this.add.image(width / 2, 130, 'logo').setOrigin(0.5);
    const maxLogoWidth = 420;
    if (logo.width > maxLogoWidth) logo.setScale(maxLogoWidth / logo.width);
    this.tweens.add({
      targets: logo,
      y: logo.y + 8,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tito saludando
    const tito = this.add.sprite(width / 2 - 250, height - 120, 'tito').setScale(2.5).setOrigin(0.5, 1);
    tito.play('tito-idle');

    const continues = save.progress.unlocked.length > 1 || save.progress.totalScore > 0;

    createButton(this, width / 2, 260, continues ? 'CONTINUAR' : 'JUGAR', () => {
      this.scene.start('WorldMap');
    });

    createButton(this, width / 2, 325, 'MAPA DE MUNDOS', () => {
      this.scene.start('WorldMap');
    });

    createButton(this, width / 2, 390, 'TABLA DE POSICIONES', () => {
      this.scene.start('Leaderboard');
    });

    createButton(
      this,
      width / 2,
      455,
      api.isAuthenticated ? 'CERRAR SESION' : 'INICIAR SESION',
      () => {
        if (api.isAuthenticated) {
          api.logout();
          this.scene.restart();
        } else {
          void this.promptLogin();
        }
      },
      { color: 0x238636, hoverColor: 0x2ea043 },
    );

    const status = api.online
      ? api.isAuthenticated
        ? 'Conectado - tu progreso se guarda en la nube'
        : 'Servidor listo - juega como invitado o inicia sesion'
      : 'Modo offline - tu progreso se guarda en este navegador';
    this.add
      .text(width / 2, height - 34, status, { fontSize: '14px', color: '#8b949e' })
      .setOrigin(0.5);

    this.add
      .text(16, height - 24, `Estrellas: ${save.stars}/${save.maxStars}   Puntaje: ${save.progress.totalScore}`, {
        fontSize: '14px',
        color: '#c9d1d9',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(width - 16, height - 24, `v${import.meta.env.VITE_GAME_VERSION ?? '0.1.0'}`, {
        fontSize: '13px',
        color: '#484f58',
      })
      .setOrigin(1, 0.5);

    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('WorldMap'));
  }

  /** Login minimalista con prompts nativos (suficiente para la version local). */
  private async promptLogin(): Promise<void> {
    audio.play('select');
    const mode = window.confirm('Aceptar = Iniciar sesion\nCancelar = Crear cuenta nueva');

    if (mode) {
      const user = window.prompt('Usuario o email:');
      if (!user) return;
      const pass = window.prompt('Contrasena:');
      if (!pass) return;
      const res = await api.login(user, pass);
      if (!res) {
        window.alert('No se pudo iniciar sesion. Revisa tus datos o el servidor.');
        return;
      }
    } else {
      const email = window.prompt('Email:');
      if (!email) return;
      const username = window.prompt('Nombre de jugador (3-20, sin espacios):');
      if (!username) return;
      const pass = window.prompt('Contrasena (min 8 caracteres):');
      if (!pass) return;
      const res = await api.register(email, username, pass);
      if (!res) {
        window.alert('No se pudo crear la cuenta. Puede que ya exista.');
        return;
      }
    }

    await save.syncFromServer();
    this.scene.restart();
  }
}
