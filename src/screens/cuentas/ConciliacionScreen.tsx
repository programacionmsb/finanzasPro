import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../types/navigation';
import { useAppStore } from '../../store/useAppStore';
import {
  getCuentaById, calcularSaldo, insertConciliacion, getMovimientos,
} from '../../services/db';
import { MontoText } from '../../components/ui/MontoText';
import { Card } from '../../components/ui/Card';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Cuenta, Movimiento } from '../../types';
import { formatMonto, fechaAmigable } from '../../utils/formatters';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type Props = StackScreenProps<AppStackParamList, 'Conciliacion'>;

type ResultadoVerificacion = 'coincide' | 'diferencia' | null;

// ── Ícono por origen ─────────────────────────────────────────────────────
const ORIGEN_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  yape:      'radio-button-on',
  plin:      'radio-button-on',
  manual:    'create-outline',
  foto:      'camera-outline',
  compartir: 'share-social-outline',
  bcp:       'card-outline',
  interbank: 'card-outline',
  bbva:      'card-outline',
};

const ORIGEN_COLOR: Record<string, string> = {
  yape:      '#7B3FE4',
  plin:      '#00AEEF',
  manual:    Colors.gris,
  foto:      Colors.celeste,
  compartir: Colors.morado,
  bcp:       Colors.bcp,
  interbank: Colors.interbank,
  bbva:      Colors.bbva,
};

// ── Sub-componente ítem movimiento ───────────────────────────────────────
function MovItem({ mov, moneda }: { mov: Movimiento; moneda: string }) {
  const icon  = ORIGEN_ICON[mov.origen]  ?? 'receipt-outline';
  const color = ORIGEN_COLOR[mov.origen] ?? Colors.gris;
  const esIngreso = mov.tipo === 'ingreso';

  return (
    <View style={st.movRow}>
      <View style={[st.movIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={st.movInfo}>
        <Text style={st.movDesc} numberOfLines={1}>
          {mov.descripcion ?? mov.origen}
        </Text>
        <Text style={st.movFecha}>{fechaAmigable(mov.fecha)}</Text>
      </View>
      <Text style={[st.movMonto, { color: esIngreso ? Colors.verde : Colors.rojo }]}>
        {esIngreso ? '+' : '-'}{formatMonto(mov.monto, moneda as any)}
      </Text>
    </View>
  );
}

// ── Pantalla principal ───────────────────────────────────────────────────
export function ConciliacionScreen({ route, navigation }: Props) {
  const { cuentaId } = route.params;
  const { usuario }  = useAppStore();
  const moneda = usuario?.moneda ?? 'PEN';

  const [cuenta,        setCuenta]        = useState<Cuenta | null>(null);
  const [saldoApp,      setSaldoApp]      = useState<number>(0);
  const [movimientos,   setMovimientos]   = useState<Movimiento[]>([]);
  const [loading,       setLoading]       = useState(true);

  // Campo del usuario: saldo real que ve en su banco
  const [saldoRealStr,  setSaldoRealStr]  = useState('');
  // Resultado: null = aún no verificó, 'coincide' | 'diferencia'
  const [resultado,     setResultado]     = useState<ResultadoVerificacion>(null);
  const [diferencia,    setDiferencia]    = useState<number>(0);
  const [guardando,     setGuardando]     = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      const [c, saldo, movs] = await Promise.all([
        getCuentaById(cuentaId),
        calcularSaldo(cuentaId),
        usuario ? getMovimientos(usuario.id, { cuentaId, limite: 10 }) : Promise.resolve([]),
      ]);
      setCuenta(c);
      setSaldoApp(saldo);
      setMovimientos(movs);
    } catch (e) {
      console.error('ConciliacionScreen cargarDatos:', e);
    } finally {
      setLoading(false);
    }
  }, [cuentaId, usuario]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Actualizar título del header con el nombre de la cuenta
  useEffect(() => {
    if (cuenta) navigation.setOptions({ title: cuenta.nombre });
  }, [cuenta, navigation]);

  async function handleVerificar() {
    const saldoReal = parseFloat(saldoRealStr.replace(',', '.'));
    if (isNaN(saldoReal)) {
      Alert.alert('Saldo inválido', 'Ingresa un número válido.');
      return;
    }
    const diff   = saldoReal - saldoApp;
    const estado: 'coincide' | 'diferencia' = Math.abs(diff) < 0.005 ? 'coincide' : 'diferencia';
    setDiferencia(diff);
    setResultado(estado);

    // Guardar en BD
    setGuardando(true);
    try {
      await insertConciliacion({
        cuenta_id:  cuentaId,
        saldo_app:  saldoApp,
        saldo_real: saldoReal,
        diferencia: diff,
        estado,
      });
    } catch (e) {
      console.error('insertConciliacion:', e);
    } finally {
      setGuardando(false);
    }
  }

  function handleReiniciar() {
    setResultado(null);
    setSaldoRealStr('');
    setDiferencia(0);
  }

  if (loading) {
    return (
      <View style={st.centered}>
        <ActivityIndicator size="large" color={Colors.celeste} />
      </View>
    );
  }

  if (!cuenta) {
    return (
      <View style={st.centered}>
        <Text style={st.errorText}>Cuenta no encontrada</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={st.scroll}
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Tarjeta de la cuenta */}
      <Card style={[st.cuentaCard, { borderLeftColor: cuenta.color, borderLeftWidth: 4 }] as any}>
        <View style={st.cuentaRow}>
          <View style={[st.cuentaIconBg, { backgroundColor: cuenta.color + '22' }]}>
            <Text style={st.cuentaIconText}>{cuenta.icono}</Text>
          </View>
          <View style={st.cuentaInfo}>
            <Text style={st.cuentaNombre}>{cuenta.nombre}</Text>
            <Text style={st.cuentaTipo}>
              {cuenta.tipo.charAt(0).toUpperCase() + cuenta.tipo.slice(1)}
            </Text>
          </View>
        </View>
        <View style={st.saldoAppRow}>
          <Text style={st.saldoAppLabel}>SALDO SEGÚN LA APP</Text>
          <MontoText monto={saldoApp} moneda={moneda} size="lg" style={st.saldoAppMonto} />
        </View>
      </Card>

      {/* Campo saldo real */}
      <Card>
        <Text style={st.preguntaLabel}>¿Cuánto ves en tu app del banco?</Text>
        <View style={st.inputRow}>
          <Text style={st.inputPrefix}>{moneda === 'PEN' ? 'S/' : moneda === 'USD' ? '$' : '€'}</Text>
          <TextInput
            style={st.saldoInput}
            placeholder="0.00"
            placeholderTextColor={Colors.gris}
            keyboardType="numeric"
            value={saldoRealStr}
            onChangeText={(v) => { setSaldoRealStr(v); setResultado(null); }}
            editable={resultado === null}
          />
        </View>

        {/* Resultado */}
        {resultado !== null && (
          <View style={[st.resultBox, resultado === 'coincide' ? st.resultOk : st.resultDiff]}>
            {resultado === 'coincide' ? (
              <>
                <Ionicons name="checkmark-circle" size={28} color={Colors.verde} />
                <View style={st.resultText}>
                  <Text style={[st.resultTitle, { color: Colors.verde }]}>¡Coincide perfectamente!</Text>
                  <Text style={st.resultSub}>Tu app del banco coincide con FinanzasPro.</Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="warning" size={28} color={Colors.amarillo} />
                <View style={st.resultText}>
                  <Text style={[st.resultTitle, { color: Colors.amarillo }]}>Hay una diferencia</Text>
                  <Text style={st.resultSub}>
                    Diferencia:{' '}
                    <Text style={{ color: diferencia > 0 ? Colors.verde : Colors.rojo, fontFamily: Fonts.bold }}>
                      {diferencia > 0 ? '+' : ''}{formatMonto(diferencia, moneda as any)}
                    </Text>
                  </Text>
                  <Text style={[st.resultSub, { marginTop: 4 }]}>
                    {diferencia > 0
                      ? 'Tu banco tiene más de lo que registra la app.'
                      : 'Tu banco tiene menos de lo que registra la app.'}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Botones */}
        {resultado === null ? (
          <TouchableOpacity
            style={[st.verificarBtn, guardando && st.btnDisabled]}
            onPress={handleVerificar}
            disabled={guardando || !saldoRealStr}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#2A5BA8', Colors.azul]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.verificarGradient}
            >
              {guardando
                ? <ActivityIndicator color={Colors.blanco} />
                : <Text style={st.verificarBtnText}>VERIFICAR AHORA</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={st.reiniciarBtn} onPress={handleReiniciar}>
            <Text style={st.reiniciarBtnText}>↩ Verificar de nuevo</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Últimos movimientos */}
      {movimientos.length > 0 && (
        <View>
          <SectionTitle style={{ marginBottom: 8 }}>Últimos movimientos</SectionTitle>
          <Card padding={0} style={{ borderRadius: 16, overflow: 'hidden' }}>
            {movimientos.map((mov, idx) => (
              <View key={mov.id}>
                <MovItem mov={mov} moneda={moneda} />
                {idx < movimientos.length - 1 && <View style={st.divider} />}
              </View>
            ))}
          </Card>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.fondo },
  content: { padding: 20, gap: 16 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.gris },

  // Tarjeta cuenta
  cuentaCard: { gap: 16 },
  cuentaRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cuentaIconBg: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaIconText: { fontSize: 26 },
  cuentaInfo:     { flex: 1 },
  cuentaNombre: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.texto,
  },
  cuentaTipo: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.gris,
    marginTop: 2,
  },
  saldoAppRow:   { gap: 4 },
  saldoAppLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.gris,
    letterSpacing: 1.1,
  },
  saldoAppMonto: {
    fontFamily: Fonts.mono,
    fontSize: 28,
    color: Colors.texto,
    fontWeight: '700',
  },

  // Campo saldo real
  preguntaLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.texto,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.fondo,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.celeste,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 8,
  },
  inputPrefix: {
    fontFamily: Fonts.mono,
    fontSize: 20,
    color: Colors.gris,
  },
  saldoInput: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 28,
    color: Colors.texto,
    paddingVertical: 14,
    textAlign: 'right',
  },

  // Resultado
  resultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  resultOk:   { backgroundColor: Colors.verdeLight },
  resultDiff: { backgroundColor: '#FFF8E7' },
  resultText: { flex: 1, gap: 4 },
  resultTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  resultSub: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.texto,
  },

  // Botones verificar / reiniciar
  verificarBtn:      { borderRadius: 12, overflow: 'hidden' },
  verificarGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  verificarBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.blanco,
    letterSpacing: 1,
  },
  btnDisabled: { opacity: 0.5 },
  reiniciarBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borde,
  },
  reiniciarBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.gris,
  },

  // Movimientos
  movRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  movIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movInfo:  { flex: 1, gap: 2 },
  movDesc: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.texto,
  },
  movFecha: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
  },
  movMonto: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borde,
    marginHorizontal: 14,
  },
});
