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

## 3. Assets opcionales (mejoras futuras)

Si quieres reemplazar tambien el arte generado por codigo, usa estas medidas:

| Archivo | Tamano | Notas |
|---|---|---|
| `tilesets/world-1.png` ... `world-5.png` | 256 x 32 | 8 tiles de 32x32 en fila: solido, plataforma, ladrillo, `?`, poder, pinchos, lava, usado |
| `enemies/goomb.png` | 32 x 32 | Patrulla por el suelo |
| `enemies/spiker.png` | 32 x 32 | No se puede pisar |
| `enemies/flyer.png` | 32 x 32 | Vuela en onda |
| `enemies/slider.png` | 32 x 32 | Rapido |
| `enemies/ghost.png` | 32 x 32 | Persigue a Tito |
| `props/coin.png` | 24 x 24 | |
| `props/gem.png` | 26 x 26 | |
| `props/spring.png` | 32 x 20 | |
| `props/checkpoint.png` | 24 x 56 | Origen abajo |
| `props/goal-flag.png` | 32 x 96 | Origen abajo |
| `backgrounds/sky-w1.png` ... | 64 x 540 | Degradado vertical, se repite en X |
| `backgrounds/far-w1.png` ... | 512 x 220 | Capa de parallax (0.25) |

---

## 4. Como integrar tus archivos

1. Copia tu sprite a `apps/game/public/assets/characters/tito.png`.
2. Copia tu logo a `apps/game/public/assets/branding/logo.png`.
3. Reinicia `npm run dev:game` (Vite recarga solo, pero el cache del navegador
   a veces requiere Ctrl+F5).
4. Listo: el juego deja de usar los placeholders automaticamente.

Para verificar que la hoja de sprites este bien cortada, abre el juego con
`VITE_PHYSICS_DEBUG=true` en el `.env` y observa la caja de colision de Tito.
