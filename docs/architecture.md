# Architecture

## Resumen

`web-karaoke` es una aplicación cliente de una sola pantalla orientada a aprendizaje de idiomas mediante canciones. El diseño actual centraliza toda la lógica de negocio, estado y render en un único componente React dentro de un runtime Vite.

## Contexto arquitectonico

- Patron dominante: componente monolitico con estado local
- Tipo de render: cliente
- Persistencia: ninguna
- Backend propio: no presente
- Dependencias externas consumidas directamente desde frontend:
  - LRCLIB
  - Gemini Generative Language API

## Dominios funcionales

### 1. Audio y reproducción

Responsabilidades:

- cargar audio local
- crear `ObjectURL`
- reproducir/pausar
- controlar seek
- controlar volumen y mute
- modificar velocidad
- ajustar offset de sincronización

Estado asociado:

- `audioFile`
- `audioUrl`
- `isPlaying`
- `currentTime`
- `duration`
- `volume`
- `isMuted`
- `syncOffset`
- `playbackRate`

Ref principal:

- `audioRef`

### 2. Ingesta de letras

Fuentes soportadas:

- búsqueda remota en LRCLIB
- carga local de archivo `.lrc`
- creacion manual dentro de la app

Estado asociado:

- `searchQuery`
- `isSearching`
- `searchResults`
- `selectedTrack`
- `parsedLyrics`
- `isJapaneseLyrics`
- `lrcInputRef`

Función central:

- `parseLRC()` transforma texto LRC en `{ time, text }[]`

### 3. Analisis IA incremental

El análisis se hace por bloques de tamaño fijo (`CHUNK_SIZE = 8`) para reducir errores de red y permitir continuacion manual.

Estado asociado:

- `analysis`
- `isAnalyzing`
- `linesProcessed`
- `isWaitingToContinue`
- `analysisProgress`
- `analysisError`
- `activeTab`

Pipeline:

1. `processNextChunk()` selecciona el siguiente bloque
2. `fetchChunkWithRetry()` llama a Gemini con reintentos
3. La respuesta se mezcla con el estado existente
4. Se actualiza progreso y se habilita continuar si quedan líneas

Salida del análisis:

- `karaoke_pronunciation`
- `word_breakdown`
- `sentence_analysis`

### 4. Taller manual de LRC

Responsabilidades:

- partir texto plano en líneas
- marcar timestamps usando el audio actual
- limpiar marcas individuales
- generar contenido LRC descargable
- reutilizar el LRC creado dentro del reproductor principal

Estado asociado:

- `creatorRawText`
- `creatorLines`
- `creatorCurrentIndex`

## Flujo de datos

```text
Audio local -> estado de reproduccion -> currentTime
LRC remoto/local/manual -> parseLRC -> parsedLyrics
currentTime - syncOffset -> currentLineIndex
currentLineIndex -> karaoke + diccionario + analisis por frases
parsedLyrics -> chunks -> Gemini -> analysis
creatorLines -> generateLrcString -> descarga o carga al reproductor
```

## Sincronizacion de UI

La línea activa se deriva de:

- `effectiveTime = currentTime - syncOffset`
- búsqueda del rango entre timestamp actual y siguiente línea

Con ese índice se sincronizan tres zonas:

- lista de karaoke
- tarjetas de diccionario
- bloques de análisis por frases

Además, un `useEffect` hace scroll automático del elemento activo en cada panel.

## Dependencias implicitas

Dependencias y runtime actuales:

- React
- `lucide-react`
- Vite
- Tailwind CSS v4 mediante `@tailwindcss/vite`
- alias `@` configurado sobre `src`

## Deuda tecnica actual

- Componente único de gran tamaño
- fuerte acoplamiento entre lógica, red y presentacion
- secretos/configuración mezclados con UI
- textos con encoding inconsistente
- ausencia de tipado y pruebas

## Refactor recomendado

Separar en estas capas:

1. `components/`
2. `hooks/`
3. `services/`
4. `utils/`
5. `config/`

Partición sugerida:

- `useAudioPlayer`
- `useLyricsSearch`
- `useLyricsAnalysis`
- `useLrcCreator`
- `services/lrclib`
- `services/gemini`
- `utils/lrc`

