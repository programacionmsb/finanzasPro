import { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { CuentaSelector } from '../../components/forms/CuentaSelector';
import { CategoriaSelector } from '../../components/forms/CategoriaSelector';
import { useRegistroForm } from '../../hooks/useRegistroForm';
import { extractTextFromImage } from '../../services/ocr';
import { OcrTemplate, getTemplates, aplicarTemplate, DatosAplicados } from '../../services/ocrTemplates';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../../types/navigation';
import { parseFechaOcr } from '../../utils/formatters';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';
import { useAppStore } from '../../store/useAppStore';

interface FotoPanelProps {
  onSaved: () => void;
}

type Estado = 'idle' | 'procesando' | 'eligiendo' | 'formulario';

export function FotoPanel({ onSaved }: FotoPanelProps) {
  const nav = useNavigation<StackNavigationProp<AppStackParamList>>();
  const {
    form, setField, setTipo, setCategoria,
    saving, handleSave, categoriasFiltradas, categoriaReset, cuentas,
  } = useRegistroForm(onSaved);

  const { imagenCompartida, setImagenCompartida } = useAppStore();

  const [imagenUri,  setImagenUri]  = useState<string | null>(null);
  const [estado,     setEstado]     = useState<Estado>('idle');
  const [textoOcr,   setTextoOcr]   = useState<string>('');
  const [templates,  setTemplates]  = useState<OcrTemplate[]>([]);
  const [detectado,  setDetectado]  = useState<string | null>(null); // nombre plantilla aplicada
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
    setEstado('procesando');
    setDetectado(null);
    setErrorOCR(null);
    setTipo('ingreso');
    try {
      const texto = await extractTextFromImage(uri);
      console.log('[OCR] Texto extraído:\n', texto);
      const tmpl = await getTemplates();
      setTextoOcr(texto);
      setTemplates(tmpl);
      // Siempre mostrar el selector para que el usuario elija
      setEstado('eligiendo');
    } catch (e: any) {
      setErrorOCR(e.message ?? 'Error al procesar la imagen.');
      setEstado('idle');
    }
  }

  function handleElegirPlantilla(template: OcrTemplate) {
    nav.navigate('OcrMapeo', {
      textoOcr:   textoOcr,
      imagenUri:  imagenUri!,
      templateId: template.id,
    });
  }

  function handleConfigurarNueva() {
    nav.navigate('OcrMapeo', { textoOcr, imagenUri: imagenUri! });
  }

  function handleSinPlantilla() {
    setField('imagenPath', imagenUri!);
    setField('datosOcr',   textoOcr);
    setField('origen',     'foto');
    setDetectado(null);
    setEstado('formulario');
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
    await processImage(result.assets[0].uri);
  }

  return (
    <ScrollView
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Botones de fuente ─────────────────── */}
      {(estado === 'idle' || estado === 'procesando') && (
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
      )}

      {/* ── Imagen ───────────────────────────── */}
      {imagenUri && (
        <View style={st.imagenWrapper}>
          <Image source={{ uri: imagenUri }} style={st.imagen} resizeMode="cover" />
          {estado === 'procesando' && (
            <View style={st.procesandoOverlay}>
              <ActivityIndicator size="large" color={Colors.blanco} />
              <Text style={st.procesandoText}>Analizando imagen...</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Error técnico OCR ────────────────── */}
      {errorOCR && (
        <View style={st.errorBox}>
          <Ionicons name="warning-outline" size={16} color={Colors.amarillo} />
          <Text style={st.errorText}>{errorOCR}</Text>
        </View>
      )}

      {/* ── Selector de plantilla ────────────── */}
      {estado === 'eligiendo' && (
        <View style={st.selectorBox}>
          <Text style={st.selectorTitle}>¿Con qué plantilla procesamos?</Text>
          <Text style={st.selectorSub}>
            Elige la plantilla que corresponde a esta imagen para extraer los datos automáticamente.
          </Text>

          {templates.length === 0 ? (
            <View style={st.sinPlantillas}>
              <Ionicons name="albums-outline" size={32} color={Colors.gris} />
              <Text style={st.sinPlantillasText}>No tienes plantillas guardadas aún</Text>
            </View>
          ) : (
            <View style={st.templateList}>
              {templates.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={st.templateCard}
                  onPress={() => handleElegirPlantilla(t)}
                  activeOpacity={0.75}
                >
                  <View style={st.templateCardLeft}>
                    <Ionicons name="scan-outline" size={20} color={Colors.celeste} />
                    <View>
                      <Text style={st.templateNombre}>{t.nombre}</Text>
                      <Text style={st.templateMeta}>
                        {t.mapeo.length} campo{t.mapeo.length !== 1 ? 's' : ''}
                        {t.palabrasClave.length > 0 ? ` · ${t.palabrasClave.slice(0, 2).join(', ')}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.gris} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Acciones secundarias */}
          <View style={st.selectorAcciones}>
            <TouchableOpacity style={st.accionBtn} onPress={handleSinPlantilla} activeOpacity={0.75}>
              <Ionicons name="create-outline" size={16} color={Colors.gris} />
              <Text style={st.accionBtnText}>Ingresar manualmente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.accionBtn, st.accionBtnPrimary]} onPress={handleConfigurarNueva} activeOpacity={0.75}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.celeste} />
              <Text style={[st.accionBtnText, { color: Colors.celeste }]}>Crear nueva plantilla</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Banner plantilla aplicada ────────── */}
      {estado === 'formulario' && detectado && (
        <View style={st.detectadoBanner}>
          <Ionicons name="checkmark-circle-outline" size={18} color={Colors.verde} />
          <Text style={st.detectadoLabel}>Plantilla aplicada: <Text style={st.detectadoNombre}>{detectado}</Text></Text>
        </View>
      )}

      {/* ── Formulario ────────────────────────── */}
      {estado === 'formulario' && (
        <>
          {/* Botón cambiar plantilla */}
          <TouchableOpacity style={st.cambiarBtn} onPress={() => setEstado('eligiendo')} activeOpacity={0.75}>
            <Ionicons name="refresh-outline" size={14} color={Colors.celeste} />
            <Text style={st.cambiarBtnText}>Cambiar plantilla</Text>
          </TouchableOpacity>

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

          {form.tipo === 'transferencia' && (
            <CuentaSelector
              cuentas={cuentas.filter(c => c.id !== form.cuentaId)}
              value={form.cuentaDestinoId}
              onChange={id => setField('cuentaDestinoId', id)}
              label="Cuenta destino"
            />
          )}

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
      {estado === 'idle' && !errorOCR && (
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

  // Selector de plantilla
  selectorBox: {
    backgroundColor: Colors.blanco, borderRadius: 16,
    padding: 16, gap: 14, borderWidth: 1.5, borderColor: Colors.borde,
  },
  selectorTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.texto },
  selectorSub:   { fontFamily: Fonts.regular, fontSize: 13, color: Colors.gris, lineHeight: 18, marginTop: -8 },

  sinPlantillas: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  sinPlantillasText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.gris, textAlign: 'center' },

  templateList: { gap: 8 },
  templateCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.fondo, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: Colors.borde,
  },
  templateCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  templateNombre:   { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.texto },
  templateMeta:     { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris, marginTop: 2 },

  selectorAcciones: { flexDirection: 'row', gap: 10, marginTop: 4 },
  accionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borde,
  },
  accionBtnPrimary: { borderColor: Colors.celeste, backgroundColor: Colors.celesteLight },
  accionBtnText:    { fontFamily: Fonts.medium, fontSize: 12, color: Colors.gris },

  // Formulario
  detectadoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.verdeLight, borderRadius: 12, padding: 12,
    borderLeftWidth: 4, borderLeftColor: Colors.verde,
  },
  detectadoLabel:  { fontFamily: Fonts.regular, fontSize: 13, color: Colors.texto, flex: 1 },
  detectadoNombre: { fontFamily: Fonts.semiBold, color: Colors.texto },

  cambiarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: -4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.celesteLight, borderRadius: 8,
  },
  cambiarBtnText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.celeste },

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
