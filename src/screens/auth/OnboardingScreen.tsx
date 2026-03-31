import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList, MonedaCode } from '../../types';
import { upsertUsuario, insertCuenta, insertCategoriasDefault } from '../../services/db';
import { subirTodoAFirestore } from '../../services/firestore';
import firestore from '@react-native-firebase/firestore';
import { useAppStore } from '../../store/useAppStore';
import { CUENTAS_TEMPLATE } from '../../constants/Categories';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type Props = StackScreenProps<AuthStackParamList, 'Onboarding'>;

// ── Opciones de moneda ──────────────────────────────────────────────────
const MONEDAS: { codigo: MonedaCode; nombre: string; simbolo: string; bandera: string }[] = [
  { codigo: 'PEN', nombre: 'Sol Peruano', simbolo: 'S/',  bandera: '🇵🇪' },
  { codigo: 'USD', nombre: 'Dólar',       simbolo: '$',   bandera: '🇺🇸' },
  { codigo: 'EUR', nombre: 'Euro',        simbolo: '€',   bandera: '🇪🇺' },
];

// ── Componente barra de progreso ────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  return (
    <View style={pb.container}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[pb.pill, n <= step ? pb.pillActive : pb.pillInactive]}
        />
      ))}
    </View>
  );
}

const pb = StyleSheet.create({
  container:    { flexDirection: 'row', gap: 8, marginBottom: 28 },
  pill:         { flex: 1, height: 6, borderRadius: 3 },
  pillActive:   { backgroundColor: Colors.celeste },
  pillInactive: { backgroundColor: Colors.borde },
});

// ── Pantalla principal ──────────────────────────────────────────────────
export function OnboardingScreen({ route }: Props) {
  const { usuario } = route.params;
  const { setUsuario } = useAppStore();
  const { bottom } = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Paso 1 — Moneda
  const [moneda, setMoneda] = useState<MonedaCode>('PEN');

  // Paso 2 — Cuentas
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set(['Efectivo']));
  const [customNombre, setCustomNombre] = useState('');
  const [cuentasCustom, setCuentasCustom] = useState<string[]>([]);

  // Paso 3 — Saldos
  const [saldos, setSaldos] = useState<Record<string, string>>({});

  // Lista unificada de cuentas para paso 3
  const todasLasCuentas = [
    ...CUENTAS_TEMPLATE.filter(t => seleccionadas.has(t.nombre)),
    ...cuentasCustom.map(n => ({
      nombre: n, tipo: 'otro' as const, icono: '🏦', color: Colors.celeste,
    })),
  ];

  // ── Handlers ────────────────────────────────────────────────────────
  function toggleCuenta(nombre: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      next.has(nombre) ? next.delete(nombre) : next.add(nombre);
      return next;
    });
  }

  function agregarCustom() {
    const nombre = customNombre.trim();
    if (!nombre) return;
    if (cuentasCustom.includes(nombre) || CUENTAS_TEMPLATE.some(t => t.nombre === nombre)) {
      Alert.alert('Cuenta duplicada', 'Ya existe una cuenta con ese nombre.');
      return;
    }
    setCuentasCustom(prev => [...prev, nombre]);
    setCustomNombre('');
    setSeleccionadas(prev => new Set([...prev, nombre]));
  }

  function irAtras() {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  function irAdelante() {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (seleccionadas.size === 0) {
        Alert.alert('Sin cuentas', 'Selecciona al menos una cuenta para continuar.');
        return;
      }
      setStep(3);
    }
  }

  async function handleFinalizar() {
    setSaving(true);
    try {
      // 1. Guardar usuario en SQLite
      await upsertUsuario({
        id:             usuario.id,
        nombre:         usuario.nombre,
        email:          usuario.email,
        foto_url:       usuario.foto_url,
        moneda,
        ocultar_montos: 0,
      });

      // 2. Insertar cuentas seleccionadas con saldos iniciales
      for (let i = 0; i < todasLasCuentas.length; i++) {
        const c = todasLasCuentas[i];
        const saldo = parseFloat(saldos[c.nombre]?.replace(',', '.') ?? '0') || 0;
        await insertCuenta({
          usuario_id:    usuario.id,
          nombre:        c.nombre,
          tipo:          c.tipo,
          icono:         c.icono,
          color:         c.color,
          saldo_inicial: saldo,
          activa:        1,
          orden:         i,
        });
      }

      // 3. Insertar categorías por defecto
      await insertCategoriasDefault(usuario.id);

      // 4. Guardar perfil de usuario en Firestore
      await firestore().collection('users').doc(usuario.id).set({
        nombre:         usuario.nombre,
        email:          usuario.email,
        foto_url:       usuario.foto_url ?? null,
        moneda,
        ocultar_montos: 0,
        creado_en:      new Date().toISOString(),
      });

      // 5. Subir cuentas y categorías a Firestore
      await subirTodoAFirestore(usuario.id);

      // 6. Setear usuario en store → RootNavigator auto-cambia a App
      setUsuario({
        id:             usuario.id,
        nombre:         usuario.nombre,
        email:          usuario.email,
        foto_url:       usuario.foto_url,
        moneda,
        ocultar_montos: 0,
        creado_en:      new Date().toISOString(),
      });
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar tu configuración. Intenta de nuevo.');
      setSaving(false);
    }
  }

  // ── Render por paso ──────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#0F2547', '#2A5BA8']} style={styles.header}>
        <Text style={styles.headerTitle}>
          {step === 1 ? '¡Bienvenido! 👋' : step === 2 ? 'Tus cuentas 🏦' : 'Saldos iniciales 💰'}
        </Text>
        <Text style={styles.headerSub}>
          {step === 1
            ? `Hola, ${usuario.nombre.split(' ')[0]}. Elige tu moneda principal`
            : step === 2
            ? 'Selecciona las cuentas que usas'
            : 'Ingresa el saldo actual de cada cuenta'}
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ProgressBar step={step} />

        {/* ── PASO 1 — Moneda ── */}
        {step === 1 && (
          <View style={styles.section}>
            {MONEDAS.map((m) => (
              <TouchableOpacity
                key={m.codigo}
                style={[styles.monedaCard, moneda === m.codigo && styles.monedaCardActive]}
                onPress={() => setMoneda(m.codigo)}
                activeOpacity={0.75}
              >
                <Text style={styles.monedaBandera}>{m.bandera}</Text>
                <View style={styles.monedaInfo}>
                  <Text style={styles.monedaNombre}>{m.nombre}</Text>
                  <Text style={styles.monedaCodigo}>{m.codigo}</Text>
                </View>
                <Text style={styles.monedaSimbolo}>{m.simbolo}</Text>
                {moneda === m.codigo && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.celeste} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── PASO 2 — Cuentas ── */}
        {step === 2 && (
          <View style={styles.section}>
            <View style={styles.cuentasGrid}>
              {[...CUENTAS_TEMPLATE, ...cuentasCustom.map(n => ({
                nombre: n, tipo: 'otro' as const, icono: '🏦', color: Colors.celeste,
              }))].map((c) => {
                const activa = seleccionadas.has(c.nombre);
                return (
                  <TouchableOpacity
                    key={c.nombre}
                    style={[
                      styles.cuentaCard,
                      activa && { borderColor: c.color, borderWidth: 2 },
                    ]}
                    onPress={() => toggleCuenta(c.nombre)}
                    activeOpacity={0.75}
                  >
                    {activa && (
                      <View style={[styles.cuentaCheck, { backgroundColor: c.color }]}>
                        <Ionicons name="checkmark" size={12} color={Colors.blanco} />
                      </View>
                    )}
                    <View style={[styles.cuentaIconBg, { backgroundColor: c.color + '22' }]}>
                      <Text style={styles.cuentaIconText}>{c.icono}</Text>
                    </View>
                    <Text style={styles.cuentaNombre} numberOfLines={1}>{c.nombre}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Campo para agregar cuenta personalizada */}
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Otra cuenta..."
                placeholderTextColor={Colors.gris}
                value={customNombre}
                onChangeText={setCustomNombre}
                onSubmitEditing={agregarCustom}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.customAddBtn}
                onPress={agregarCustom}
                accessibilityLabel="Agregar cuenta personalizada"
              >
                <Ionicons name="add" size={22} color={Colors.blanco} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── PASO 3 — Saldos ── */}
        {step === 3 && (
          <View style={styles.section}>
            <View style={styles.tipBox}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.celeste} />
              <Text style={styles.tipText}>
                Puedes ingresar 0 si no sabes el saldo exacto ahora.
              </Text>
            </View>

            {todasLasCuentas.map((c) => (
              <View key={c.nombre} style={styles.saldoRow}>
                <View style={[styles.saldoIconBg, { backgroundColor: c.color + '22' }]}>
                  <Text style={styles.saldoIcon}>{c.icono}</Text>
                </View>
                <Text style={styles.saldoNombre}>{c.nombre}</Text>
                <TextInput
                  style={styles.saldoInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.gris}
                  keyboardType="numeric"
                  value={saldos[c.nombre] ?? ''}
                  onChangeText={(v) =>
                    setSaldos(prev => ({ ...prev, [c.nombre]: v }))
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Botones de navegación */}
      <View style={[styles.navButtons, { paddingBottom: (Platform.OS === 'ios' ? 36 : 20) + bottom }]}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={irAtras}>
            <Text style={styles.backBtnText}>← Atrás</Text>
          </TouchableOpacity>
        )}

        {step < 3 ? (
          <TouchableOpacity
            style={[styles.nextBtnWrapper, step === 1 && styles.nextBtnFull]}
            onPress={irAdelante}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#2A5BA8', Colors.azul]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtn}
            >
              <Text style={styles.nextBtnText}>Continuar →</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextBtnWrapper}
            onPress={handleFinalizar}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#1a9e67', Colors.verde]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.nextBtn, saving && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator color={Colors.blanco} />
              ) : (
                <Text style={styles.nextBtnText}>¡Empezar! 🚀</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fondo,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 6,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    color: Colors.blanco,
  },
  headerSub: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 8 },

  section: { gap: 12 },

  // ── Paso 1: Moneda ────────────────────────────
  monedaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.blanco,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    gap: 14,
  },
  monedaCardActive: {
    borderColor: Colors.celeste,
    backgroundColor: Colors.celesteLight,
  },
  monedaBandera: { fontSize: 28 },
  monedaInfo:    { flex: 1 },
  monedaNombre: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.texto,
  },
  monedaCodigo: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
  },
  monedaSimbolo: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    color: Colors.azul,
    minWidth: 28,
    textAlign: 'right',
  },

  // ── Paso 2: Cuentas ──────────────────────────
  cuentasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cuentaCard: {
    width: '30.5%',
    backgroundColor: Colors.blanco,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    position: 'relative',
  },
  cuentaCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaIconText: { fontSize: 22 },
  cuentaNombre: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.texto,
    textAlign: 'center',
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.blanco,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.texto,
  },
  customAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.celeste,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Paso 3: Saldos ───────────────────────────
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.celesteLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  tipText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.celeste,
    lineHeight: 18,
  },
  saldoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.blanco,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borde,
  },
  saldoIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saldoIcon:   { fontSize: 20 },
  saldoNombre: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.texto,
  },
  saldoInput: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.texto,
    textAlign: 'right',
    minWidth: 90,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.celeste,
    paddingBottom: 2,
    paddingHorizontal: 4,
  },

  // ── Botones de navegación ─────────────────────
  navButtons: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    paddingBottom: 20,
    backgroundColor: Colors.fondo,
    borderTopWidth: 1,
    borderTopColor: Colors.borde,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    backgroundColor: Colors.blanco,
  },
  backBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.gris,
  },
  nextBtnWrapper: { flex: 2 },
  nextBtnFull:    { flex: 1 },
  nextBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.blanco,
    letterSpacing: 0.3,
  },
});
