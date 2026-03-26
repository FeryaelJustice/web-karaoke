# Runtime And Integrations

## Estado del runtime

El repositorio ya esta montado como app Vite + React.

Piezas principales:

- `package.json` con scripts `dev`, `build` y `preview`
- `vite.config.js` con `@vitejs/plugin-react`, `@tailwindcss/vite` y alias `@`
- `jsconfig.json` para resolver `@/*` en el editor
- `index.html` como shell HTML
- `src/main.jsx` como entrypoint React
- `src/index.css` con import de Tailwind v4

## Integraciones externas

### LRCLIB

Uso:

- endpoint de busqueda: `https://lrclib.net/api/search?q=...`
- filtro local: solo se conservan resultados con `syncedLyrics`

Comportamiento:

- la busqueda se bloquea si no hay texto o si `navigator.onLine` es falso
- los resultados se limitan a 5 canciones

### Gemini Generative Language API

Uso:

- endpoint directo a `generateContent`
- modelo fijado: `gemini-2.5-flash-preview-09-2025`
- autenticacion por query string con `VITE_GEMINI_API_KEY`

Comportamiento:

- si falta `VITE_GEMINI_API_KEY`, la app muestra error y no lanza la peticion
- el prompt del sistema exige respuesta corta en espanol
- la app solicita JSON con schema explicito
- hay reintentos con backoff simple: 2s, 4s, 8s
- si fallan todos los intentos, se genera un fallback local

## Comandos del proyecto

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Estrategia recomendada para secretos

- No usar claves hardcodeadas en `src/App.jsx`.
- Definir `VITE_GEMINI_API_KEY` en `.env` para desarrollo.
- Para produccion, interponer backend o edge function en vez de exponer la clave real al navegador.

## Modo offline

La app escucha eventos `online` y `offline` del navegador.

Efectos actuales:

- muestra banner de desconexion
- bloquea busqueda remota
- bloquea analisis IA

Lo que sigue funcionando sin red:

- reproduccion de audio local
- carga de `.lrc` local
- taller manual de creacion LRC
- navegacion de la UI

## Observaciones de calidad

- Hay fallback defensivo ante errores de IA.
- No hay limpieza explicita de `ObjectURL` al cambiar audio o desmontar componente.
- El manejo de encoding de textos visibles necesita revision.
- Falta configurar pruebas y lint.


## Migracion Gemini

La app usa el SDK oficial @google/genai en JavaScript en lugar del fetch manual al endpoint generateContent. El analisis se procesa en serie con chunks pequenos, backoff exponencial y reintento automatico ante 429/cuota temporal.

