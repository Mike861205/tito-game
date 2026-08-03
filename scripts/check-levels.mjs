import { LEVELS, generateLevel, TILE, levelToString } from '../packages/shared/dist/index.js';

/**
 * Verificacion rapida de los 20 niveles generados.
 * Uso:  node scripts/check-levels.mjs        -> tabla resumen
 *       node scripts/check-levels.mjs 1-1    -> imprime el mapa en ASCII
 */
const target = process.argv[2];

if (target) {
  const design = LEVELS.find((l) => l.id === target);
  if (!design) {
    console.error(`Nivel ${target} no existe.`);
    process.exit(1);
  }
  console.log(levelToString(generateLevel(design)));
  process.exit(0);
}

const ENEMY_CHARS = [
  TILE.ENEMY_GOOMB,
  TILE.ENEMY_SPIKER,
  TILE.ENEMY_FLYER,
  TILE.ENEMY_SLIDER,
  TILE.ENEMY_GHOST,
  TILE.BOSS,
];

let fails = 0;

for (const design of LEVELS) {
  const level = generateLevel(design);
  const flat = level.grid.flat();
  const count = (ch) => flat.filter((c) => c === ch).length;

  const spawn = count(TILE.SPAWN);
  const goal = count(TILE.GOAL);
  const coins = count(TILE.COIN);
  const gems = count(TILE.GEM);
  const enemies = flat.filter((c) => ENEMY_CHARS.includes(c)).length;

  const ok = spawn === 1 && goal === 1 && coins > 5;
  if (!ok) fails++;

  console.log(
    [
      design.id.padEnd(4),
      design.name.padEnd(28),
      `ancho=${String(level.width).padStart(3)}`,
      `monedas=${String(coins).padStart(3)}`,
      `gemas=${gems}`,
      `enemigos=${String(enemies).padStart(2)}`,
      `checkpoints=${level.checkpoints.length}`,
      `tiempo=${design.timeLimit}s`,
      ok ? 'OK' : 'FALLA',
    ].join('  '),
  );
}

console.log(fails === 0 ? '\nTodos los niveles son validos.' : `\n${fails} niveles con problemas.`);
process.exit(fails === 0 ? 0 : 1);
