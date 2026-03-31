import { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { CuentaSelector } from '../../components/forms/CuentaSelector';
import { CategoriaSelector } from '../../components/forms/CategoriaSelector';
import { useRegistroForm } from '../../hooks/useRegistroForm';
import { extractTextFromImage } from '../../services/ocr';
import { parseText } from '../../services/parser';
import { formatMonto } from '../../utils/formatters';
import { ParsedTransaction } from '../../types';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';
import { useAppStore } from '../../store/useAppStore';

interface FotoPanelProps {
  onSaved: () => void;
}

export function FotoPanel({ onSaved }: FotoPanelProps) {
  const {
    form, setField, setTipo, setCategoria, prefill,
    saving, handleSave, categoriasFiltradas, categoriaReset, cuentas,
  } = useRegistroForm(onSaved);

  const { imagenCompartida, setImagenCompartida } = useAppStore();

  const [imagenUri,  setImagenUri]  = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [detectado,  setDetectado]  = useState<ParsedTransaction | null>(null);
  const [errorOCR,   setErrorOCR]   = useState<string | null>(null);

  // Auto-procesar imagen recibida por share intent
  useEffect(() => {
    if (imagenCompartida) {
      setImagenCompartida(null);
      processImage(imagenCompartida);
    }
  }, [imagenCompartida]);

  async function processImage(uri: string) {
    setImagenUri(uri);
    setDetectado(null);
    setErrorOCR(null);
    setTipo('ingreso');
    setProcesando(true);
    try {
      const texto = await extractTextFromImage(uri);
      console.log('[OCR] Texto extraído:\n', texto);
      const parsed = parseText(texto);
      if (parsed) {
        setDetectado(parsed);
        prefill(parsed);
        setField('imagenPath', uri);
        setField('datosOcr', texto);
      } else {
        setErrorOCR('Se procesó la imagen pero no se detectó un pago conocido. Puedes completar los datos manualmente.');
      }
    } catch (e: any) {
      setErrorOCR(e.message ?? 'Error al procesar la imagen. Verifica tu conexión y API key.');
    } finally {
      setProcesando(false);
    }
  }

  async function pickImage(source: 'gallery' | 'camera') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permiso denegado', `Necesitamos acceso a tu ${source === 'camera' ? 'cámara' : 'galería'}.`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    await processImage(asset.uri);
  }

  return (
    <ScrollView
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Botones de fuente ─────────────────── */}
      <View style={st.sourceRow}>
        <TouchableOpacity style={st.sourceBtn} onPress={() => pickImage('gallery')} activeOpacity={0.8}>
          <Ionicons name="images-outline" size={22} color={Colors.celeste} />
          <Text style={st.sourceBtnText}>Galería</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.sourceBtn} onPress={() => pickImage('camera')} activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={22} color={Colors.celeste} />
          <Text style={st.sourceBtnText}>Cámara</Text>
        </TouchableOpacity>
      </View>

      {/* ── Imagen seleccionada ───────────────── */}
      {imagenUri && (
        <View style={st.imagenWrapper}>
          <Image source={{ uri: imagenUri }} style={st.imagen} resizeMode="cover" />
          {procesando && (
            <View style={st.procesandoOverlay}>
              <ActivityIndicator size="large" color={Colors.blanco} />
              <Text style={st.procesandoText}>Analizando imagen...</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Error OCR ─────────────────────────── */}
      {errorOCR && (
        <View style={st.errorBox}>
          <Ionicons name="warning-outline" size={16} color={Colors.amarillo} />
          <Text style={st.errorText}>{errorOCR}</Text>
        </View>
      )}

      {/* ── Banner detectado ─────────────────── */}
      {detectado && (
        <View style={st.detectadoBanner}>
          <Text style={st.detectadoLabel}>Detectado: {detectado.origen.toUpperCase()}</Text>
          <Text style={st.detectadoMonto}>
            {detectado.tipo === 'ingreso' ? '↑ ' : '↓ '}
            {formatMonto(detectado.monto, 'PEN')}
          </Text>
          {detectado.persona ? (
            <Text style={st.detectadoSub}>
              {detectado.tipo === 'ingreso' ? 'De' : 'A'}: {detectado.persona}
            </Text>
          ) : null}
          {detectado.descripcion ? (
            <Text style={st.detectadoSub} numberOfLines={2}>{detectado.descripcion}</Text>
          ) : null}
          <Text style={st.detectadoFecha}>{detectado.fecha.replace('T', ' ')}</Text>
        </View>
      )}

      {/* ── Formulario (si hay imagen) ────────── */}
      {imagenUri && !procesando && (
        <>
          <View style={st.tipoRow}>
            <TouchableOpacity
              style={[st.tipoBtn, form.tipo === 'ingreso' && st.tipoBtnIng]}
              onPress={() => setTipo('ingreso')}
            >
              <Ionicons name="arrow-up-circle" size={18}
                color={form.tipo === 'ingreso' ? Colors.blanco : Colors.verde} />
              <Text style={[st.tipoBtnText, form.tipo === 'ingreso' && { color: Colors.blanco }]}>
                Ingreso
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[st.tipoBtn, form.tipo === 'egreso' && st.tipoBtnEgr]}
              onPress={() => setTipo('egreso')}
            >
              <Ionicons name="arrow-down-circle" size={18}
                color={form.tipo === 'egreso' ? Colors.blanco : Colors.rojo} />
              <Text style={[st.tipoBtnText, form.tipo === 'egreso' && { color: Colors.blanco }]}>
                Egreso
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[st.tipoBtn, form.tipo === 'transferencia' && st.tipoBtnTransfer]}
              onPress={() => setTipo('transferencia')}
            >
              <Ionicons name="swap-horizontal" size={18}
                color={form.tipo === 'transferencia' ? Colors.blanco : Colors.morado} />
              <Text style={[st.tipoBtnText, form.tipo === 'transferencia' && { color: Colors.blanco }]}>
                Transferir
              </Text>
            </TouchableOpacity>
          </View>

          <CuentaSelector
            cuentas={cuentas}
            value={form.cuentaId}
            onChange={id => setField('cuentaId', id)}
            label={form.tipo === 'transferencia' ? 'Cuenta origen' : 'Cuenta'}
          />
          {form.tipo === 'transferencia' && (
            <CuentaSelector
              cuentas={cuentas.filter(c => c.id !== form.cuentaId)}
              value={form.cuentaDestinoId}
              onChange={id => setField('cuentaDestinoId', id)}
              label="Cuenta destino"
            />
          )}
          {form.tipo !== 'transferencia' && (
            <CategoriaSelector
              categorias={categoriasFiltradas} tipo={form.tipo}
              value={form.categoriaId} onChange={setCategoria} advertencia={categoriaReset}
            />
          )}

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

      {/* Placeholder inicial */}
      {!imagenUri && (
        <View style={st.placeholder}>
          <Text style={st.placeholderEmoji}>📷</Text>
          <Text style={st.placeholderText}>
            Selecciona una captura de pantalla de Yape, Plin o tu banco
          </Text>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// Necesario para el campo de nota dentro del panel
import { TextInput } from 'react-native';

const st = StyleSheet.create({
  content: { padding: 20, gap: 16 },

  sourceRow: { flexDirection: 'row', gap: 12 },
  sourceBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.celesteLight, borderRadius: 12,
    paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.celeste,
  },
  sourceBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.celeste },

  imagenWrapper: { borderRadius: 14, overflow: 'hidden', position: 'relative' },
  imagen:        { width: '100%', height: 180 },
  procesandoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  procesandoText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.blanco },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF8E7', borderRadius: 12, padding: 12,
  },
  errorText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Colors.texto },

  detectadoBanner: {
    backgroundColor: Colors.verdeLight, borderRadius: 12, padding: 14,
    borderLeftWidth: 4, borderLeftColor: Colors.verde, gap: 4,
  },
  detectadoLabel:  { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.gris, textTransform: 'uppercase', letterSpacing: 0.5 },
  detectadoMonto:  { fontFamily: Fonts.bold, fontSize: 22, color: Colors.verde },
  detectadoSub:    { fontFamily: Fonts.regular, fontSize: 13, color: Colors.texto },
  detectadoFecha:  { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris },

  tipoRow: { flexDirection: 'row', gap: 12 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.borde, backgroundColor: Colors.blanco,
  },
  tipoBtnIng:      { backgroundColor: Colors.verde,  borderColor: Colors.verde  },
  tipoBtnEgr:      { backgroundColor: Colors.rojo,   borderColor: Colors.rojo   },
  tipoBtnTransfer: { backgroundColor: Colors.morado, borderColor: Colors.morado },
  tipoBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.texto },

  fieldLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginBottom: 6 },
  notaInput: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.texto,
  },
  saveBtn: {
    backgroundColor: Colors.azul, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.8 },

  placeholder: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  placeholderEmoji: { fontSize: 56 },
  placeholderText: {
    fontFamily: Fonts.regular, fontSize: 14, color: Colors.gris,
    textAlign: 'center', lineHeight: 20,
  },
});
