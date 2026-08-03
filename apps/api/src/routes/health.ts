import type { FastifyInstance } from 'fastify';
import { checkDatabase } from '../db.js';
import { env } from '../env.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => {
    const db = await checkDatabase();
    return {
      ok: true,
      data: {
        status: db ? 'healthy' : 'degraded',
        env: env.NODE_ENV,
        database: db ? 'up' : 'down',
        ai: env.AI_ENABLED ? 'on' : 'off',
        time: new Date().toISOString(),
      },
    };
  });
}
