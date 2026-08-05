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
  private touch: Record<'left' | 'right' | 'jump' | 'down' | 'action' | 'rope' | 'rock', boolean> = {
    left: false,
    right: false,
    jump: false,
    down: false,
    action: false,
    rope: false,
    rock: false,
  };
  private prevJump = false;
  private prevAction = false;
  private prevRope = false;
  private prevRock = false;
  private pauseCallbacks: Array<() => void> = [];
  private touchControls?: HTMLElement;
  private domCleanup: Array<() => void> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys(
        'LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,SHIFT,E,Q,R,ESC,P',
      ) as Record<string, Phaser.Input.Keyboard.Key>;
    }
    const touchCapable =
      scene.sys.game.device.input.touch || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    if (touchCapable) this.createTouchControls();
  }

  private createTouchControls(): void {
    const controls = document.getElementById('mobile-controls');
    if (!controls) return;
    this.touchControls = controls;
    controls.classList.add('active');
    controls.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gameplay-active');

    controls.querySelectorAll<HTMLButtonElement>('[data-control]').forEach((button) => {
      const key = button.dataset.control as keyof typeof this.touch;
      const setPressed = (pressed: boolean): void => {
        this.touch[key] = pressed;
        button.classList.toggle('pressed', pressed);
      };
      const down = (event: PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        button.setPointerCapture?.(event.pointerId);
        setPressed(true);
      };
      const up = (event: PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        setPressed(false);
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('lostpointercapture', up);
      this.domCleanup.push(() => {
        button.removeEventListener('pointerdown', down);
        button.removeEventListener('pointerup', up);
        button.removeEventListener('pointercancel', up);
        button.removeEventListener('lostpointercapture', up);
      });
    });

    const pause = document.getElementById('mobile-pause');
    const pauseGame = (event: Event): void => {
      event.preventDefault();
      this.pauseCallbacks.forEach((callback) => callback());
    };
    pause?.addEventListener('click', pauseGame);
    this.domCleanup.push(() => pause?.removeEventListener('click', pauseGame));
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
    const action = Boolean(k.E?.isDown) || this.touch.action || Boolean(pad?.B);
    const ropeDown = Boolean(k.Q?.isDown) || this.touch.rope || Boolean(pad?.Y);
    const rockDown = Boolean(k.R?.isDown) || this.touch.rock || Boolean(pad?.buttons[5]?.pressed);

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
    this.domCleanup.forEach((cleanup) => cleanup());
    this.domCleanup = [];
    this.touchControls?.classList.remove('active');
    this.touchControls?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gameplay-active');
    Object.keys(this.touch).forEach((key) => (this.touch[key as keyof typeof this.touch] = false));
  }
}
