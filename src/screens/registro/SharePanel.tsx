import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CuentaSelector } from '../../components/forms/CuentaSelector';
import { CategoriaSelector } from '../../components/forms/CategoriaSelector';
import { useRegistroForm } from '../../hooks/useRegistroForm';
import { parseText } from '../../services/parser';
import { formatMonto } from '../../utils/formatters';
import { ParsedTransaction } from '../../types';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

interface SharePanelProps {
  onSaved: () => void;
}

const ORIGEN_LABELS: Record<string, string> = {
  yape: 'Yape', plin: 'Plin', bcp: 'BCP', interbank: 'Interbank', bbva: 'BBVA',
};

export function SharePanel({ onSaved }: SharePanelProps) {
  const {
    form, setField, setTipo, setCategoria, prefill,
    saving, handleSave, categoriasFiltradas, categoriaReset, cuentas,
  } = useRegistroForm(onSaved);

  const [textoCompartido, setTextoCompartido] = useState('');
  const [detectado, setDetectado]             = useState<ParsedTransaction | null>(null);
  const [errorParser, setErrorParser]         = useState(false);

  function handleDetectar() {
    const result = parseText(textoCompartido);
    if (result) {
      setDetectado(result);
      setErrorParser(false);
      prefill(result);
    } else {
      setDetectado(null);
      setErrorParser(true);
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
        <Text style={st.fieldLabel}>
          Pega el texto de Yape, Plin o tu banco
        </Text>
        <TextInput
          style={st.textoInput}
          placeholder={'Ej: "Yapeo exitoso\nS/ 80.00\nJuan Pérez\n06/03/2024"'}
          placeholderTextColor={Colors.gris}
          value={textoCompartido}
          onChangeText={t => { setTextoCompartido(t); setErrorParser(false); }}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {errorParser && (
          <Text style={st.errorText}>
            ⚠️ No se reconoció el formato. Revisa el texto o usa el modo Manual.
          </Text>
        )}

        <TouchableOpacity
          style={[st.detectarBtn, !textoCompartido && st.detectarBtnDisabled]}
          onPress={handleDetectar}
          disabled={!textoCompartido}
          activeOpacity={0.8}
        >
          <Ionicons name="scan-outline" size={18} color={Colors.blanco} />
          <Text style={st.detectarBtnText}>Detectar automáticamente</Text>
        </TouchableOpacity>
      </View>

      {/* ── Banner de lo detectado ────────────── */}
      {detectado && (
        <View style={[st.detectadoBanner, { borderLeftColor: Colors.morado }]}>
          <Text style={st.detectadoLabel}>
            🔍 Detectado: {ORIGEN_LABELS[detectado.origen] ?? detectado.origen}
          </Text>
          <Text style={st.detectadoMonto}>
            {formatMonto(detectado.monto, 'PEN')} · {detectado.tipo === 'ingreso' ? '↑' : '↓'}{' '}
            {detectado.tipo.charAt(0).toUpperCase() + detectado.tipo.slice(1)}
          </Text>
          {detectado.persona && (
            <Text style={st.detectadoSub}>👤 {detectado.persona}</Text>
          )}
          {detectado.numero_operacion && (
            <Text style={st.detectadoSub}>🔖 Op. {detectado.numero_operacion}</Text>
          )}
        </View>
      )}

      {/* ── Formulario de confirmación ────────── */}
      {detectado && (
        <>
          {/* Tipo */}
          <View style={st.tipoRow}>
            {(['ingreso', 'egreso'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[st.tipoBtn, form.tipo === t && (t === 'ingreso' ? st.tipoBtnIng : st.tipoBtnEgr)]}
                onPress={() => setTipo(t)}
              >
                <Ionicons name={t === 'ingreso' ? 'arrow-up-circle' : 'arrow-down-circle'} size={18}
                  color={form.tipo === t ? Colors.blanco : t === 'ingreso' ? Colors.verde : Colors.rojo}
                />
                <Text style={[st.tipoBtnText, form.tipo === t && { color: Colors.blanco }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <CuentaSelector cuentas={cuentas} value={form.cuentaId} onChange={id => setField('cuentaId', id)} />
          <CategoriaSelector
            categorias={categoriasFiltradas} tipo={form.tipo}
            value={form.categoriaId} onChange={setCategoria} advertencia={categoriaReset}
          />

          {/* Nota */}
          <View>
            <Text style={st.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              style={st.notaInput}
              placeholder="Descripción adicional..."
              placeholderTextColor={Colors.gris}
              value={form.descripcion}
              onChangeText={v => setField('descripcion', v)}
            />
          </View>

          <TouchableOpacity
            style={[st.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving} activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.blanco} />
              : <Text style={st.saveBtnText}>GUARDAR MOVIMIENTO</Text>
            }
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  fieldLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginBottom: 6 },
  textoInput: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, padding: 14, fontFamily: Fonts.regular, fontSize: 14,
    color: Colors.texto, minHeight: 110, textAlignVertical: 'top',
  },
  errorText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.rojo, marginTop: 4 },
  detectarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.morado, borderRadius: 12, paddingVertical: 13, marginTop: 10,
  },
  detectarBtnDisabled: { opacity: 0.4 },
  detectarBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.blanco },

  detectadoBanner: {
    backgroundColor: Colors.fondo, borderRadius: 14, padding: 14,
    borderLeftWidth: 4, gap: 4,
  },
  detectadoLabel:  { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.gris },
  detectadoMonto:  { fontFamily: Fonts.bold, fontSize: 20, color: Colors.texto },
  detectadoSub:    { fontFamily: Fonts.regular, fontSize: 13, color: Colors.gris },

  tipoRow: { flexDirection: 'row', gap: 12 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.borde, backgroundColor: Colors.blanco,
  },
  tipoBtnIng:  { backgroundColor: Colors.verde, borderColor: Colors.verde },
  tipoBtnEgr:  { backgroundColor: Colors.rojo,  borderColor: Colors.rojo  },
  tipoBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.texto },

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
