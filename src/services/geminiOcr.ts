import * as FileSystem from 'expo-file-system/legacy';

const GEMINI_MODEL = 'gemini-2.0-flash-lite';

const PROMPT = `Analiza esta imagen de un comprobante de pago (Yape, Plin, transferencia bancaria u otro recibo).

Extrae todo el texto que aparece en la imagen, línea por línea, exactamente como se muestra.
Preserva el orden de las líneas y no agregues texto que no esté en la imagen.
No interpretes ni reformatees — devuelve el texto crudo tal como aparece.
Cada línea de la imagen debe ser una línea separada en tu respuesta.`;

export async function extractTextWithGemini(uri: string): Promise<string> {
  console.log('[Gemini] Iniciando extracción para:', uri);

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  console.log('[Gemini] API key presente:', !!apiKey, '| longitud:', apiKey?.length ?? 0);
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY no configurada');

  // Si es content:// (share intent de otra app), copiar primero a archivo local
  let localUri = uri;
  if (uri.startsWith('content://')) {
    const tempUri = FileSystem.cacheDirectory + 'gemini_ocr_' + Date.now() + '.jpg';
    console.log('[Gemini] content:// detectado, copiando a:', tempUri);
    try {
      await FileSystem.copyAsync({ from: uri, to: tempUri });
      localUri = tempUri;
      console.log('[Gemini] Copia OK:', localUri);
    } catch (e) {
      console.error('[Gemini] Error copiando archivo:', e);
      throw e;
    }
  }

  // Leer imagen como base64
  console.log('[Gemini] Leyendo imagen como base64 desde:', localUri);
  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64' as any,
    });
    console.log('[Gemini] base64 OK, longitud:', base64.length);
  } catch (e) {
    console.error('[Gemini] Error leyendo imagen:', e);
    throw e;
  }

  // Detectar mimeType
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg';
  console.log('[Gemini] ext:', ext, '| mimeType:', mimeType);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  console.log('[Gemini] Llamando endpoint:', endpoint.replace(apiKey, '***'));

  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
    },
  };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log('[Gemini] HTTP status:', res.status);
  } catch (e) {
    console.error('[Gemini] Error en fetch (red):', e);
    throw e;
  }

  if (!res.ok) {
    const err = await res.text();
    console.error('[Gemini] Respuesta de error:', err);
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  console.log('[Gemini] Respuesta JSON keys:', Object.keys(json));
  console.log('[Gemini] candidates[0]:', JSON.stringify(json?.candidates?.[0])?.substring(0, 200));

  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  console.log('[Gemini] Texto extraído (primeros 200 chars):', text.substring(0, 200));

  return text.trim();
}
