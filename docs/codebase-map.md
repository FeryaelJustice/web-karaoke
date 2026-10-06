# Codebase Map

## Estructura actual

```text
web-karaoke/
|- docs/
|- src/
|  |- App.jsx
|  |- index.css
|  \- main.jsx
|- .env.example
|- .gitignore
|- AGENTS.md
|- index.html
|- jsconfig.json
|- package.json
|- README.md
\- vite.config.js
```

## `src/App.jsx`

Archivo principal con cuatro responsabilidades mayores:

1. Control del reproductor de audio
2. Busqueda/carga de letras sincronizadas
3. Analisis lingüístico asistido por IA
4. Creacion manual de archivos LRC

## Otros archivos clave

- `src/main.jsx`: monta React y usa imports con alias `@`
- `src/index.css`: importa Tailwind y define estilos base globales
- `vite.config.js`: configura React, Tailwind y alias `@`
- `jsconfig.json`: replica el alias para el editor
- `.env.example`: documenta `VITE_GEMINI_API_KEY`

## Funciones clave dentro de `src/App.jsx`

- `processAudioFile(file)`
- `processLrcFile(file)`
- `searchLyrics()`
- `parseLRC(lrcString)`
- `selectTrack(track)`
- `fetchChunkWithRetry(chunkLines, systemPrompt, retriesLeft)`
- `processNextChunk()`
- `generateLrcString()`
- `downloadLrcFile()`
- `loadCreatorToPlayer()`

## Puntos calientes para futuros cambios

- calculo de `currentLineIndex`
- mezcla incremental de `analysis`
- drag and drop de audio y LRC
- generación de timestamps en el taller manual
- cambio de tab sincronizado con scroll automático
- futura extraccion de hooks y componentes desde `src/App.jsx`
