import OpenAI from 'openai';
import type { AiCoachInput, AiCoachResponse } from '@tito/shared';
import { getWorld, getLevelDesign } from '@tito/shared';
import { env } from '../env.js';
import { prisma } from '../db.js';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!env.AI_ENABLED || !env.OPENAI_API_KEY) return null;
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 12_000, maxRetries: 1 });
  return client;
}

/** Consejos locales (sin costo) usados como fallback o si AI_ENABLED=false. */
const LOCAL_TIPS: Record<string, string[]> = {
  enemigo: [
    'Salta sobre los enemigos justo antes de tocarlos: el rebote te da altura extra.',
    'Encadena saltos sobre enemigos seguidos para multiplicar tu puntaje.',
    'Si un enemigo tiene pinchos, no lo pises: esquivalo o usa una plataforma.',
  ],
  caida: [
    'Manten presionado el salto para llegar mas lejos; suelta para saltos cortos.',
    'Corre antes de saltar: la velocidad se convierte en distancia.',
    'Usa las monedas del aire como guia: marcan la trayectoria correcta.',
  ],
  pinchos: [
    'Los pinchos solo danan por arriba y por los lados: salta con margen.',
    'Busca la plataforma flotante antes de los pinchos, casi siempre hay una ruta segura.',
  ],
  lava: [
    'En el Castillo de Lava usa los trampolines, te dan altura de sobra.',
    'Las plataformas moviles sobre lava tienen ritmo: cuenta antes de saltar.',
  ],
  tiempo: [
    'No recojas todas las monedas en la primera pasada, prioriza avanzar.',
    'Los checkpoints guardan el tiempo: llega a ellos rapido.',
  ],
  desconocido: [
    'Explora hacia arriba: hay gemas escondidas que valen 500 puntos.',
    'Los bloques con "?" sueltan monedas y power-ups.',
  ],
};

const LOCAL_TAUNTS = [
  'Tito cree en ti... casi siempre.',
  'Otra vez? Ese pozo ya te conoce por tu nombre.',
  'Respira, corre, salta. En ese orden.',
  'Los grandes campeones tambien caen. Muchas veces.',
  'Ese enemigo ya te esta esperando. Sorprendelo.',
];

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function localCoach(input: AiCoachInput): AiCoachResponse {
  const tips = LOCAL_TIPS[input.lastDeathCause] ?? LOCAL_TIPS.desconocido!;
  const seed = input.deaths + input.world * 3 + input.level;
  return {
    tip: pick(tips, seed),
    taunt: pick(LOCAL_TAUNTS, seed + 1),
    source: 'local',
  };
}

/**
 * Genera un consejo del "entrenador Tito" usando OpenAI.
 * Cachea por (mundo, nivel, causa, rango de muertes) para no gastar tokens.
 */
export async function getAiCoach(input: AiCoachInput): Promise<AiCoachResponse> {
  const deathBucket = input.deaths >= 10 ? '10+' : input.deaths >= 5 ? '5-9' : String(input.deaths);
  const cacheKey = `coach:${input.world}-${input.level}:${input.lastDeathCause}:${deathBucket}`;

  const cached = await prisma.aiTipCache.findUnique({ where: { cacheKey } }).catch(() => null);
  if (cached) return { tip: cached.tip, taunt: cached.taunt, source: 'openai' };

  const openai = getClient();
  if (!openai) return localCoach(input);

  const world = getWorld(input.world);
  const design = getLevelDesign(input.world, input.level);

  try {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.9,
      max_tokens: 180,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Eres "Tito", la mascota-entrenador de un juego de plataformas 2D estilo Mario Bros. ' +
            'Respondes SIEMPRE en espanol neutro, en JSON con las claves "tip" y "taunt". ' +
            '"tip" es un consejo concreto de jugabilidad (max 22 palabras). ' +
            '"taunt" es una frase divertida y motivadora (max 14 palabras). ' +
            'Nada de groserias ni contenido ofensivo. No inventes mecanicas que no se mencionan.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            mundo: world.name,
            ambiente: world.subtitle,
            nivel: design.name,
            jefe: design.boss ?? null,
            enemigos: design.enemies,
            muertes: input.deaths,
            causaUltimaMuerte: input.lastDeathCause,
            segundosJugados: Math.round(input.timeMs / 1000),
            mecanicas: [
              'salto variable manteniendo el boton',
              'pisar enemigos para eliminarlos',
              'coyote time y jump buffer',
              'trampolines',
              'plataformas moviles',
              'bloques ? con monedas y power-ups',
              'checkpoints',
            ],
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { tip?: string; taunt?: string };
    const result: AiCoachResponse = {
      tip: (parsed.tip ?? '').slice(0, 220) || localCoach(input).tip,
      taunt: (parsed.taunt ?? '').slice(0, 140) || localCoach(input).taunt,
      source: 'openai',
    };

    await prisma.aiTipCache
      .create({ data: { cacheKey, tip: result.tip, taunt: result.taunt } })
      .catch(() => undefined);

    return result;
  } catch {
    return localCoach(input);
  }
}
