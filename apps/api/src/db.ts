import { PrismaClient } from '@prisma/client';
import { env, isProd } from './env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProd) globalForPrisma.prisma = prisma;

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
