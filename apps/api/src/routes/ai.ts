import type { FastifyInstance } from 'fastify';
import { aiCoachSchema } from '@tito/shared';
import { getAiCoach } from '../lib/openai.js';

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/ai/coach',
    {
      onRequest: [app.optionalAuth],
      config: { rateLimit: { max: 30, timeWindow: '5 minutes' } },
    },
    async (req, reply) => {
      const parsed = aiCoachSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ ok: false, error: { code: 'VALIDATION', message: 'Datos invalidos' } });
      }
      const data = await getAiCoach(parsed.data);
      return { ok: true, data };
    },
  );
}
