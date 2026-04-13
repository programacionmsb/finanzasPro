import TextRecognition from '@react-native-ml-kit/text-recognition';

export async function extractTextFromImage(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  return result.text ?? '';
}
