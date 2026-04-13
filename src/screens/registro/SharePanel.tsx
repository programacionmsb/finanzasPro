import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CuentaSelector }    from '../../components/forms/CuentaSelector';
import { CategoriaSelector } from '../../components/forms/CategoriaSelector';
import { useRegistroForm }   from '../../hooks/useRegistroForm';
import { Colors } from '../../constants/Colors';
import { Fonts }  from '../../constants/Fonts';

interface SharePanelProps {
  onSaved: () => void;
}

export function SharePanel({ onSaved }: SharePanelProps) {
  const {
    form, setField, setTipo, setCategoria,
    saving, handleSave, categoriasFiltradas, categoriaReset, cuentas,
  } = useRegistroForm(onSaved);

  const [textoCompartido, setTextoCompartido] = useState('');

  function handleUsarTexto() {
    if (textoCompartido.trim()) {
      setField('descripcion', textoCompartido.trim());
    }
  }

  return (
    <ScrollView
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Área de texto ─────────────────────── */}
      <View>
        <Text style={st.fieldLabel}>Texto compartido</Text>
        <TextInput
          style={st.textoInput}
          placeholder="Pegá aquí el texto copiado de tu app de pagos..."
          placeholderTextColor={Colors.gris}
          value={textoCompartido}
          onChangeText={setTextoCompartido}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        {textoCompartido.length > 0 && (
          <TouchableOpacity style={st.usarBtn} onPress={handleUsarTexto} activeOpacity={0.8}>
            <Ionicons name="arrow-down-circle-outline" size={16} color={Colors.celeste} />
            <Text style={st.usarBtnText}>Usar como descripción</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Formulario ────────────────────────── */}
      <View style={st.tipoRow}>
        {(['ingreso', 'egreso'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[st.tipoBtn, form.tipo === t && (t === 'ingreso' ? st.tipoBtnIng : st.tipoBtnEgr)]}
            onPress={() => setTipo(t)}
          >
            <Ionicons
              name={t === 'ingreso' ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={18}
              color={form.tipo === t ? Colors.blanco : t === 'ingreso' ? Colors.verde : Colors.rojo}
            />
            <Text style={[st.tipoBtnText, form.tipo === t && { color: Colors.blanco }]}>
              {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text style={st.fieldLabel}>Monto</Text>
        <TextInput
          style={st.montoInput}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={Colors.gris}
          value={form.monto}
          onChangeText={v => setField('monto', v)}
        />
      </View>

      <CuentaSelector
        cuentas={cuentas}
        value={form.cuentaId}
        onChange={id => setField('cuentaId', id)}
      />
      <CategoriaSelector
        categorias={categoriasFiltradas}
        tipo={form.tipo as 'ingreso' | 'egreso'}
        value={form.categoriaId}
        onChange={setCategoria}
        advertencia={categoriaReset}
      />

      <View>
        <Text style={st.fieldLabel}>Descripción</Text>
        <TextInput
          style={st.notaInput}
          placeholder="Descripción del movimiento..."
          placeholderTextColor={Colors.gris}
          value={form.descripcion}
          onChangeText={v => setField('descripcion', v)}
        />
      </View>

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

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content:    { padding: 20, gap: 16 },
  fieldLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginBottom: 6 },

  textoInput: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, padding: 14, fontFamily: Fonts.regular, fontSize: 14,
    color: Colors.texto, minHeight: 110, textAlignVertical: 'top',
  },
  usarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: Colors.celesteLight, borderRadius: 8,
  },
  usarBtnText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.celeste },

  tipoRow: { flexDirection: 'row', gap: 12 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.borde, backgroundColor: Colors.blanco,
  },
  tipoBtnIng:  { backgroundColor: Colors.verde, borderColor: Colors.verde },
  tipoBtnEgr:  { backgroundColor: Colors.rojo,  borderColor: Colors.rojo  },
  tipoBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.texto },

  montoInput: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: Fonts.regular, fontSize: 18, color: Colors.texto,
  },
  notaInput: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.texto,
  },
  saveBtn: {
    backgroundColor: Colors.azul, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.8 },
});
