import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCuentas } from '../../hooks/useCuentas';
import { useAppStore } from '../../store/useAppStore';
import { insertCuenta } from '../../services/db';
import { MontoText } from '../../components/ui/MontoText';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AppStackParamList, TabParamList } from '../../types/navigation';
import { Cuenta } from '../../types';
import { formatMonto } from '../../utils/formatters';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type CuentasNav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Cuentas'>,
  StackNavigationProp<AppStackParamList>
>;

// ── Constantes del formulario ────────────────────────────────────────────
const TIPOS = [
  { value: 'banco',    label: 'Banco',    icono: '🏦' },
  { value: 'efectivo', label: 'Efectivo', icono: '💵' },
  { value: 'otro',     label: 'Otro',     icono: '💳' },
] as const;

const ICONOS_PRESET = ['🏦', '💳', '💵', '💰', '🏧', '💸', '🪙', '💱'];

const COLORES_PRESET = [
  Colors.bcp, Colors.interbank, Colors.bbva, Colors.scotiabank,
  Colors.cajaPiura, Colors.efectivo, Colors.celeste, Colors.morado,
];

// ── Sub-componente tarjeta de cuenta ────────────────────────────────────
function CuentaCard({
  cuenta,
  moneda,
  ingresos,
  egresos,
  numMovimientos,
  verificada,
  onVerificar,
}: {
  cuenta: Cuenta;
  moneda: string;
  ingresos: number;
  egresos: number;
  numMovimientos: number;
  verificada: boolean;
  onVerificar: () => void;
}) {
  return (
    <View style={[styles.cuentaCard, { borderLeftColor: cuenta.color, borderLeftWidth: 4 }]}>
      {/* Cabecera */}
      <View style={styles.cuentaHeader}>
        <View style={[styles.cuentaIconBg, { backgroundColor: cuenta.color + '22' }]}>
          <Text style={styles.cuentaIconText}>{cuenta.icono}</Text>
        </View>
        <View style={styles.cuentaHeaderInfo}>
          <Text style={styles.cuentaNombre}>{cuenta.nombre}</Text>
          <Text style={styles.cuentaTipo}>{cuenta.tipo.charAt(0).toUpperCase() + cuenta.tipo.slice(1)}</Text>
        </View>
        <View style={styles.cuentaHeaderRight}>
          <MontoText monto={cuenta.saldo ?? 0} moneda={moneda as any} size="md" />
          <View style={styles.estadoBadge}>
            <Text style={verificada ? styles.estadoOk : styles.estadoPendiente}>
              {verificada ? '✅ Verificada' : '⚠️ Pendiente'}
            </Text>
          </View>
        </View>
      </View>

      {/* Estadísticas del mes */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Ingresos mes</Text>
          <Text style={[styles.statValue, { color: Colors.verde }]}>
            +{formatMonto(ingresos, moneda as any)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Egresos mes</Text>
          <Text style={[styles.statValue, { color: Colors.rojo }]}>
            -{formatMonto(egresos, moneda as any)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Movimientos</Text>
          <Text style={styles.statValue}>{numMovimientos}</Text>
        </View>
      </View>

      {/* Botón verificar */}
      <TouchableOpacity style={styles.verificarBtn} onPress={onVerificar} activeOpacity={0.75}>
        <Ionicons name="search-outline" size={16} color={Colors.celeste} />
        <Text style={styles.verificarBtnText}>Verificar saldo</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Formulario agregar cuenta (BottomSheet) ──────────────────────────────
function AgregaCuentaSheet({
  visible,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { usuario } = useAppStore();
  const [nombre, setNombre]       = useState('');
  const [tipo, setTipo]           = useState<'banco' | 'efectivo' | 'otro'>('banco');
  const [icono, setIcono]         = useState('🏦');
  const [color, setColor]         = useState<string>(Colors.celeste);
  const [saldoStr, setSaldoStr]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  function reset() {
    setNombre(''); setTipo('banco'); setIcono('🏦');
    setColor(Colors.celeste); setSaldoStr(''); setError(null);
  }

  async function handleGuardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!usuario) return;
    setError(null);
    setSaving(true);
    try {
      const saldo = parseFloat(saldoStr.replace(',', '.')) || 0;
      await insertCuenta({
        usuario_id:    usuario.id,
        nombre:        nombre.trim(),
        tipo,
        icono,
        color,
        saldo_inicial: saldo,
        activa:        1,
        orden:         999,
      });
      reset();
      onGuardado();
      onClose();
    } catch {
      setError('No se pudo guardar la cuenta. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={600}>
      <ScrollView
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sheetTitle}>Nueva cuenta</Text>

        {/* Nombre */}
        <Input
          label="Nombre"
          placeholder="Ej: BCP Ahorro"
          value={nombre}
          onChangeText={setNombre}
          error={error ?? undefined}
          autoCapitalize="words"
        />

        {/* Tipo */}
        <View>
          <Text style={styles.fieldLabel}>Tipo</Text>
          <View style={styles.tipoRow}>
            {TIPOS.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.tipoChip, tipo === t.value && styles.tipoChipActive]}
                onPress={() => setTipo(t.value)}
              >
                <Text style={styles.tipoChipText}>{t.icono} {t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ícono */}
        <View>
          <Text style={styles.fieldLabel}>Ícono</Text>
          <View style={styles.gridRow}>
            {ICONOS_PRESET.map(e => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiBtn, icono === e && { borderColor: Colors.celeste, borderWidth: 2 }]}
                onPress={() => setIcono(e)}
              >
                <Text style={styles.emojiBtnText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color */}
        <View>
          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.gridRow}>
            {COLORES_PRESET.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorBtn, { backgroundColor: c },
                  color === c && styles.colorBtnSelected,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={14} color={Colors.blanco} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Saldo inicial */}
        <Input
          label="Saldo inicial"
          placeholder="0.00"
          value={saldoStr}
          onChangeText={setSaldoStr}
          keyboardType="numeric"
        />

        <Button
          label="Guardar cuenta"
          onPress={handleGuardar}
          loading={saving}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </BottomSheet>
  );
}

// ── Pantalla principal ───────────────────────────────────────────────────
export function CuentasScreen() {
  const navigation = useNavigation<CuentasNav>();
  const { usuario, cuentas, estadisticas, estaVerificada, saldoTotal, loading } = useCuentas();
  const { refreshCuentas } = useAppStore();
  const [sheetVisible, setSheetVisible] = useState(false);

  const moneda = usuario?.moneda ?? 'PEN';
  const cuentasVerificadas = cuentas.filter(c => estaVerificada(c.id)).length;

  function irAConciliacion(cuentaId: number) {
    navigation.navigate('Conciliacion', { cuentaId });
  }

  return (
    <View style={styles.container}>
      {/* Banner superior con gradiente */}
      <LinearGradient colors={['#0F2547', '#2A5BA8']} style={styles.banner}>
        <Text style={styles.bannerLabel}>PATRIMONIO TOTAL</Text>
        <MontoText
          monto={saldoTotal}
          moneda={moneda}
          size="xl"
          style={styles.bannerMonto}
        />
        <View style={styles.bannerRow}>
          <View style={styles.bannerChip}>
            <Ionicons name="business-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.bannerChipText}>{cuentas.length} cuentas activas</Text>
          </View>
          <View style={styles.bannerChip}>
            <Ionicons name="checkmark-circle-outline" size={14} color={Colors.verde} />
            <Text style={[styles.bannerChipText, { color: Colors.verde }]}>
              {cuentasVerificadas} verificadas
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Lista de cuentas */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle style={styles.sectionTitle}>Mis cuentas</SectionTitle>

        {loading ? (
          <ActivityIndicator color={Colors.celeste} style={{ marginTop: 24 }} />
        ) : (
          <>
            {cuentas.map(cuenta => {
              const stats = estadisticas.get(cuenta.id);
              return (
                <CuentaCard
                  key={cuenta.id}
                  cuenta={cuenta}
                  moneda={moneda}
                  ingresos={stats?.ingresos ?? 0}
                  egresos={stats?.egresos ?? 0}
                  numMovimientos={stats?.num_movimientos ?? 0}
                  verificada={estaVerificada(cuenta.id)}
                  onVerificar={() => irAConciliacion(cuenta.id)}
                />
              );
            })}

            {/* Botón agregar cuenta */}
            <TouchableOpacity
              style={styles.agregarBtn}
              onPress={() => setSheetVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={22} color={Colors.celeste} />
              <Text style={styles.agregarBtnText}>Agregar cuenta</Text>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </>
        )}
      </ScrollView>

      {/* BottomSheet para agregar cuenta */}
      <AgregaCuentaSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onGuardado={() => refreshCuentas()}
      />
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },

  // Banner
  banner: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  bannerLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.2,
  },
  bannerMonto: {
    fontFamily: Fonts.mono,
    fontSize: 36,
    color: Colors.blanco,
    fontWeight: '700',
  },
  bannerRow:     { flexDirection: 'row', gap: 12, marginTop: 4 },
  bannerChip:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerChipText:{
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 20, gap: 14 },
  sectionTitle:  { marginBottom: 0 },

  // Tarjeta cuenta
  cuentaCard: {
    backgroundColor: Colors.blanco,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cuentaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  cuentaIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaIconText:  { fontSize: 24 },
  cuentaHeaderInfo:{ flex: 1 },
  cuentaNombre: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.texto,
  },
  cuentaTipo: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
    marginTop: 2,
  },
  cuentaHeaderRight: { alignItems: 'flex-end', gap: 4 },
  estadoBadge:       {},
  estadoOk: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.verde,
  },
  estadoPendiente: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.amarillo,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borde,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.borde },
  statLabel: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.gris,
  },
  statValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.texto,
  },

  // Verificar
  verificarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borde,
    paddingVertical: 12,
    backgroundColor: Colors.celesteLight,
  },
  verificarBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.celeste,
  },

  // Agregar cuenta
  agregarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.celeste,
    borderStyle: 'dashed',
    backgroundColor: Colors.blanco,
    paddingVertical: 16,
  },
  agregarBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.celeste,
  },

  // Sheet form
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  sheetTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.texto,
    textAlign: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.texto,
    marginBottom: 8,
  },
  tipoRow:       { flexDirection: 'row', gap: 8 },
  tipoChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    backgroundColor: Colors.blanco,
  },
  tipoChipActive: { borderColor: Colors.celeste, backgroundColor: Colors.celesteLight },
  tipoChipText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.texto,
  },
  gridRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.fondo,
    borderWidth: 1.5,
    borderColor: Colors.borde,
  },
  emojiBtnText:   { fontSize: 22 },
  colorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorBtnSelected: {
    borderWidth: 3,
    borderColor: Colors.blanco,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
});
