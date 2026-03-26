# Web Karaoke

Aplicacion cliente para estudiar canciones con letras sincronizadas en formato LRC. El proyecto combina reproduccion de audio local, busqueda de letras sincronizadas en LRCLIB, analisis linguistico asistido por Gemini y un taller manual para crear archivos `.lrc`.

## Estado actual

El repositorio ya esta montado como proyecto React con Vite.

- Entrada del cliente: `src/main.jsx`
- Componente principal: `src/App.jsx`
- Alias de imports: `@` -> `src`
- Estilos base: `src/index.css`
- Build tool: Vite
- Plugin CSS: Tailwind CSS v4 mediante `@tailwindcss/vite`
- Iconos: `lucide-react`
- La clave de Gemini se lee desde `VITE_GEMINI_API_KEY`

## Puesta en marcha

1. Instala dependencias con `npm install`.
2. Copia `.env.example` a `.env`.
3. Define `VITE_GEMINI_API_KEY` si quieres usar el analisis IA.
4. Arranca el entorno con `npm run dev`.

Comandos disponibles:

- `npm run dev`
- `npm run build`
- `npm run preview`

## Estructura

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

## Que hace la app

1. Carga un archivo de audio local mediante selector o drag and drop.
2. Busca letras sincronizadas en LRCLIB o carga un archivo `.lrc` local.
3. Reproduce el audio con controles de volumen, velocidad, seek y ajuste de sincronizacion.
4. Muestra el modo karaoke resaltando la linea activa.
5. Analiza la letra por bloques para generar pronunciacion, desglose y analisis por frases.
6. Permite crear un `.lrc` manual marcando timestamps sobre el audio cargado.

## Configuracion

Variables de entorno soportadas:

- `VITE_GEMINI_API_KEY`: habilita el analisis IA. Si no esta definida, la app muestra un error explicito y no intenta llamar a Gemini.

## Limitaciones detectadas

- La logica de negocio sigue concentrada en un unico componente grande.
- Hay texto con problemas de codificacion heredados del archivo original.
- El analisis IA sigue llamando directamente a Gemini desde frontend; sirve para desarrollo, no como arquitectura final de produccion.
- No hay pruebas ni lint configurados aun.

## Documentacion adicional

- [docs/architecture.md](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/docs/architecture.md)
- [docs/runtime-and-integrations.md](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/docs/runtime-and-integrations.md)
- [docs/codebase-map.md](/C:/Users/nano9/OneDrive/Escritorio/Stuff/Professional/Business/FeryaelJustice/Developer/Stuff/AI/web-karaoke/docs/codebase-map.md)
"# web-karaoke" 
