import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, AppState, NativeModules, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';

import { initDB } from './src/services/db';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Colors } from './src/constants/Colors';
import { Fonts } from './src/constants/Fonts';
import { useAppStore } from './src/store/useAppStore';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    initDB()
      .then(() => setDbReady(true))
      .catch((e) => setDbError(String(e)));
  }, []);

  // ── Listener de imágenes compartidas (Android share sheet) ──────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const { ReceiveSharingIntent } = NativeModules;
    if (!ReceiveSharingIntent) return;

    async function checkSharedImage() {
      try {
        const fileObject: Record<string, any> = await ReceiveSharingIntent.getFileNames();
        if (!fileObject) return;
        const files = Object.values(fileObject);
        const img = files.find((f: any) => f.contentUri || f.filePath);
        if (img) {
          const uri: string = img.contentUri || img.filePath;
          useAppStore.getState().setImagenCompartida(uri);
        }
      } catch {/* sin intent activo */}
    }

    checkSharedImage();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTimeout(checkSharedImage, 300);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || !dbReady) {
    return (
      <View style={styles.loading}>
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.loadingText}>
          {dbError ? `Error: ${dbError}` : 'Iniciando…'}
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.azul,
    gap: 12,
  },
  logo: {
    fontSize: 56,
  },
  loadingText: {
    fontFamily: Fonts.regular,
    color: Colors.blanco,
    fontSize: 16,
  },
});
