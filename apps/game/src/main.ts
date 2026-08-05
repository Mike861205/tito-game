import Phaser from 'phaser';
import { gameConfig } from './config';

const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

async function enterImmersiveMode(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch {
    /* Algunos navegadores moviles no ofrecen fullscreen para pestanas normales. */
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    /* El bloqueo de orientacion solo esta disponible en ciertos navegadores. */
  }
}

document.getElementById('fullscreen-button')?.addEventListener('click', () => void enterImmersiveMode());
document.getElementById('rotate-fullscreen')?.addEventListener('click', () => void enterImmersiveMode());

if (window.location.pathname.startsWith('/superadmin')) {
  if (isLocalHost) {
    void import('./superadmin').then(({ renderSuperadmin }) => renderSuperadmin());
  } else {
    window.location.replace('/');
  }
} else {
  startGame();
}

function startGame(): void {
  const game = new Phaser.Game(gameConfig);

// Oculta la pantalla de carga HTML cuando Phaser esta listo.
  game.events.once(Phaser.Core.Events.READY, () => {
  const boot = document.getElementById('boot-screen');
  if (boot) {
    boot.classList.add('hidden');
    window.setTimeout(() => {
      boot.remove();
      // Recalcula la posicion del canvas: si no, los clics quedan desfasados.
      game.scale.refresh();
    }, 500);
  }
  });

// Phaser ya pausa el juego solo cuando la pestana pierde el foco
// (Scale.pauseOnBlur), no hace falta manejarlo a mano.

// En moviles la barra de direcciones cambia el alto sin disparar siempre
// 'resize': sin refresh los toques quedan desfasados del canvas.
  window.visualViewport?.addEventListener('resize', () => game.scale.refresh());
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => game.scale.refresh(), 250);
  });

// Acceso para depurar desde la consola del navegador (solo en desarrollo).
  if (import.meta.env.DEV) {
    (window as unknown as { __tito: Phaser.Game }).__tito = game;
  }
}
