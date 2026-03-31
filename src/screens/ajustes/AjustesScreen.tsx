import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ScrollView, StyleSheet, Switch, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppStore } from '../../store/useAppStore';
import { updateUsuarioMoneda, updateUsuarioOcultarMontos, getDb } from '../../services/db';
import { eliminarTodosLosDatosCloud } from '../../services/firestore';
import { AppStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

type Nav = StackNavigationProp<AppStackParamList>;

// ── Fila de ajuste ─────────────────────────────────────────────────────────

function SettingRow({
  icon,
  label,
  value,
  onPress,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={st.row}
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={st.rowLeft}>
        <Ionicons name={icon} size={20} color={Colors.celeste} style={st.rowIcon} />
        <Text style={st.rowLabel}>{label}</Text>
      </View>
      <View style={st.rowRight}>
        {right ?? (
          <>
            {value ? <Text style={st.rowValue}>{value}</Text> : null}
            {onPress ? (
              <Ionicons name="chevron-forward" size={16} color={Colors.gris} />
            ) : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Modal de selección de moneda ──────────────────────────────────────────

function MonedaModal({
  visible,
  monedaActual,
  onSelect,
  onClose,
}: {
  visible: boolean;
  monedaActual: string;
  onSelect: (m: 'PEN' | 'USD' | 'EUR') => void;
  onClose: () => void;
}) {
  const opciones: { key: 'PEN' | 'USD' | 'EUR'; label: string; simbolo: string }[] = [
    { key: 'PEN', label: 'Soles peruanos', simbolo: 'S/' },
    { key: 'USD', label: 'Dólares',        simbolo: '$'  },
    { key: 'EUR', label: 'Euros',          simbolo: '€'  },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={st.modalSheet}>
        <Text style={st.modalTitle}>Moneda predeterminada</Text>
        {opciones.map(op => (
          <TouchableOpacity
            key={op.key}
            style={[st.monedaOpt, monedaActual === op.key && st.monedaOptActive]}
            onPress={() => { onSelect(op.key); onClose(); }}
            activeOpacity={0.75}
          >
            <Text style={st.monedaSimbolo}>{op.simbolo}</Text>
            <Text style={st.monedaLabel}>{op.label} ({op.key})</Text>
            {monedaActual === op.key && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.celeste} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────

export function AjustesScreen() {
  const nav = useNavigation<Nav>();
  const { usuario, setUsuario, amountsHidden, toggleAmountsHidden, setLoggedOut } = useAppStore();

  const [showMoneda, setShowMoneda] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [moneda, setMonedaLocal] = useState<'PEN' | 'USD' | 'EUR'>(
    (usuario?.moneda as 'PEN' | 'USD' | 'EUR') ?? 'PEN'
  );

  async function handleMonedaChange(m: 'PEN' | 'USD' | 'EUR') {
    setMonedaLocal(m);
    if (usuario) {
      await updateUsuarioMoneda(usuario.id, m);
      setUsuario({ ...usuario, moneda: m });
    }
  }

  async function handleToggleOcultarMontos(val: boolean) {
    toggleAmountsHidden();
    if (usuario) {
      await updateUsuarioOcultarMontos(usuario.id, val ? 1 : 0);
    }
  }

  function handleCerrarSesion() {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir? Tus datos locales se mantendrán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try { await auth().signOut(); } catch {}
            try { await GoogleSignin.signOut(); } catch {}
            try {
              const db = await getDb();
              await db.runAsync('DELETE FROM usuarios');
            } catch {}
            setLoggedOut(true);
            setUsuario(null);
          },
        },
      ]
    );
  }

  function handleRestablecer() {
    Alert.alert(
      'Restablecer app',
      '¿Estás seguro? Se eliminarán TODOS tus datos locales y de la nube. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: async () => {
            if (!usuario) return;
            setResetting(true);
            try {
              const db = await getDb();
              await db.runAsync('DELETE FROM movimientos WHERE usuario_id = ?', [usuario.id]);
              await db.runAsync('DELETE FROM cuentas WHERE usuario_id = ?', [usuario.id]);
              await db.runAsync('DELETE FROM categorias WHERE usuario_id = ?', [usuario.id]);
              await db.runAsync('DELETE FROM usuarios WHERE id = ?', [usuario.id]);
              await eliminarTodosLosDatosCloud(usuario.id).catch(() => {});
              await auth().signOut().catch(() => {});
              await GoogleSignin.signOut().catch(() => {});
              setUsuario(null);
            } catch (e) {
              Alert.alert('Error', 'No se pudo restablecer completamente. Intenta de nuevo.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }

  const APP_VERSION = '1.0.0';

  if (!usuario) return null;

  return (
    <ScrollView
      style={st.safe}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Perfil ──────────────────────────────── */}
      <View style={st.profileCard}>
        {usuario.foto_url ? (
          <Image source={{ uri: usuario.foto_url }} style={st.avatar} />
        ) : (
          <View style={st.avatarFallback}>
            <Text style={st.avatarInitial}>{usuario.nombre.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={st.profileInfo}>
          <Text style={st.profileName}>{usuario.nombre}</Text>
          <Text style={st.profileEmail}>{usuario.email}</Text>
          <View style={st.modeBadge}>
            <Text style={st.modeBadgeText}>
              {usuario.id.startsWith('demo') ? '🎭 Modo Demo' : '🔐 Google'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Preferencias ─────────────────────────── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>PREFERENCIAS</Text>
        <View style={st.card}>
          <SettingRow
            icon="cash-outline"
            label="Moneda"
            value={moneda}
            onPress={() => setShowMoneda(true)}
          />
          <View style={st.divider} />
          <SettingRow
            icon="eye-off-outline"
            label="Ocultar montos por defecto"
            right={
              <Switch
                value={amountsHidden}
                onValueChange={handleToggleOcultarMontos}
                trackColor={{ false: Colors.borde, true: Colors.celeste }}
                thumbColor={Colors.blanco}
              />
            }
          />
        </View>
      </View>

      {/* ── Gestión ──────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>GESTIÓN</Text>
        <View style={st.card}>
          <SettingRow
            icon="wallet-outline"
            label="Cuentas"
            onPress={() => nav.navigate('TabNavigator', { screen: 'Cuentas' })}
          />
          <View style={st.divider} />
          <SettingRow
            icon="pricetag-outline"
            label="Categorías"
            onPress={() => nav.navigate('TabNavigator', { screen: 'Categorias' })}
          />
        </View>
      </View>

      {/* ── Acerca de ────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>ACERCA DE</Text>
        <View style={st.card}>
          <SettingRow icon="information-circle-outline" label="Versión" value={APP_VERSION} />
          <View style={st.divider} />
          <SettingRow icon="shield-checkmark-outline" label="Privacidad" />
          <View style={st.divider} />
          <SettingRow icon="document-text-outline" label="Términos y condiciones" />
        </View>
      </View>

      {/* ── Cerrar sesión ────────────────────────── */}
      <TouchableOpacity style={st.logoutBtn} onPress={handleCerrarSesion} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color={Colors.rojo} />
        <Text style={st.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      {/* ── Restablecer ──────────────────────────── */}
      <TouchableOpacity
        style={st.resetBtn}
        onPress={handleRestablecer}
        activeOpacity={0.85}
        disabled={resetting}
      >
        {resetting ? (
          <ActivityIndicator color={Colors.gris} size="small" />
        ) : (
          <>
            <Ionicons name="trash-outline" size={20} color={Colors.gris} />
            <Text style={st.resetText}>Restablecer app</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      {/* ── Modal moneda ────────────────────────── */}
      <MonedaModal
        visible={showMoneda}
        monedaActual={moneda}
        onSelect={handleMonedaChange}
        onClose={() => setShowMoneda(false)}
      />
    </ScrollView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.fondo },
  content: { padding: 20, gap: 20 },

  // Perfil
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.blanco, borderRadius: 16, padding: 16,
  },
  avatar:        { width: 60, height: 60, borderRadius: 30 },
  avatarFallback:{
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.azul, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.blanco },
  profileInfo:   { flex: 1, gap: 2 },
  profileName:   { fontFamily: Fonts.bold, fontSize: 17, color: Colors.texto },
  profileEmail:  { fontFamily: Fonts.regular, fontSize: 13, color: Colors.gris },
  modeBadge:     { marginTop: 4, alignSelf: 'flex-start', backgroundColor: Colors.celesteLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modeBadgeText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.celeste },

  // Secciones
  section:      { gap: 8 },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.gris, letterSpacing: 0.8 },
  card:         { backgroundColor: Colors.blanco, borderRadius: 14, overflow: 'hidden' },
  divider:      { height: 1, backgroundColor: Colors.borde, marginLeft: 52 },

  // Fila
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowIcon:   { marginRight: 14 },
  rowLabel:  { fontFamily: Fonts.medium, fontSize: 15, color: Colors.texto },
  rowRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue:  { fontFamily: Fonts.regular, fontSize: 14, color: Colors.gris },

  // Cerrar sesión
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.rojo,
    backgroundColor: Colors.rojoLight,
  },
  logoutText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.rojo },

  // Restablecer
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.borde,
    backgroundColor: Colors.blanco,
  },
  resetText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.gris },

  // Modal moneda
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.blanco, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  modalTitle:  { fontFamily: Fonts.bold, fontSize: 17, color: Colors.texto, marginBottom: 4 },
  monedaOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  monedaOptActive: { backgroundColor: Colors.celesteLight, borderRadius: 10, paddingHorizontal: 10 },
  monedaSimbolo:   { fontFamily: Fonts.bold, fontSize: 18, color: Colors.celeste, width: 28 },
  monedaLabel:     { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: Colors.texto },
});
