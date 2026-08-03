# Neon Postgres: desarrollo y produccion

Neon permite tener **branches de base de datos** igual que en Git. Usaremos dos:

| Branch | Uso | Variable |
|---|---|---|
| `development` | Tu maquina local. Se puede borrar y recrear sin miedo. | `.env` local |
| `production` (main) | El servidor Liquid Web. Solo migraciones aplicadas. | Variables de entorno del VPS |

---

## 1. Crear el proyecto

1. Entra a <https://console.neon.tech> y crea un proyecto llamado `tito-game`.
2. Region recomendada: la mas cercana al VPS de Liquid Web (normalmente `us-east-2`).
3. Nombre de la base de datos: `tito_game`.

## 2. Crear la branch de desarrollo

En el panel de Neon: **Branches -> New Branch**, nombre `development`, creada desde `main`.

## 3. Copiar las cadenas de conexion

Para **cada** branch necesitas dos URLs:

| Variable | Cual copiar en Neon | Para que |
|---|---|---|
| `DATABASE_URL` | La que dice **Pooled connection** (contiene `-pooler`) | Consultas de la app |
| `DIRECT_URL` | La **Direct connection** (sin `-pooler`) | `prisma migrate` |

Ambas terminan en `?sslmode=require`. Ejemplo:

```env
DATABASE_URL="postgresql://tito_owner:XXXX@ep-cool-sun-123456-pooler.us-east-2.aws.neon.tech/tito_game?sslmode=require"
DIRECT_URL="postgresql://tito_owner:XXXX@ep-cool-sun-123456.us-east-2.aws.neon.tech/tito_game?sslmode=require"
```

## 4. Aplicar el esquema

```powershell
# Desarrollo: crea la migracion y la aplica
npm run db:migrate -- --name init

# Datos iniciales (catalogo de 20 niveles + usuario demo)
npm run db:seed
```

En **produccion** nunca uses `migrate dev`. En el servidor:

```bash
npm run db:deploy --workspace @tito/api   # prisma migrate deploy
```

## 5. Verificar

```powershell
npm run db:studio          # explorador visual
curl http://localhost:3001/api/health
```

`"database": "up"` significa que la conexion funciona.

---

## Tablas creadas

| Tabla | Contenido |
|---|---|
| `users` | Cuentas (email, username, hash bcrypt, rol) |
| `progress` | Progreso por usuario: mundo/nivel actual, vidas, desbloqueados, estrellas |
| `runs` | Cada partida iniciada con su `nonce` anti-trampa |
| `scores` | Resultados verificados; alimenta la tabla de posiciones |
| `level_catalog` | Los 20 niveles (semilla, ancho, dificultad, jefe) |
| `ai_tip_cache` | Cache de respuestas de OpenAI para no repetir tokens |

---

## Consejos

- **Nunca** commitees el `.env`. Ya esta en `.gitignore`.
- Si rotas la contrasena de Neon, actualiza `DATABASE_URL` y `DIRECT_URL` en ambos lados.
- Neon suspende la base de datos por inactividad: la primera consulta puede tardar ~1s.
  El endpoint `/api/health` sirve para "despertarla".
- Para resetear desarrollo: **Reset from parent** en la branch `development`.
