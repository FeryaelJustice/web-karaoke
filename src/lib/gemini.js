import { GoogleGenAI, Type } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Eres un linguista experto. Hablas en ESPANOL.
REGLAS ESTRICTAS:
1. Se muy conciso. Explica gramatica y significado en menos de 15 palabras.
2. Si usa alfabeto no latino, genera guia fonetica en 'karaoke_pronunciation' y 'pronunciation'.
3. Incluye EXACTAMENTE el campo 'line_index' tal cual aparece en el texto original.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    karaoke_pronunciation: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    word_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line_index: { type: Type.INTEGER },
          original: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          significado: { type: Type.STRING },
          analisis_gramatical: { type: Type.STRING },
        },
        required: ['line_index', 'original', 'pronunciation', 'significado', 'analisis_gramatical'],
      },
    },
    sentence_analysis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line_index: { type: Type.INTEGER },
          original: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          traduccion_literal: { type: Type.STRING },
          explicacion_natural: { type: Type.STRING },
          notas_construccion: { type: Type.STRING },
        },
        required: ['line_index', 'original', 'pronunciation', 'traduccion_literal', 'explicacion_natural', 'notas_construccion'],
      },
    },
  },
  required: ['karaoke_pronunciation', 'word_breakdown', 'sentence_analysis'],
};

let client;

function getClient() {
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }

  return client;
}

export function hasGeminiApiKey() {
  return Boolean(apiKey);
}

export function isRateLimitError(error) {
  const message = `${error?.message ?? ''}`.toLowerCase();
  return error?.status === 429 || error?.status === 503 || message.includes('rate limit') || message.includes('quota') || message.includes('resource has been exhausted');
}

export async function analyzeLyricsChunk(chunkLines) {
  const ai = getClient();
  const chunkText = chunkLines.map((line) => `[ID: ${line.originalIndex}] ${line.text}`).join('\n');

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Analiza este bloque:\n\n${chunkText}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  if (!response?.text) {
    throw new Error('EMPTY_GEMINI_RESPONSE');
  }

  return JSON.parse(response.text);
}
