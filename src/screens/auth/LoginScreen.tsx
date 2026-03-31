import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../types/navigation';
import { signInWithGoogle, buildDemoUser, statusCodes } from '../../services/auth';
import { upsertUsuario } from '../../services/db';
import { sincronizarDesdeFirestore } from '../../services/firestore';
import { useAppStore } from '../../store/useAppStore';
import firestore from '@react-native-firebase/firestore';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type Props = StackScreenProps<AuthStackParamList, 'Login'>;

const FEATURES = [
  { icono: '🏦', titulo: 'Múltiples cuentas',         desc: 'BCP, Interbank, BBVA, efectivo y más' },
  { icono: '🟣', titulo: 'Registro desde Yape / Plin', desc: 'Comparte el texto y lo detectamos automáticamente' },
  { icono: '📊', titulo: 'Reportes y conciliación',    desc: 'Verifica que tu app del banco coincida' },
];

export function LoginScreen({ navigation }: Props) {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingDemo,   setLoadingDemo]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const { setUsuario, setAmountsHidden } = useAppStore();

  async function handleGooglePress() {
    setError(null);
    setLoadingGoogle(true);
    try {
      console.log('[LOGIN] Iniciando Google Sign-In...');
      const pendingUser = await signInWithGoogle();
      console.log('[LOGIN] Google Sign-In OK, uid:', pendingUser.id);

      // Verificar si el usuario ya tiene datos en Firestore
      console.log('[LOGIN] Consultando Firestore...');
      const userDoc = await firestore().collection('users').doc(pendingUser.id).get();
      console.log('[LOGIN] userDoc.exists:', userDoc.exists());

      if (userDoc.exists()) {
        // Usuario existente — restaurar datos desde la nube
        const cloudData = userDoc.data()!;
        console.log('[LOGIN] Usuario existente, sincronizando desde Firestore...');
        await upsertUsuario({
          id:             pendingUser.id,
          nombre:         pendingUser.nombre,
          email:          pendingUser.email,
          foto_url:       pendingUser.foto_url,
          moneda:         cloudData.moneda ?? 'PEN',
          ocultar_montos: cloudData.ocultar_montos ?? 0,
        });
        await sincronizarDesdeFirestore(pendingUser.id);
        console.log('[LOGIN] Sincronización completa');
        setAmountsHidden(cloudData.ocultar_montos === 1);
        setUsuario({
          id:             pendingUser.id,
          nombre:         pendingUser.nombre,
          email:          pendingUser.email,
          foto_url:       pendingUser.foto_url,
          moneda:         cloudData.moneda ?? 'PEN',
          ocultar_montos: cloudData.ocultar_montos ?? 0,
          creado_en:      cloudData.creado_en ?? new Date().toISOString(),
        });
      } else {
        // Usuario nuevo — ir al onboarding
        console.log('[LOGIN] Usuario nuevo, navegando a Onboarding');
        navigation.navigate('Onboarding', { usuario: pendingUser });
      }
    } catch (e: any) {
      console.error('[LOGIN] ERROR:', e?.code, e?.message, JSON.stringify(e));
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[LOGIN] Usuario canceló');
      } else if (e.code === statusCodes.IN_PROGRESS) {
        console.log('[LOGIN] Ya en progreso');
      } else {
        setError('Error al conectar con Google. Intenta de nuevo.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  }

  function handleDemoPress() {
    setError(null);
    setLoadingDemo(true);
    const usuario = buildDemoUser();
    // Pequeño delay visual para el feedback del botón
    setTimeout(() => {
      setLoadingDemo(false);
      navigation.navigate('Onboarding', { usuario });
    }, 400);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
    >
      {/* Header curvo con gradiente */}
      <LinearGradient colors={['#0F2547', '#2A5BA8']} style={styles.header}>
        <Text style={styles.headerLogo}>💰</Text>
        <Text style={styles.headerTitle}>FinanzasPro</Text>
        <Text style={styles.headerSub}>Controla tu dinero con inteligencia</Text>
      </LinearGradient>

      <View style={styles.body}>
        {/* Features */}
        <View style={styles.featuresContainer}>
          {FEATURES.map((f) => (
            <View key={f.titulo} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icono}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitulo}>{f.titulo}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={Colors.rojo} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Botón Google */}
        <TouchableOpacity
          style={[styles.googleBtn, loadingGoogle && styles.btnDisabled]}
          onPress={handleGooglePress}
          disabled={loadingGoogle}
          activeOpacity={0.8}
          accessibilityLabel="Continuar con Google"
        >
          {loadingGoogle ? (
            <ActivityIndicator color={Colors.texto} />
          ) : (
            <>
              <Ionicons name="logo-google" size={22} color="#4285F4" style={styles.googleIcon} />
              <Text style={styles.googleBtnText}>Continuar con Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Separador */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>o</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Botón Demo */}
        <TouchableOpacity
          onPress={handleDemoPress}
          disabled={loadingDemo}
          activeOpacity={0.85}
          accessibilityLabel="Ver demo de la app"
        >
          <LinearGradient
            colors={['#2A5BA8', Colors.azul]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.demoBtn, loadingDemo && styles.btnDisabled]}
          >
            {loadingDemo ? (
              <ActivityIndicator color={Colors.blanco} />
            ) : (
              <Text style={styles.demoBtnText}>Ver demo →</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Pie de página */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Al continuar aceptas nuestros{' '}
            <Text style={styles.footerLink}>Términos de uso</Text>
            {' '}y{' '}
            <Text style={styles.footerLink}>Política de privacidad</Text>
          </Text>
          <Text style={styles.footerNote}>
            🔒 Tus datos financieros nunca salen de tu dispositivo
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.fondo,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerLogo: {
    fontSize: 64,
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.blanco,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },

  // Cuerpo
  body: {
    padding: 24,
    gap: 16,
  },

  // Features
  featuresContainer: {
    gap: 16,
    marginVertical: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitulo: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.texto,
  },
  featureDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.gris,
    marginTop: 2,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.rojoLight,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.rojo,
  },

  // Botón Google
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.blanco,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  googleIcon: {
    marginLeft: -4,
  },
  googleBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.texto,
  },

  // Separador
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borde,
  },
  separatorText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.gris,
  },

  // Botón Demo
  demoBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.blanco,
    letterSpacing: 0.3,
  },

  btnDisabled: {
    opacity: 0.55,
  },

  // Footer
  footer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  footerText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: Colors.celeste,
    fontFamily: Fonts.medium,
  },
  footerNote: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
  },
});
