import Phaser from 'phaser';
import { save } from '../systems/SaveManager';
import { api } from '../systems/ApiClient';
import { audio } from '../systems/AudioManager';
import { createButton } from '../ui/Widgets';
import { TITO_HD_KEY } from '../systems/TitoRig';

export class MenuScene extends Phaser.Scene {
  private builtFor = { w: 0, h: 0 };
  private relayoutTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Menu');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.builtFor = { w: width, h: height };

    // Escalas relativas: el layout se deriva del tamano real del lienzo,
    // asi funciona igual en celular, tablet y escritorio.
    const cx = width / 2;
    const btnW = Phaser.Math.Clamp(width * 0.46, 220, 380);
    const btnH = Phaser.Math.Clamp(height * 0.098, 40, 54);
    const gap = Phaser.Math.Clamp(height * 0.026, 8, 16);
    const step = btnH + gap + 6;
    const btnFont = Math.round(Phaser.Math.Clamp(btnH * 0.42, 14, 22));
    const smallFont = Math.round(Phaser.Math.Clamp(height * 0.026, 10, 14));

    this.drawBackground(width, height);

    const footerY = height - Phaser.Math.Clamp(height * 0.05, 18, 30);
    const statusY = footerY - Phaser.Math.Clamp(height * 0.055, 20, 30);
    const stackBottom = statusY - Phaser.Math.Clamp(height * 0.06, 18, 34);
    const firstY = stackBottom - btnH / 2 - 8 - step * 3;
    const stackTop = firstY - btnH / 2;

    this.placeLogo(cx, stackTop, width, height);

    // Tito vive en el margen izquierdo; si la pantalla es angosta no cabe.
    const gutter = (width - btnW) / 2;
    if (gutter >= 150) {
      this.createTitoShowcase(gutter / 2, stackBottom, Math.min(gutter / 190, 1));
    }

    const continues = save.progress.unlocked.length > 1 || save.progress.totalScore > 0;
    const common = { width: btnW, height: btnH, fontSize: btnFont };

    createButton(this, cx, firstY, continues ? 'CONTINUAR' : 'JUGAR', () => this.scene.start('WorldMap'), {
      ...common,
      color: 0x1f6feb,
      hoverColor: 0x4493f8,
      glow: true,
    });

    createButton(this, cx, firstY + step, 'MAPA DE MUNDOS', () => this.scene.start('WorldMap'), {
      ...common,
      color: 0x30456b,
      hoverColor: 0x3f5c8f,
    });

    createButton(this, cx, firstY + step * 2, 'TABLA DE POSICIONES', () => this.scene.start('Leaderboard'), {
      ...common,
      color: 0x30456b,
      hoverColor: 0x3f5c8f,
    });

    createButton(
      this,
      cx,
      firstY + step * 3,
      api.isAuthenticated ? 'CERRAR SESION' : 'INICIAR SESION',
      () => {
        if (api.isAuthenticated) {
          api.logout();
          this.scene.restart();
        } else {
          void this.promptLogin();
        }
      },
      { ...common, color: 0x238636, hoverColor: 0x2ea043 },
    );

    const status = api.online
      ? api.isAuthenticated
        ? 'Conectado - tu progreso se guarda en la nube'
        : 'Servidor listo - juega como invitado o inicia sesion'
      : 'Modo offline - tu progreso se guarda en este navegador';
    this.addStatusPill(cx, statusY, status, smallFont, api.online ? 0x2ea043 : 0x8b949e);

    this.add
      .text(
        cx,
        footerY,
        `Estrellas ${save.stars}/${save.maxStars}   -   Puntaje ${save.progress.totalScore.toLocaleString('es-MX')}`,
        { fontSize: `${smallFont + 1}px`, color: '#c9d1d9', fontStyle: 'bold' },
      )
      .setOrigin(0.5);

    this.add
      .text(width - 12, height - 12, `v${import.meta.env.VITE_GAME_VERSION ?? '0.1.0'}`, {
        fontSize: `${Math.max(9, smallFont - 2)}px`,
        color: '#484f58',
      })
      .setOrigin(1, 1);

    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('WorldMap'));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.relayoutTimer?.remove();
    });
  }

  /** Con scale mode RESIZE (o al rotar el movil) se rehace el layout. */
  private onResize(): void {
    if (this.scale.width === this.builtFor.w && this.scale.height === this.builtFor.h) return;
    this.relayoutTimer?.remove();
    this.relayoutTimer = this.time.delayedCall(120, () => this.scene.restart());
  }

  private drawBackground(width: number, height: number): void {
    this.add.rectangle(0, 0, width, height, 0x0d1117).setOrigin(0);
    this.add.tileSprite(0, 0, width, height, 'sky-w1').setOrigin(0).setAlpha(0.32);

    const g = this.add.graphics();
    // Oscurecido inferior: separa el fondo de los botones y del texto de pie.
    g.fillGradientStyle(0x0d1117, 0x0d1117, 0x0d1117, 0x0d1117, 0, 0, 0.9, 0.9);
    g.fillRect(0, height * 0.35, width, height * 0.65);
    // Marco sutil.
    g.lineStyle(2, 0x1f6feb, 0.25);
    g.strokeRect(1, 1, width - 2, height - 2);
  }

  private placeLogo(cx: number, stackTop: number, width: number, height: number): void {
    const areaTop = height * 0.03;
    const areaH = Math.max(40, stackTop - areaTop - 10);
    const logo = this.add.image(cx, 0, 'logo').setOrigin(0.5);
    const maxW = Math.min(width * 0.62, 420);
    const maxH = areaH * 0.94;
    logo.setScale(Math.min(maxW / logo.width, maxH / logo.height, 1.4));
    logo.y = areaTop + areaH / 2;

    this.tweens.add({
      targets: logo,
      y: logo.y + Math.min(8, areaH * 0.06),
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private addStatusPill(x: number, y: number, label: string, fontSize: number, dot: number): void {
    const text = this.add
      .text(0, 0, label, { fontSize: `${fontSize}px`, color: '#c9d1d9' })
      .setOrigin(0, 0.5);
    const padX = 12;
    const w = text.width + padX * 2 + 16;
    const h = fontSize + 14;

    const g = this.add.graphics();
    g.fillStyle(0x161b22, 0.75);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(1, 0x30363d, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.fillStyle(dot, 1);
    g.fillCircle(-w / 2 + padX, 0, 4);

    text.x = -w / 2 + padX + 10;
    this.add.container(x, y, [g, text]);
  }

  /**
   * Tito del menu: usa la hoja grande (192px por frame) para que se vea nitido
   * y encadena carrera, salto y pose de descanso para que no quede estatico.
   */
  private createTitoShowcase(x: number, y: number, sizeFactor = 1): void {
    const hd = this.textures.exists(TITO_HD_KEY);
    const key = hd ? TITO_HD_KEY : 'tito';
    const sprite = this.add.sprite(x, y, key).setOrigin(0.5, 1);
    // 192px de frame -> ~150px en pantalla, todavia por encima de 1:1.
    sprite.setScale((hd ? 0.78 : 2.5) * sizeFactor);
    sprite.play(`${key}-idle`);

    const groundY = y;
    const shadow = this.add.ellipse(x, groundY + 4, 70 * sizeFactor, 14 * sizeFactor, 0x000000, 0.3);

    const rest = (): void => {
      sprite.play(`${key}-idle`, true);
    };

    const hop = (): void => {
      sprite.play(`${key}-jump`, true);
      this.tweens.add({
        targets: sprite,
        y: groundY - 46,
        duration: 300,
        ease: 'Quad.easeOut',
        yoyo: true,
        onYoyo: () => sprite.play(`${key}-fall`, true),
        onComplete: rest,
      });
      this.tweens.add({
        targets: shadow,
        scaleX: 0.6,
        scaleY: 0.6,
        alpha: 0.15,
        duration: 300,
        ease: 'Quad.easeOut',
        yoyo: true,
      });
    };

    const dash = (): void => {
      sprite.play(`${key}-run`, true);
      this.tweens.add({
        targets: [sprite, shadow],
        x: x + 26,
        duration: 700,
        ease: 'Sine.easeInOut',
        yoyo: true,
        onComplete: rest,
      });
    };

    // Alterna entre trotar en el sitio y saltar cada pocos segundos.
    let turn = 0;
    this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => (turn++ % 2 === 0 ? hop() : dash()),
    });
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
