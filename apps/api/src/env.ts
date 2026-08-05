import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Carga .env de la raiz del monorepo y luego el local de la app.
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env'), override: true });
if (process.env.NODE_ENV !== 'production') {
  config({ path: resolve(process.cwd(), '../../.env.superadmin'), override: true });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL (Neon)'),
  DIRECT_URL: z.string().optional(),

  JWT_SECRET: z.string().min(24, 'JWT_SECRET debe tener al menos 24 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SCORE_HMAC_SECRET: z.string().min(16).default('tito-score-secret-dev-only'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  AI_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /** Carpeta con el build del cliente para servir en produccion. */
  STATIC_DIR: z.string().default('../game/dist'),

  /** Panel de despliegue: solo se registra en desarrollo y acepta conexiones loopback. */
  SUPERADMIN_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SUPERADMIN_USER: z.string().optional(),
  SUPERADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n[TITO API] Configuracion invalida en .env:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nCopia .env.example a .env y completa los valores.\n');
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
