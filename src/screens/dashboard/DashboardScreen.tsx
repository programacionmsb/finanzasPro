import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useDashboard } from '../../hooks/useDashboard';
import { useAppStore } from '../../store/useAppStore';
import { updateUsuarioOcultarMontos } from '../../services/db';
import { MontoText } from '../../components/ui/MontoText';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Card } from '../../components/ui/Card';
import { AppStackParamList, TabParamList } from '../../types/navigation';
import { Cuenta, Movimiento } from '../../types';
import { formatMonto, fechaAmigable } from '../../utils/formatters';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

// Tipo compuesto de navegación (tab + stack padre)
type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Dashboard'>,
  StackNavigationProp<AppStackParamList>
>;

// ── Íconos por origen de movimiento ─────────────────────────────────────
const ORIGEN_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  yape:       { icon: 'radio-button-on',    color: '#7B3FE4' },
  plin:       { icon: 'radio-button-on',    color: '#00AEEF' },
  bcp:        { icon: 'card-outline',        color: Colors.bcp },
  interbank:  { icon: 'card-outline',        color: Colors.interbank },
  bbva:       { icon: 'card-outline',        color: Colors.bbva },
  foto:       { icon: 'camera-outline',      color: Colors.celeste },
  compartir:  { icon: 'share-social-outline',color: Colors.morado },
  manual:     { icon: 'create-outline',      color: Colors.gris },
};

// ── Sub-componentes ──────────────────────────────────────────────────────

function Avatar({ nombre, fotoUrl }: { nombre: string; fotoUrl: string | null }) {
  if (fotoUrl) {
    return <Image source={{ uri: fotoUrl }} style={styles.avatar} />;
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitial}>{nombre.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function CuentaMiniCard({
  cuenta,
  moneda,
  onPress,
}: {
  cuenta: Cuenta;
  moneda: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cuentaCard, { borderLeftColor: cuenta.color, borderLeftWidth: 3 }]}>
        <Text style={styles.cuentaIcon}>{cuenta.icono}</Text>
        <Text style={styles.cuentaNombre} numberOfLines={1}>{cuenta.nombre}</Text>
        <MontoText
          monto={cuenta.saldo ?? 0}
          moneda={moneda as any}
          size="sm"
          style={styles.cuentaSaldo}
        />
        <Text style={styles.cuentaEstado}>⚠️ Pendiente</Text>
      </View>
    </TouchableOpacity>
  );
}

function MovimientoItem({ mov, moneda }: { mov: Movimiento; moneda: string }) {
  const config = ORIGEN_CONFIG[mov.origen] ?? ORIGEN_CONFIG.manual;
  const esIngreso = mov.tipo === 'ingreso';
  const esTransf  = mov.tipo === 'transferencia';

  return (
    <View style={styles.movRow}>
      {/* Ícono de origen */}
      <View style={[styles.movIconBg, { backgroundColor: config.color + '18' }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>

      {/* Info */}
      <View style={styles.movInfo}>
        <Text style={styles.movDesc} numberOfLines={1}>
          {mov.descripcion ?? mov.origen.charAt(0).toUpperCase() + mov.origen.slice(1)}
        </Text>
        {mov.categoria_nombre ? (
          <Text style={styles.movCategoria} numberOfLines={1}>
            {mov.categoria_nombre}
          </Text>
        ) : (
          <Text style={styles.movFecha}>{fechaAmigable(mov.fecha)}</Text>
        )}
      </View>

      {/* Monto + cuenta */}
      <View style={styles.movRight}>
        <Text
          style={[
            styles.movMonto,
            { color: esTransf ? Colors.celeste : esIngreso ? Colors.verde : Colors.rojo },
          ]}
        >
          {esTransf ? '' : esIngreso ? '+' : '-'}
          {formatMonto(mov.monto, moneda as any)}
        </Text>
        {mov.cuenta_nombre && (
          <Text style={styles.movCuenta} numberOfLines={1}>{mov.cuenta_nombre}</Text>
        )}
      </View>
    </View>
  );
}

// ── Pantalla principal ───────────────────────────────────────────────────
export function DashboardScreen() {
  const navigation   = useNavigation<DashboardNav>();
  const { amountsHidden, toggleAmountsHidden, usuario } = useAppStore();
  const { cuentas, movimientosRecientes, resumen, saldoTotal, loading } = useDashboard();

  const moneda = usuario?.moneda ?? 'PEN';

  async function handleToggleMontos() {
    toggleAmountsHidden();
    if (usuario) {
      await updateUsuarioOcultarMontos(usuario.id, amountsHidden ? 0 : 1);
    }
  }

  function irACuentas() {
    navigation.navigate('Cuentas');
  }

  function irAHistorial() {
    navigation.navigate('Historial');
  }

  return (
    <View style={styles.container}>
      {/* ── Header gradient ── */}
      <LinearGradient colors={['#0F2547', '#2A5BA8']} style={styles.header}>
        {/* Fila superior: avatar + botones */}
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Avatar
              nombre={usuario?.nombre ?? 'U'}
              fotoUrl={usuario?.foto_url ?? null}
            />
            <View>
              <Text style={styles.bienvenido}>Bienvenido de vuelta</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {usuario?.nombre.split(' ')[0] ?? ''}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleToggleMontos}
              style={styles.iconBtn}
              accessibilityLabel={amountsHidden ? 'Mostrar montos' : 'Ocultar montos'}
            >
              <Ionicons
                name={amountsHidden ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={Colors.blanco}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              accessibilityLabel="Notificaciones"
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.blanco} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta de saldo total */}
        <View style={styles.saldoCard}>
          <Text style={styles.saldoLabel}>SALDO TOTAL</Text>

          {loading ? (
            <ActivityIndicator color={Colors.azul} style={{ marginVertical: 8 }} />
          ) : (
            <MontoText
              monto={saldoTotal}
              moneda={moneda}
              size="xl"
              style={styles.saldoMonto}
            />
          )}

          <View style={styles.saldoChips}>
            <View style={styles.chipVerde}>
              <Ionicons name="arrow-up" size={13} color={Colors.verde} />
              <Text style={styles.chipVerdeText}>
                {amountsHidden ? '••••••' : formatMonto(resumen.ingresos, moneda as any)}
              </Text>
            </View>
            <View style={styles.chipRojo}>
              <Ionicons name="arrow-down" size={13} color={Colors.rojo} />
              <Text style={styles.chipRojoText}>
                {amountsHidden ? '••••••' : formatMonto(resumen.egresos, moneda as any)}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Cuerpo scrollable ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mis cuentas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionTitle>Mis cuentas</SectionTitle>
            <TouchableOpacity onPress={irACuentas}>
              <Text style={styles.verTodo}>Ver todas →</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.celeste} />
          ) : cuentas.length === 0 ? (
            <TouchableOpacity style={styles.emptyCard} onPress={irACuentas}>
              <Text style={styles.emptyText}>＋ Agrega tu primera cuenta</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cuentasScroll}
            >
              {cuentas.map((c) => (
                <CuentaMiniCard
                  key={c.id}
                  cuenta={c}
                  moneda={moneda}
                  onPress={irACuentas}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Últimos movimientos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionTitle>Últimos movimientos</SectionTitle>
            <TouchableOpacity onPress={irAHistorial}>
              <Text style={styles.verTodo}>Ver todos →</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.celeste} />
          ) : movimientosRecientes.length === 0 ? (
            <Card style={styles.emptyMovCard}>
              <Text style={styles.emptyMovEmoji}>📭</Text>
              <Text style={styles.emptyMovText}>Sin movimientos aún</Text>
              <Text style={styles.emptyMovSub}>
                Toca ➕ para registrar tu primer movimiento
              </Text>
            </Card>
          ) : (
            <Card padding={0} style={styles.movCard}>
              {movimientosRecientes.map((mov, idx) => (
                <View key={mov.id}>
                  <MovimientoItem mov={mov} moneda={moneda} />
                  {idx < movimientosRecientes.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </Card>
          )}
        </View>

        {/* Espacio inferior para no quedar detrás del tab bar */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fondo,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarInitial: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.blanco,
  },
  bienvenido: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  },
  userName: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.blanco,
    maxWidth: 150,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Tarjeta saldo total
  saldoCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 12,
  },
  saldoLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.2,
  },
  saldoMonto: {
    fontFamily: Fonts.mono,
    fontSize: 36,
    color: Colors.blanco,
    fontWeight: '700',
  },
  saldoChips: {
    flexDirection: 'row',
    gap: 10,
  },
  chipVerde: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.verdeLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  chipVerdeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.verde,
  },
  chipRojo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.rojoLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  chipRojoText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.rojo,
  },

  // Cuerpo
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 24 },

  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verTodo: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.celeste,
  },

  // Cuentas horizontales
  cuentasScroll: { gap: 12, paddingBottom: 4, paddingRight: 4 },
  cuentaCard: {
    backgroundColor: Colors.blanco,
    borderRadius: 14,
    padding: 14,
    width: 140,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cuentaIcon:   { fontSize: 22 },
  cuentaNombre: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.texto,
  },
  cuentaSaldo: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: Colors.texto,
  },
  cuentaEstado: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.amarillo,
  },

  // Vacío cuentas
  emptyCard: {
    backgroundColor: Colors.blanco,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.borde,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.celeste,
  },

  // Movimientos
  movCard: { borderRadius: 16, overflow: 'hidden' },
  movRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  movIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movInfo: { flex: 1, gap: 2 },
  movDesc: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.texto,
  },
  movCategoria: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
  },
  movFecha: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.gris,
  },
  movRight: { alignItems: 'flex-end', gap: 2 },
  movMonto: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '600',
  },
  movCuenta: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.gris,
    maxWidth: 90,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borde,
    marginHorizontal: 14,
  },

  // Vacío movimientos
  emptyMovCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  emptyMovEmoji: { fontSize: 40 },
  emptyMovText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.texto,
  },
  emptyMovSub: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.gris,
    textAlign: 'center',
  },
});
