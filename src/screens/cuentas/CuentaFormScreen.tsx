import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { insertCuenta } from '../../services/db';
import { AppStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type Props = StackScreenProps<AppStackParamList, 'CuentaForm'>;

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

export function CuentaFormScreen({ navigation }: Props) {
  const { usuario, refreshCuentas } = useAppStore();

  const [nombre,   setNombre]   = useState('');
  const [tipo,     setTipo]     = useState<'banco' | 'efectivo' | 'otro'>('banco');
  const [icono,    setIcono]    = useState('🏦');
  const [color,    setColor]    = useState<string>(Colors.celeste);
  const [saldoStr, setSaldoStr] = useState('');
  const [saving,   setSaving]   = useState(false);

  async function handleGuardar() {
    if (!nombre.trim()) return Alert.alert('Falta nombre', 'El nombre es obligatorio.');
    if (!usuario) return;
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
      await refreshCuentas();
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la cuenta. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={st.titulo}>Nueva cuenta</Text>

      {/* Nombre */}
      <View>
        <Text style={st.label}>Nombre</Text>
        <TextInput
          style={st.input}
          placeholder="Ej: BCP Ahorro"
          placeholderTextColor={Colors.gris}
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
          autoFocus
          maxLength={40}
        />
      </View>

      {/* Tipo */}
      <View>
        <Text style={st.label}>Tipo</Text>
        <View style={st.tipoRow}>
          {TIPOS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[st.tipoChip, tipo === t.value && st.tipoChipActive]}
              onPress={() => setTipo(t.value)}
              activeOpacity={0.8}
            >
              <Text style={st.tipoChipText}>{t.icono} {t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Ícono */}
      <View>
        <Text style={st.label}>Ícono</Text>
        <View style={st.gridRow}>
          {ICONOS_PRESET.map(e => (
            <TouchableOpacity
              key={e}
              style={[st.emojiBtn, icono === e && { borderColor: Colors.celeste, borderWidth: 2 }]}
              onPress={() => setIcono(e)}
              activeOpacity={0.8}
            >
              <Text style={st.emojiBtnText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Color */}
      <View>
        <Text style={st.label}>Color</Text>
        <View style={st.gridRow}>
          {COLORES_PRESET.map(c => (
            <TouchableOpacity
              key={c}
              style={[st.colorBtn, { backgroundColor: c }, color === c && st.colorBtnSelected]}
              onPress={() => setColor(c)}
              activeOpacity={0.8}
            >
              {color === c && <Ionicons name="checkmark" size={14} color={Colors.blanco} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Saldo inicial */}
      <View>
        <Text style={st.label}>Saldo inicial</Text>
        <TextInput
          style={st.input}
          placeholder="0.00"
          placeholderTextColor={Colors.gris}
          value={saldoStr}
          onChangeText={setSaldoStr}
          keyboardType="numeric"
        />
      </View>

      {/* Guardar */}
      <TouchableOpacity
        style={[st.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleGuardar}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color={Colors.blanco} />
          : <Text style={st.saveBtnText}>GUARDAR CUENTA</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  titulo:  { fontFamily: Fonts.bold, fontSize: 18, color: Colors.texto },
  label:   { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginBottom: 8 },

  input: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: Fonts.regular, fontSize: 16, color: Colors.texto,
  },

  tipoRow:      { flexDirection: 'row', gap: 8 },
  tipoChip: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borde,
    backgroundColor: Colors.blanco,
  },
  tipoChipActive: { borderColor: Colors.celeste, backgroundColor: Colors.celesteLight },
  tipoChipText:   { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto },

  gridRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.fondo, borderWidth: 1.5, borderColor: Colors.borde,
  },
  emojiBtnText: { fontSize: 22 },
  colorBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  colorBtnSelected: {
    borderWidth: 3, borderColor: Colors.blanco,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },

  saveBtn: {
    backgroundColor: Colors.azul, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.8 },
});
