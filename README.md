# TITO GAME

Juego de plataformas 2D estilo Mario Bros protagonizado por **Tito**, con **5 mundos x 4 niveles**
(20 niveles), fisica pulida de destreza, jefes, tabla de posiciones online y un "coach" con IA.

---

## Stack

| Capa | Tecnologia | Por que |
|---|---|---|
| Motor de juego | **Phaser 3.87** + TypeScript | El estandar para plataformas 2D en web: fisica Arcade, tilemaps, escalado y gamepad de fabrica |
| Build cliente | **Vite 6** | HMR instantaneo, build optimizado, code-splitting de Phaser |
| API | **Fastify 5** + TypeScript (ESM) | El framework Node mas rapido, con plugins de seguridad oficiales |
| ORM | **Prisma 6** | Migraciones versionadas y tipos generados; soporte nativo de Neon (`directUrl`) |
| Base de datos | **Neon Postgres** (serverless) | Branches de BD: una para `development` y otra para `production` |
| Validacion | **Zod** compartido entre cliente y servidor | Un solo contrato de datos, sin duplicar tipos |
| IA | **OpenAI** (`gpt-4o-mini`) | Consejos y frases del entrenador Tito, con cache en BD para no gastar tokens |
| Seguridad | Helmet, CORS, rate-limit, JWT, bcrypt, HMAC de puntajes | Cubre OWASP Top 10 basico |
| Hosting | **Liquid Web** (VPS) + PM2 + Nginx | Control total, HTTP/2, TLS y proceso persistente |
| Repo | **Git** monorepo con npm workspaces | Un solo `npm install`, tipos compartidos sin publicar paquetes |

---

## Estructura

```
tito-game/
├── apps/
│   ├── api/                  # Fastify + Prisma + OpenAI
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── routes/       # auth, levels, scores, progress, ai, health
│   │       ├── lib/          # firma HMAC de puntajes, cliente OpenAI
│   │       ├── app.ts        # plugins y seguridad
│   │       └── server.ts
│   └── game/                 # Cliente Phaser
│       ├── public/assets/    # <-- AQUI VAN TU TITO Y TU LOGO (ver assets/README.md)
│       └── src/
│           ├── scenes/       # Boot, Preload, Menu, WorldMap, Game, Hud, Pause, ...
│           ├── objects/      # Tito, Enemy
│           ├── systems/      # LevelBuilder, TextureFactory, Input, Audio, Save, Api
│           └── ui/
├── packages/shared/          # Constantes, esquemas Zod y generador de niveles
├── scripts/check-levels.mjs  # Valida/imprime los 20 niveles
└── deploy/                   # PM2 + Nginx para Liquid Web
```

---

## Arranque rapido (local)

```powershell
# 1. Dependencias (ya instaladas)
npm install

# 2. Configuracion
Copy-Item .env.example .env    # y edita los valores

# 3. Base de datos (cuando tengas la URL de Neon)
npm run db:generate
npm run db:push
npm run db:seed

# 4. Levantar todo (API en :3001 y juego en :5173)
npm run dev
```

Abre <http://localhost:5173>.

> El juego **funciona sin base de datos y sin assets**: guarda el progreso en el
> navegador y dibuja graficos placeholder. La BD solo agrega cuentas, ranking
> global y progreso en la nube.

### Comandos

| Comando | Que hace |
|---|---|
| `npm run dev` | API + juego con recarga en caliente |
| `npm run build` | Compila shared, API y cliente |
| `npm start` | Ejecuta la API en produccion (tambien sirve el juego) |
| `npm run typecheck` | Revisa tipos en todos los paquetes |
| `npm run db:migrate` | Crea una migracion de Prisma |
| `npm run db:studio` | Abre Prisma Studio |
| `node scripts/check-levels.mjs` | Tabla con los 20 niveles |
| `node scripts/check-levels.mjs 3-2` | Imprime ese nivel en ASCII |

---

## Controles

| Accion | Teclado | Gamepad | Touch |
|---|---|---|---|
| Mover | Flechas / A D | Stick o D-pad | Botones `<` `>` |
| Saltar (mantener = mas alto) | Espacio / Arriba / W | A | Boton `A` |
| Agacharse | Abajo / S | D-pad abajo | Boton `v` |
| Correr | Shift | X | - |
| Disparar arma equipada (roca al iniciar) | E / R | B / RB | - |
| Enganchar y mantener el lazo volador | Q | Y | - |
| Subir / bajar mientras usa el lazo | Espacio / Abajo | A / D-pad abajo | `A` / `v` |
| Pausa | ESC / P | - | - |

---

## Los 5 mundos

| # | Mundo | Ambiente | Jefe |
|---|---|---|---|
| 1 | Praderas de Tito | Verde, introduccion | Rey Bellota |
| 2 | Desierto Dorado | Arena, trampas, plataformas moviles | Escorpio Mayor |
| 3 | Cavernas de Hielo | Piso resbaloso (friccion 25%) | Yeti Glacial |
| 4 | Fabrica de Tuercas | Precision, plataformas verticales | Mecha-Tuerca |
| 5 | Castillo de Lava | Lava en los abismos, fantasmas | Lord Magma |

Los niveles incluyen puntos dorados para volar y levitar con el lazo. Tito
empieza disparando rocas; cada nivel garantiza pronto un bloque de premio que
cambia el arma por fuego o hielo. Tambien hay fondos panoramicos propios de
cada mundo.
Los dragones, anguilas y avatares disparan; dragones y anguilas dejan huevos
que incuban mini-enemigos (maximo 12 por nivel y 4 huevos simultaneos).
El tesoro usa plata (1), centenarios dorados ficticios (5) y billetes
conmemorativos de Tito (10), todos con puntaje proporcional.
Se generan de forma **determinista** con una semilla, asi que son
identicos siempre y verificables desde el servidor. Una pasada de seguridad
garantiza que ningun abismo supere la distancia de salto y ningun escalon
supere los 3 tiles de altura: **siempre se pueden pasar**.

---

## Tus assets (Tito y el logo)

Todo esta listo para que solo pegues tus archivos:

| Archivo | Ruta exacta | Medidas |
|---|---|---|
| Sprite de Tito | `apps/game/public/assets/characters/tito.png` | **576 x 48 px** = 12 frames de **48 x 48**, en una fila, mirando a la derecha |
| Logo | `apps/game/public/assets/branding/logo.png` | **1024 x 512 px**, PNG transparente |

Orden de los frames: `0-1 idle | 2-7 correr | 8 salto | 9 caida | 10 dano | 11 agachado`.

El detalle completo (favicon, iconos, tilesets opcionales) esta en
[apps/game/public/assets/README.md](apps/game/public/assets/README.md).

---

## Datos que necesito de ti para conectar todo

Pegalos en el archivo `.env` (nunca se sube a Git):

1. **Neon - branch de desarrollo**: `DATABASE_URL` y `DIRECT_URL`
2. **Neon - branch de produccion**: las mismas dos, pero se configuran en el servidor
3. **OpenAI**: `OPENAI_API_KEY` (y pon `AI_ENABLED=true`)
4. **Liquid Web**: IP/host del VPS, usuario SSH y el dominio

Los secretos `JWT_SECRET` y `SCORE_HMAC_SECRET` los generas asi:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Seguridad

- Contrasenas con **bcrypt** (12 rondas) y comparacion en tiempo constante.
- **JWT** firmado, expiracion configurable.
- **Rate limiting** global y reforzado en login/registro.
- **Helmet** + CSP en produccion, CORS con lista blanca de origenes.
- Validacion de **todas** las entradas con Zod.
- Puntajes: cada partida abre un `Run` con `nonce`; el resultado se firma con
  HMAC y el servidor ademas valida tiempo real transcurrido, run unico y tope
  teorico de puntos por nivel.
- Prisma parametriza las consultas (sin SQL injection).

---

## Despliegue

Ver [docs/DEPLOY-LIQUIDWEB.md](docs/DEPLOY-LIQUIDWEB.md) y [docs/NEON.md](docs/NEON.md).
