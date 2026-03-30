/**
 * ocr.ts — Extrae texto de imágenes usando Google Cloud Vision API.
 * Requiere configurar EXPO_PUBLIC_GOOGLE_VISION_API_KEY en .env
 *
 * Para usar on-device (sin API key), se puede reemplazar por
 * @react-native-ml-kit/text-recognition cuando el proyecto tenga build nativo.
 */

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: { text: string };
    error?: { message: string };
  }>;
}

/**
 * Envía una imagen en base64 a Google Vision y retorna el texto detectado.
 * @param base64 Imagen codificada en base64 (sin prefijo "data:image/...;base64,")
 */
export async function extractTextFromImage(base64: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY ?? '';

  if (!apiKey) {
    throw new Error(
      'OCR no configurado. Agrega EXPO_PUBLIC_GOOGLE_VISION_API_KEY en tu archivo .env'
    );
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Error Vision API: ${response.status}`);
  }

  const data: VisionResponse = await response.json();
  const first = data.responses?.[0];

  if (first?.error) {
    throw new Error(`Vision API: ${first.error.message}`);
  }

  return first?.fullTextAnnotation?.text ?? '';
}
