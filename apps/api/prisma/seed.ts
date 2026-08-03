import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LEVELS } from '@tito/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Sembrando catalogo de niveles...');
  for (const l of LEVELS) {
    await prisma.levelCatalog.upsert({
      where: { id: l.id },
      update: {
        name: l.name,
        seed: l.seed,
        width: l.width,
        difficulty: l.difficulty,
        timeLimit: l.timeLimit,
        boss: l.boss ?? null,
      },
      create: {
        id: l.id,
        world: l.world,
        level: l.level,
        name: l.name,
        seed: l.seed,
        width: l.width,
        difficulty: l.difficulty,
        timeLimit: l.timeLimit,
        boss: l.boss ?? null,
      },
    });
  }
  console.log(`  ${LEVELS.length} niveles listos.`);

  if (process.env.NODE_ENV !== 'production') {
    const demoPassword = await bcrypt.hash('TitoDemo123', 12);
    const demo = await prisma.user.upsert({
      where: { email: 'demo@titogame.dev' },
      update: {},
      create: {
        email: 'demo@titogame.dev',
        username: 'tito_demo',
        passwordHash: demoPassword,
        progress: { create: { unlocked: ['1-1', '1-2', '1-3'] } },
      },
    });
    console.log(`Usuario demo: ${demo.email} / TitoDemo123`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
