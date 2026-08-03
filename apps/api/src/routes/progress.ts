import type { FastifyInstance } from 'fastify';
import { saveProgressSchema } from '@tito/shared';
import { prisma } from '../db.js';

export async function progressRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/progress', { onRequest: [app.authenticate] }, async (req) => {
    const progress = await prisma.progress.upsert({
      where: { userId: req.user.sub },
      update: {},
      create: { userId: req.user.sub },
    });

    return {
      ok: true,
      data: {
        currentWorld: progress.currentWorld,
        currentLevel: progress.currentLevel,
        lives: progress.lives,
        totalScore: progress.totalScore,
        coins: progress.coins,
        unlocked: progress.unlocked,
        levelStats: progress.levelStats,
        updatedAt: progress.updatedAt.toISOString(),
      },
    };
  });

  app.put('/api/progress', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = saveProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION', message: 'Progreso invalido', details: parsed.error.flatten() },
      });
    }
    const p = parsed.data;

    const saved = await prisma.progress.upsert({
      where: { userId: req.user.sub },
      update: {
        currentWorld: p.currentWorld,
        currentLevel: p.currentLevel,
        lives: p.lives,
        totalScore: p.totalScore,
        coins: p.coins,
        unlocked: p.unlocked,
        levelStats: p.levelStats,
      },
      create: {
        userId: req.user.sub,
        currentWorld: p.currentWorld,
        currentLevel: p.currentLevel,
        lives: p.lives,
        totalScore: p.totalScore,
        coins: p.coins,
        unlocked: p.unlocked,
        levelStats: p.levelStats,
      },
    });

    return { ok: true, data: { updatedAt: saved.updatedAt.toISOString() } };
  });
}
