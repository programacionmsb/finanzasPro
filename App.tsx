import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
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
