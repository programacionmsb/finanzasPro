import TextRecognition from '@react-native-ml-kit/text-recognition';

/**
 * Extrae texto de una imagen usando ML Kit (on-device, sin costo ni API key).
 * @param uri URI local de la imagen (file://...)
 */
export async function extractTextFromImage(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  return result.text ?? '';
}
