import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../types/navigation';
import { getSessionUser } from '../../services/auth';
import { useAppStore } from '../../store/useAppStore';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';
import { useIsFocused } from '@react-navigation/native';

type Props = StackScreenProps<AuthStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { setUsuario, setAmountsHidden, loggedOut, setLoggedOut } = useAppStore();

  // Animaciones
  const logoScale   = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Animar logo con spring
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 120,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Fade-in del texto con pequeño delay
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 500,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // 3. Tras 1.8s, verificar sesión y redirigir
    const timer = setTimeout(async () => {
      // Si el usuario cerró sesión explícitamente, ir directo al Login
      if (loggedOut) {
        setLoggedOut(false);
        navigation.replace('Login');
        return;
      }
      try {
        const usuario = await getSessionUser();
        if (usuario) {
          setAmountsHidden(usuario.ocultar_montos === 1);
          setUsuario(usuario);
        } else {
          navigation.replace('Login');
        }
      } catch {
        navigation.replace('Login');
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={['#0F2547', '#2A5BA8']} style={styles.container}>
      <Animated.Text
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        💰
      </Animated.Text>

      <Animated.View style={{ opacity: textOpacity, alignItems: 'center', gap: 8 }}>
        <Text style={styles.appName}>FinanzasPro</Text>
        <Text style={styles.tagline}>Tu dinero, bajo control</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  logo: {
    fontSize: 80,
  },
  appName: {
    fontFamily: Fonts.bold,
    fontSize: 36,
    color: Colors.blanco,
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
  },
});
