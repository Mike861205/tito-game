import type { FastifyInstance } from 'fastify';
import { LEVELS, WORLDS, getLevelDesign } from '@tito/shared';

export async function levelRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/worlds', async () => ({ ok: true, data: WORLDS }));

  app.get('/api/levels', async () => ({ ok: true, data: LEVELS }));

  app.get<{ Params: { world: string; level: string } }>(
    '/api/levels/:world/:level',
    async (req, reply) => {
      const world = Number(req.params.world);
      const level = Number(req.params.level);
      try {
        return { ok: true, data: getLevelDesign(world, level) };
      } catch {
        return reply
          .code(404)
          .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Nivel inexistente' } });
      }
    },
  );
}
