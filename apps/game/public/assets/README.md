# Assets de Tito Game — medidas y formatos

Todo el juego funciona **sin ningun archivo aqui**: si un asset falta, se dibuja
un placeholder por codigo. Cuando pongas tus archivos con estos nombres y medidas
exactas, el juego los usa automaticamente.

La rejilla base del juego es de **32 x 32 px** y la resolucion logica es **960 x 540** (16:9).

---

## 1. Personaje: Tito

**Ruta exacta:** `apps/game/public/assets/characters/tito.png`

| Propiedad | Valor obligatorio |
|---|---|
| Tamano de cada frame | **48 x 48 px** |
| Numero de frames | **12** |
| Disposicion | **1 fila horizontal** (hoja final de **576 x 48 px**) |
| Formato | PNG-24 con transparencia |
| Fondo | Transparente (sin margenes de color) |
| Estilo | Pixel art, sin antialias (el juego usa `pixelArt: true`) |
| Pies del personaje | Alineados al **borde inferior** del frame |
| Ancho del cuerpo | Que quepa dentro de ~24 px centrados (la caja de colision es 24 x 38) |

### Orden exacto de los 12 frames

| Frame | Uso | Notas |
|---|---|---|
| 0 | Idle 1 | Parado, mirando a la **derecha** |
| 1 | Idle 2 | Respiracion / parpadeo |
| 2 | Correr 1 | Ciclo de carrera |
| 3 | Correr 2 | |
| 4 | Correr 3 | |
| 5 | Correr 4 | |
| 6 | Correr 5 | |
| 7 | Correr 6 | |
| 8 | Salto | Subiendo |
| 9 | Caida | Bajando |
| 10 | Dano / muerte | |
| 11 | Agachado | Mas bajo, cabe en 1 tile |

> Importante: Tito debe dibujarse **mirando a la derecha**. El juego voltea el
> sprite automaticamente al ir a la izquierda.

### Alternativa automatica: `branding/tito.png`

Si **no** existe `characters/tito.png`, el juego usa la ilustracion de cuerpo
entero `apps/game/public/assets/branding/tito.png` y **genera la hoja de 12 frames
solo**, en tiempo de carga:

1. Quita el fondo verde (chroma key) y recorta al personaje.
2. Lo separa en 7 piezas: cabeza, torso, capa, brazo delantero, brazo trasero,
   pierna delantera y pierna trasera.
3. Rota cada pieza sobre su articulacion para armar las 12 poses (idle, ciclo de
   carrera de 6 frames, salto, caida, dano y agachado) y las hornea en una hoja
   de 576 x 48 px.

Requisitos de esa ilustracion: personaje **de pie, de frente/tres cuartos, mirando
a la derecha**, sobre **fondo verde solido**, cualquier resolucion (la actual es
1254 x 1254). Si quieres ajustar las poses, edita la tabla `POSES` (angulos en
grados por pieza) en `apps/game/src/systems/TitoRig.ts`.

Prioridad: `characters/tito.png` > rig de `branding/tito.png` > placeholder dibujado por codigo.

### Version en alta resolucion (opcional)
Si tu arte es HD, exporta a **96 x 96 px por frame** (hoja de 1152 x 96) y cambia
`TITO_FRAME_WIDTH` / `TITO_FRAME_HEIGHT` a `96` en
`packages/shared/src/constants.ts`. No hace falta tocar nada mas.

---

## 2. Logo

**Ruta exacta:** `apps/game/public/assets/branding/logo.png`

| Propiedad | Valor recomendado |
|---|---|
| Tamano | **1024 x 512 px** (se escala solo, max 420 px de ancho en pantalla) |
| Formato | PNG-24 con transparencia |
| Margen interno | 5% de aire alrededor para que no se corte |
| Contraste | Debe leerse sobre fondo oscuro (`#0d1117`) |

### Derivados del logo (opcionales pero recomendados)

| Archivo | Tamano | Uso |
|---|---|---|
| `branding/logo.png` | 1024 x 512 | Menu principal y pantalla de carga HTML |
| `branding/favicon-32.png` | 32 x 32 | Favicon del navegador |
| `branding/icon-180.png` | 180 x 180 | Icono para iOS / acceso directo |
| `branding/icon-512.png` | 512 x 512 | Icono PWA / tienda |
| `branding/og-image.png` | 1200 x 630 | Vista previa al compartir el link |

---

## 3. Enemigos, objetos, tilesets y fondos

Todos estos archivos son **opcionales** y se sustituyen solos. Los enemigos comunes
incluidos usan hojas reales de 4 cuadros; el codigo combina esas poses con fisica,
rebote e inclinacion. Los objetos y el jefe tambien admiten hojas horizontales.

### 3.1 Enemigos — carpeta `enemies/`

| Archivo | Criatura | Movimiento |
|---|---|---|---|
| `enemies/goomb-sheet.png` | Conejo explorador | corre, mueve patas/orejas y salta |
| `enemies/spiker-sheet.png` | Dragon espinoso | camina, mueve cabeza/alas y lanza fuego |
| `enemies/flyer-sheet.png` | Anguila celeste | ondula cuerpo/aletas y dispara burbujas |
| `enemies/slider-sheet.png` | Centauro corredor | galope completo y carga rapida |
| `enemies/ghost-sheet.png` | Avatar elemental | mueve cabeza/manos y lanza energia |
| `enemies/boss.png` | Jefe | hoja de 4 frames de 64x64 |

- Los cinco artes incluidos miran a la derecha y el juego los voltea automaticamente.
- Si no pones `boss.png`, el jefe reutiliza el conejo normalizado a 88x88 y tenido de rojo.

### 3.2 Objetos y coleccionables — carpeta `props/`

| Archivo | Hoja completa | Frames | Animacion |
|---|---|---|---|
| `props/coin-silver.png` | alta resolucion | 1 | plata con ajolote, valor 1 |
| `props/coin-gold.png` | alta resolucion | 1 | centenario ficticio, valor 5 |
| `props/banknote-tito.png` | alta resolucion | 1 | billete ficticio, valor 10 |
| `props/gem.png` | **156 x 26** | 6 de 26x26 | brillo, 10 fps, bucle |
| `props/spring.png` | **128 x 20** | 4 de 32x20 | rebote, 18 fps, una vez |
| `props/checkpoint.png` | **96 x 56** | 4 de 24x56 | 0-1 apagado / 2-3 activado |
| `props/goal-flag.png` | **128 x 96** | 4 de 32x96 | ondear, 6 fps, bucle |
| `props/powerup-grande.png` | **104 x 26** | 4 de 26x26 | idle, 8 fps, bucle |
| `props/powerup-fuego.png` | **104 x 26** | 4 de 26x26 | idle, 8 fps, bucle |
| `props/powerup-hielo.png` | **104 x 26** | 4 de 26x26 | idle, 8 fps, bucle |
| `props/powerup-estrella.png` | **104 x 26** | 4 de 26x26 | idle, 12 fps, bucle |
| `props/platform-h.png` | **384 x 20** | 4 de 96x20 | idle, 6 fps, bucle |
| `props/particle.png` | **8 x 8** | 1 (estatica) | — |

- `spring`, `checkpoint` y `goal-flag` se dibujan con **origen abajo**.
- En `spring` el **frame 0 es el reposo**: al pisarlo reproduce 1-2-3 y vuelve al 0.
- En `checkpoint` los frames **0-1** son el estado apagado y los **2-3** el activado.

### 3.3 Tilesets — carpeta `tilesets/`

| Archivo | Tamano | Contenido |
|---|---|---|
| `tilesets/world-1.png` ... `world-5.png` | **256 x 32** | 8 tiles de 32x32 en fila |

Orden exacto de los 8 tiles: `0 solido`, `1 plataforma (one-way)`, `2 ladrillo`,
`3 bloque ?`, `4 bloque de poder`, `5 pinchos`, `6 lava/agua`, `7 bloque usado`.

### 3.4 Fondos — carpeta `backgrounds/`

| Archivo | Tamano | Notas |
|---|---|---|
| `backgrounds/sky-w1.png` ... `sky-w5.png` | **64 x 540** | Degradado vertical, se repite en X |
| `backgrounds/far-w1.png` ... `far-w5.png` | **512 x 220** | Parallax 0.25, con transparencia, se repite en X |
| `backgrounds/scene-w1.png` ... `scene-w5.png` | **16:9** | Escena panoramica completa; tiene prioridad sobre sky/far |

---

## 4. Como integrar tus archivos

1. Copia cada PNG a su carpeta con el **nombre exacto** de las tablas de arriba.
2. Recarga el juego con **Ctrl + F5** (o reinicia `npm run dev:game`).
3. Listo: el juego deja de usar el placeholder de ese asset. Los que falten
   siguen generandose por codigo, no hace falta ponerlos todos.

Cada carpeta tiene un `PON_AQUI_*.txt` con el recordatorio de nombres y medidas.

> Como funciona por dentro: `apps/game/src/systems/AssetManifest.ts` es la lista
> unica de assets (clave, ruta, tamano de frame y animaciones). `BootScene`
> comprueba cuales existen, `PreloadScene` carga los que estan y registra las
> animaciones recortando el rango al numero real de frames de tu PNG.

Para verificar que la hoja de sprites este bien cortada, abre el juego con
`VITE_PHYSICS_DEBUG=true` en el `.env` y observa las cajas de colision.
