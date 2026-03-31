import { useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { CuentaSelector } from '../../components/forms/CuentaSelector';
import { CategoriaSelector } from '../../components/forms/CategoriaSelector';
import { useRegistroForm } from '../../hooks/useRegistroForm';
import { formatFecha } from '../../utils/formatters';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

interface ManualPanelProps {
  onSaved: () => void;
}

export function ManualPanel({ onSaved }: ManualPanelProps) {
  const {
    form, setField, setTipo, setCategoria,
    saving, handleSave, categoriasFiltradas, categoriaReset,
    cuentas,
  } = useRegistroForm(onSaved);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const montoRef = useRef<TextInput>(null);

  return (
    <ScrollView
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Monto ──────────────────────────────── */}
      <View style={st.montoContainer}>
        <Text style={st.montoPrefix}>S/</Text>
        <TextInput
          ref={montoRef}
          style={st.montoInput}
          placeholder="0.00"
          placeholderTextColor={Colors.borde}
          keyboardType="numeric"
          value={form.monto}
          onChangeText={v => setField('monto', v)}
          autoFocus
        />
      </View>

      {/* ── Tipo ───────────────────────────────── */}
      <View style={st.tipoRow}>
        <TouchableOpacity
          style={[st.tipoBtn, form.tipo === 'ingreso' && st.tipoBtnIngreso]}
          onPress={() => setTipo('ingreso')}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up-circle" size={20}
            color={form.tipo === 'ingreso' ? Colors.blanco : Colors.verde} />
          <Text style={[st.tipoBtnText, form.tipo === 'ingreso' && { color: Colors.blanco }]}>
            Ingreso
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.tipoBtn, form.tipo === 'egreso' && st.tipoBtnEgreso]}
          onPress={() => setTipo('egreso')}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-down-circle" size={20}
            color={form.tipo === 'egreso' ? Colors.blanco : Colors.rojo} />
          <Text style={[st.tipoBtnText, form.tipo === 'egreso' && { color: Colors.blanco }]}>
            Egreso
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.tipoBtn, form.tipo === 'transferencia' && st.tipoBtnTransfer]}
          onPress={() => setTipo('transferencia')}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-horizontal" size={20}
            color={form.tipo === 'transferencia' ? Colors.blanco : Colors.morado} />
          <Text style={[st.tipoBtnText, form.tipo === 'transferencia' && { color: Colors.blanco }]}>
            Transferir
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Cuenta origen ──────────────────────── */}
      <CuentaSelector
        cuentas={cuentas}
        value={form.cuentaId}
        onChange={id => setField('cuentaId', id)}
        label={form.tipo === 'transferencia' ? 'Cuenta origen' : 'Cuenta'}
      />

      {/* ── Cuenta destino (solo transferencia) ── */}
      {form.tipo === 'transferencia' && (
        <CuentaSelector
          cuentas={cuentas.filter(c => c.id !== form.cuentaId)}
          value={form.cuentaDestinoId}
          onChange={id => setField('cuentaDestinoId', id)}
          label="Cuenta destino"
        />
      )}

      {/* ── Categoría (solo ingreso/egreso) ────── */}
      {form.tipo !== 'transferencia' && (
        <CategoriaSelector
          categorias={categoriasFiltradas}
          tipo={form.tipo}
          value={form.categoriaId}
          onChange={setCategoria}
          advertencia={categoriaReset}
          label="Categoría"
        />
      )}

      {/* ── Fecha y hora ────────────────────────── */}
      <View>
        <Text style={st.fieldLabel}>Fecha y hora</Text>
        <View style={st.fechaRow}>
          <TouchableOpacity
            style={[st.fechaBtn, { flex: 2 }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.celeste} />
            <Text style={st.fechaText}>{formatFecha(form.fecha.toISOString())}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[st.fechaBtn, { flex: 1 }]}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="time-outline" size={18} color={Colors.celeste} />
            <Text style={st.fechaText}>
              {String(form.fecha.getHours()).padStart(2, '0')}:{String(form.fecha.getMinutes()).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={form.fecha}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) {
                const nueva = new Date(date);
                nueva.setHours(form.fecha.getHours(), form.fecha.getMinutes(), 0);
                setField('fecha', nueva);
              }
            }}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={form.fecha}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            is24Hour
            onChange={(_, date) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (date) {
                const nueva = new Date(form.fecha);
                nueva.setHours(date.getHours(), date.getMinutes(), 0);
                setField('fecha', nueva);
              }
            }}
          />
        )}
      </View>

      {/* ── Nota ───────────────────────────────── */}
      <View>
        <Text style={st.fieldLabel}>Nota (opcional)</Text>
        <TextInput
          style={st.notaInput}
          placeholder="Agrega una descripción..."
          placeholderTextColor={Colors.gris}
          value={form.descripcion}
          onChangeText={v => setField('descripcion', v)}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* ── Guardar ────────────────────────────── */}
      <TouchableOpacity
        style={[st.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color={Colors.blanco} />
          : <Text style={st.saveBtnText}>GUARDAR MOVIMIENTO</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, gap: 16 },

  // Monto
  montoContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: Colors.celeste,
    paddingBottom: 8, marginBottom: 4,
  },
  montoPrefix: { fontFamily: Fonts.mono, fontSize: 28, color: Colors.gris, marginRight: 8 },
  montoInput:  {
    flex: 1, fontFamily: Fonts.mono, fontSize: 40, color: Colors.texto,
    textAlign: 'right', padding: 0,
  },

  // Tipo
  tipoRow:  { flexDirection: 'row', gap: 12 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.borde, backgroundColor: Colors.blanco,
  },
  tipoBtnIngreso: { backgroundColor: Colors.verde,  borderColor: Colors.verde  },
  tipoBtnEgreso:  { backgroundColor: Colors.rojo,   borderColor: Colors.rojo   },
  tipoBtnTransfer:{ backgroundColor: Colors.morado, borderColor: Colors.morado },
  tipoBtnText:    { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.texto },

  // Campos genéricos
  fieldLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginBottom: 6 },

  // Fecha
  fechaRow: { flexDirection: 'row', gap: 10 },
  fechaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  fechaText: { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: Colors.texto },

  // Nota
  notaInput: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.texto,
    textAlignVertical: 'top', minHeight: 72,
  },

  // Guardar
  saveBtn: {
    backgroundColor: Colors.azul, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.8 },
});
