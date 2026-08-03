import type { FastifyInstance } from 'fastify';
import {
  SCORE,
  getLevelDesign,
  leaderboardQuerySchema,
  startRunSchema,
  submitScoreSchema,
} from '@tito/shared';
import { prisma } from '../db.js';
import { createNonce, verifyScoreSignature } from '../lib/signature.js';

/** Estrellas segun desempeno (0-3). */
function computeStars(score: number, timeMs: number, deaths: number, timeLimit: number): number {
  let stars = 1;
  if (deaths === 0) stars++;
  if (timeMs <= timeLimit * 1000 * 0.55) stars++;
  if (score < 500) stars = Math.max(1, stars - 1);
  return Math.min(3, stars);
}

export async function runRoutes(app: FastifyInstance): Promise<void> {
  /** Inicia una partida y devuelve el nonce con el que se firma el resultado. */
  app.post('/api/runs/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Datos invalidos' } });
    }
    const { world, level } = parsed.data;
    const nonce = createNonce();

    const run = await prisma.run.create({
      data: { userId: req.user.sub, world, level, nonce },
      select: { id: true, nonce: true, startedAt: true },
    });

    return {
      ok: true,
      data: { runId: run.id, nonce: run.nonce, startedAt: run.startedAt.getTime() },
    };
  });

  /** Envia el resultado firmado de la partida. */
  app.post('/api/scores', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = submitScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Datos invalidos', details: parsed.error.flatten() },
      });
    }
    const body = parsed.data;

    const run = await prisma.run.findUnique({ where: { id: body.runId } });
    if (!run || run.userId !== req.user.sub) {
      return reply.code(404).send({ ok: false, error: { code: 'RUN_NOT_FOUND', message: 'Partida no encontrada' } });
    }
    if (run.closedAt) {
      return reply.code(409).send({ ok: false, error: { code: 'RUN_CLOSED', message: 'Partida ya registrada' } });
    }
    if (run.world !== body.world || run.level !== body.level) {
      return reply.code(400).send({ ok: false, error: { code: 'RUN_MISMATCH', message: 'Nivel no coincide' } });
    }

    const { signature, ...payload } = body;
    if (!verifyScoreSignature(payload, run.nonce, signature)) {
      await prisma.run.update({ where: { id: run.id }, data: { valid: false, closedAt: new Date() } });
      return reply.code(403).send({ ok: false, error: { code: 'BAD_SIGNATURE', message: 'Resultado no verificable' } });
    }

    // Sanidad: el tiempo declarado no puede ser menor al tiempo real transcurrido.
    const realElapsed = Date.now() - run.startedAt.getTime();
    if (body.timeMs > realElapsed + 5000) {
      return reply.code(400).send({ ok: false, error: { code: 'TIME_MISMATCH', message: 'Tiempo invalido' } });
    }

    const design = getLevelDesign(body.world, body.level);
    // Tope teorico de puntaje para el nivel (anti inflado).
    const maxScore =
      design.width * SCORE.coin +
      40 * SCORE.enemyStomp +
      3 * SCORE.gem +
      SCORE.levelClear +
      design.timeLimit * SCORE.timeBonusPerSecond +
      SCORE.noDamageBonus;
    if (body.score > maxScore) {
      return reply.code(400).send({ ok: false, error: { code: 'SCORE_TOO_HIGH', message: 'Puntaje imposible' } });
    }

    const stars = body.completed
      ? computeStars(body.score, body.timeMs, body.deaths, design.timeLimit)
      : 0;

    const [score] = await prisma.$transaction([
      prisma.score.create({
        data: {
          userId: req.user.sub,
          runId: run.id,
          world: body.world,
          level: body.level,
          score: body.score,
          timeMs: body.timeMs,
          coins: body.coins,
          enemiesDefeated: body.enemiesDefeated,
          deaths: body.deaths,
          completed: body.completed,
          stars,
        },
      }),
      prisma.run.update({ where: { id: run.id }, data: { closedAt: new Date() } }),
    ]);

    const rankRow = await prisma.score.count({
      where: { world: body.world, level: body.level, score: { gt: body.score } },
    });

    return reply.code(201).send({
      ok: true,
      data: { id: score.id, stars, rank: rankRow + 1 },
    });
  });

  /** Tabla de posiciones. */
  app.get('/api/leaderboard', { onRequest: [app.optionalAuth] }, async (req, reply) => {
    const parsed = leaderboardQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message: 'Query invalida' } });
    }
    const { world, level, limit, scope } = parsed.data;

    const where: Record<string, unknown> = { completed: true };
    if (world) where.world = world;
    if (level) where.level = level;
    if (scope === 'weekly') {
      where.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    }
    if (scope === 'me') {
      if (!req.user?.sub) {
        return reply.code(401).send({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Inicia sesion' } });
      }
      where.userId = req.user.sub;
    }

    const rows = await prisma.score.findMany({
      where,
      orderBy: [{ score: 'desc' }, { timeMs: 'asc' }],
      take: limit,
      include: { user: { select: { username: true } } },
    });

    return {
      ok: true,
      data: rows.map((r, i) => ({
        rank: i + 1,
        username: r.user.username,
        score: r.score,
        timeMs: r.timeMs,
        world: r.world,
        level: r.level,
        stars: r.stars,
        achievedAt: r.createdAt.toISOString(),
      })),
    };
  });
}
