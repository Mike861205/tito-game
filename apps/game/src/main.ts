import Phaser from 'phaser';
import { gameConfig } from './config';

const game = new Phaser.Game(gameConfig);

// Oculta la pantalla de carga HTML cuando Phaser esta listo.
game.events.once(Phaser.Core.Events.READY, () => {
  const boot = document.getElementById('boot-screen');
  if (boot) {
    boot.classList.add('hidden');
    window.setTimeout(() => boot.remove(), 500);
  }
});

// Pausa el juego si la pestana pierde el foco.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
});

export default game;
