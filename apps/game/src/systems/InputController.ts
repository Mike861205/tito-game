import Phaser from 'phaser';

export interface InputState {
  left: boolean;
  right: boolean;
  down: boolean;
  jumpDown: boolean;
  jumpJustPressed: boolean;
  sprint: boolean;
  action: boolean;
  actionJustPressed: boolean;
  ropeDown: boolean;
  ropeJustPressed: boolean;
  rockJustPressed: boolean;
}

/**
 * Entrada unificada: teclado (flechas + WASD), gamepad y touch.
 */
export class InputController {
  private scene: Phaser.Scene;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private touch: { left: boolean; right: boolean; jump: boolean; down: boolean } = {
    left: false,
    right: false,
    jump: false,
    down: false,
  };
  private prevJump = false;
  private prevAction = false;
  private prevRope = false;
  private prevRock = false;
  private pauseCallbacks: Array<() => void> = [];
  private touchContainer?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys(
        'LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,SHIFT,E,Q,R,ESC,P',
      ) as Record<string, Phaser.Input.Keyboard.Key>;
    }
    if (scene.sys.game.device.input.touch) this.createTouchControls();
  }

  private createTouchControls(): void {
    const { width, height } = this.scene.scale;
    const mk = (
      x: number,
      y: number,
      label: string,
      onDown: () => void,
      onUp: () => void,
    ): Phaser.GameObjects.Container => {
      const circle = this.scene.add.circle(0, 0, 40, 0xffffff, 0.18).setStrokeStyle(2, 0xffffff, 0.4);
      const text = this.scene.add
        .text(0, 0, label, { fontSize: '24px', color: '#ffffff' })
        .setOrigin(0.5);
      const c = this.scene.add.container(x, y, [circle, text]).setScrollFactor(0).setDepth(1000);
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerdown', onDown);
      circle.on('pointerup', onUp);
      circle.on('pointerout', onUp);
      return c;
    };

    this.touchContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.touchContainer.add([
      mk(70, height - 70, '<', () => (this.touch.left = true), () => (this.touch.left = false)),
      mk(170, height - 70, '>', () => (this.touch.right = true), () => (this.touch.right = false)),
      mk(width - 80, height - 70, 'A', () => (this.touch.jump = true), () => (this.touch.jump = false)),
      mk(width - 175, height - 60, 'v', () => (this.touch.down = true), () => (this.touch.down = false)),
    ]);
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    return this.scene.input.gamepad?.getPad(0);
  }

  read(): InputState {
    const k = this.keys;
    const pad = this.pad();
    const axisX = pad?.axes[0]?.getValue() ?? 0;

    const left =
      Boolean(k.LEFT?.isDown) || Boolean(k.A?.isDown) || this.touch.left || axisX < -0.3 || Boolean(pad?.left);
    const right =
      Boolean(k.RIGHT?.isDown) || Boolean(k.D?.isDown) || this.touch.right || axisX > 0.3 || Boolean(pad?.right);
    const down = Boolean(k.DOWN?.isDown) || Boolean(k.S?.isDown) || this.touch.down || Boolean(pad?.down);
    const jumpDown =
      Boolean(k.SPACE?.isDown) ||
      Boolean(k.UP?.isDown) ||
      Boolean(k.W?.isDown) ||
      this.touch.jump ||
      Boolean(pad?.A);
    // En touch no hay una tecla SHIFT separada: mantener una direccion activa
    // la carrera para que tambien se pueda cargar la capa en celular/tablet.
    const sprint = Boolean(k.SHIFT?.isDown) || Boolean(pad?.X) || this.touch.left || this.touch.right;
    const action = Boolean(k.E?.isDown) || Boolean(pad?.B);
    const ropeDown = Boolean(k.Q?.isDown) || Boolean(pad?.Y);
    const rockDown = Boolean(k.R?.isDown) || Boolean(pad?.buttons[5]?.pressed);

    const jumpJustPressed = jumpDown && !this.prevJump;
    const actionJustPressed = action && !this.prevAction;
    const ropeJustPressed = ropeDown && !this.prevRope;
    const rockJustPressed = rockDown && !this.prevRock;
    this.prevJump = jumpDown;
    this.prevAction = action;
    this.prevRope = ropeDown;
    this.prevRock = rockDown;

    return {
      left,
      right,
      down,
      jumpDown,
      jumpJustPressed,
      sprint,
      action,
      actionJustPressed,
      ropeDown,
      ropeJustPressed,
      rockJustPressed,
    };
  }

  onPause(callback: () => void): void {
    this.scene.input.keyboard?.on('keydown-ESC', callback);
    this.scene.input.keyboard?.on('keydown-P', callback);
    this.pauseCallbacks.push(callback);
  }

  destroy(): void {
    for (const callback of this.pauseCallbacks) {
      this.scene.input.keyboard?.off('keydown-ESC', callback);
      this.scene.input.keyboard?.off('keydown-P', callback);
    }
    this.pauseCallbacks = [];
    this.touchContainer?.destroy(true);
  }
}
