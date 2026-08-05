/**
 * Verifica que la base de datos configurada responde y muestra un resumen.
 * Uso: npm run db:check   |   npm run db:check:prod
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0] ?? '(sin DATABASE_URL)';
  const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;

  const [levels, users, scores] = await Promise.all([
    prisma.levelCatalog.count(),
    prisma.user.count(),
    prisma.score.count(),
  ]);

  console.log(`Entorno    : ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`Host       : ${host}`);
  console.log(`Postgres   : ${version.split(',')[0]}`);
  console.log(`Niveles    : ${levels}`);
  console.log(`Usuarios   : ${users}`);
  console.log(`Puntajes   : ${scores}`);
}

main()
  .catch((err) => {
    console.error('Conexion fallida:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
