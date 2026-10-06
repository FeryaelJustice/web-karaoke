# AGENTS

## Proposito del proyecto

Este repositorio contiene una SPA React con Vite para karaoke educativo con letras sincronizadas, análisis lingüístico y creacion manual de archivos LRC. La implementacion principal vive en [src/App.jsx](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/src/App.jsx).

## Regla base para agentes

Inspeccionar el estado real del repo antes de proponer cambios. El runtime actual es Vite + React y el alias `@` apunta a `src`.

## Mapa rápido

- Entrada de la app: [src/main.jsx](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/src/main.jsx)
- Componente principal: [src/App.jsx](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/src/App.jsx)
- Configuración Vite: [vite.config.js](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/vite.config.js)
- Alias editor: [jsconfig.json](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/jsconfig.json)
- Estilos base: [src/index.css](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/src/index.css)
- Documentacion tecnica: [docs/architecture.md](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/docs/architecture.md)

## Guardrails de edicion

- Preservar el comportamiento de karaoke sincronizado al tocar `currentTime`, `syncOffset`, `effectiveTime` o `currentLineIndex`.
- Mantener el alias `@` para imports internos nuevos.
- No introducir claves API hardcodeadas. Usar `import.meta.env` para configuración cliente.
- Si se refactoriza `src/App.jsx`, separar por dominios: reproducción, letras/LRC, análisis IA y creador manual.
- Mantener compatibilidad con archivos `.lrc` locales y con resultados de LRCLIB.
- Si se toca la lógica de análisis por bloques, respetar paginación manual, reintentos y fusion incremental de estado.

## Riesgos conocidos

- El componente principal sigue siendo grande y monolitico.
- Existen cadenas con mojibake; revisar encoding antes de editar textos visibles.
- El análisis IA esta acoplado a una URL de modelo concreta.
- No hay test suite para validar regresiones.

## Checklist para cambios relevantes

1. Confirmar si el cambio afecta a audio, LRC, IA o taller manual.
2. Revisar si hay sincronización UI dependiente de scroll automático.
3. Verificar impacto en el build Vite y en el alias `@`.
4. Documentar cualquier nueva dependencia o flujo en `README.md` y `docs/`.
