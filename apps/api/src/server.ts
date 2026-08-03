import { buildApp } from './app.js';
import { checkDatabase, prisma } from './db.js';
import { env } from './env.js';

async function main(): Promise<void> {
  const app = await buildApp();

  const dbUp = await checkDatabase();
  if (!dbUp) {
    app.log.warn(
      'No hay conexion con la base de datos (Neon). La API arranca igual, pero auth/scores fallaran. Revisa DATABASE_URL.',
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} recibido, cerrando...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(`TITO GAME API lista en http://localhost:${env.API_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
