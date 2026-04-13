import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';
import {
  CampoDestino, OcrTemplate,
  saveTemplate, extraerLineas, getTemplates, esLabelEstructura,
} from '../../services/ocrTemplates';
import { parseFechaOcr, buscarHoraEnLineas } from '../../utils/formatters';
import { CuentaSelector }    from '../../components/forms/CuentaSelector';
import { CategoriaSelector } from '../../components/forms/CategoriaSelector';
import { useRegistroForm }   from '../../hooks/useRegistroForm';

type Props = StackScreenProps<AppStackParamList, 'OcrMapeo'>;

// ── Campos disponibles para mapear ────────────────────────────────────────────

const CAMPOS_MAPEO: { key: CampoDestino; label: string; color: string; icon: string }[] = [
  { key: 'flujo',          label: 'Flujo',          color: '#8E44AD',        icon: 'swap-horizontal'     },
  { key: 'monto',          label: 'Monto',          color: Colors.verde,     icon: 'cash-outline'        },
  { key: 'persona',        label: 'Persona',        color: Colors.amarillo,  icon: 'person-outline'      },
  { key: 'fecha',          label: 'Fecha',          color: Colors.celeste,   icon: 'calendar-outline'    },
  { key: 'descripcion',    label: 'Descripción',    color: Colors.morado,    icon: 'text-outline'        },
  { key: 'telefono',       label: 'Teléfono',       color: '#E67E22',        icon: 'call-outline'        },
  { key: 'destino',        label: 'Destino',        color: '#16A085',        icon: 'navigate-outline'    },
  { key: 'nro_operacion',  label: 'Nro. Operación', color: '#1A5276',        icon: 'receipt-outline'     },
  { key: 'cuenta_origen',  label: 'Cta. Origen',    color: Colors.bcp,       icon: 'card-outline'        },
  { key: 'cuenta_destino', label: 'Cta. Destino',   color: Colors.interbank, icon: 'card-outline'        },
];

/** campo → uno o más índices de línea (soporta nombres de 2+ líneas) */
type MapeoState = Partial<Record<CampoDestino, number[]>>;

// ── Fila de campo ─────────────────────────────────────────────────────────────

const ETIQUETAS_RELATIVAS: Record<number, string> = {
  [-1]: 'Último',
  [-2]: 'Penúltimo',
  [-3]: 'Antepenúltimo',
};

function etiquetaLinea(idx: number, lineas: string[]): string {
  const etiqueta = ETIQUETAS_RELATIVAS[idx];
  const i        = idx < 0 ? lineas.length + idx : idx;
  const texto    = (i >= 0 && i < lineas.length) ? lineas[i] : '';
  if (etiqueta) return `[${etiqueta}] ${texto}`;
  return `[${idx + 1}] ${texto}`;
}

function CampoRow({
  campo, indices, lineas, onPress,
}: {
  campo: { key: CampoDestino; label: string; color: string; icon: string };
  indices: number[] | undefined;
  lineas: string[];
  onPress: () => void;
}) {
  const asignado = indices && indices.length > 0;
  const labelTexto = !asignado
    ? 'Sin asignar'
    : indices!.length === 1
      ? etiquetaLinea(indices![0], lineas)
      : `${indices!.length} líneas: ${indices!.map(i => etiquetaLinea(i, lineas)).join(' + ')}`;

  return (
    <TouchableOpacity style={cr.row} onPress={onPress} activeOpacity={0.75}>
      <View style={[cr.iconWrap, { backgroundColor: campo.color + '18' }]}>
        <Ionicons name={campo.icon as any} size={15} color={campo.color} />
      </View>
      <Text style={cr.label}>{campo.label}</Text>
      <View style={[cr.selector, asignado && { borderColor: campo.color, backgroundColor: campo.color + '10' }]}>
        <Text
          style={[cr.selectorText, asignado ? { color: Colors.texto } : { color: Colors.gris }]}
          numberOfLines={2}
        >
          {labelTexto}
        </Text>
        <Ionicons name="chevron-down" size={13} color={asignado ? campo.color : Colors.gris} />
      </View>
    </TouchableOpacity>
  );
}

const cr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  iconWrap:  { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label:     { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.texto, width: 100 },
  selector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1.5, borderColor: Colors.borde, backgroundColor: Colors.fondo,
  },
  selectorText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12 },
});

// ── Pantalla principal ────────────────────────────────────────────────────────

export function OcrMapeoScreen({ navigation, route }: Props) {
  const { textoOcr, imagenUri, templateId } = route.params;

  const {
    form, setField, setTipo, setCategoria,
    saving, handleSave, categoriasFiltradas, categoriaReset, cuentas,
  } = useRegistroForm(() => navigation.popToTop());

  const lineasBase = extraerLineas(textoOcr);

  const [mapeo,           setMapeo]           = useState<MapeoState>({});
  const [plantillaActiva, setPlantillaActiva] = useState<OcrTemplate | null>(null);
  const [selectorCampo,   setSelectorCampo]   = useState<CampoDestino | null>(null);

  const [modalVisible,    setModalVisible]    = useState(false);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [savingPlantilla, setSavingPlantilla] = useState(false);
  const [cuentaKeyword,   setCuentaKeyword]   = useState('');
  const [palabrasIngreso, setPalabrasIngreso] = useState('');
  const [palabrasEgreso,  setPalabrasEgreso]  = useState('');

  const [fecha,             setFecha]             = useState('');
  const [telefono,          setTelefono]          = useState('');
  const [nroOperacion,      setNroOperacion]      = useState('');
  const [destino,           setDestino]           = useState('');
  const [cuentaOrigenHint,  setCuentaOrigenHint]  = useState('');
  const [cuentaDestinoHint, setCuentaDestinoHint] = useState('');

  // ── Inicialización ────────────────────────────────────────────────────────

  useEffect(() => {
    setField('imagenPath', imagenUri);
    setField('datosOcr',   textoOcr);
    setField('origen',     'foto');

    if (!templateId) return;

    getTemplates().then(templates => {
      const t = templates.find(tp => tp.id === templateId);
      if (!t) return;

      const mapeoInit: MapeoState = {};
      t.mapeo.forEach(m => {
        mapeoInit[m.campo] = [...(mapeoInit[m.campo] ?? []), m.lineaIdx];
      });
      setMapeo(mapeoInit);
      setNombrePlantilla(t.nombre);
      setCuentaKeyword(t.cuentaKeyword ?? '');
      setPalabrasIngreso(t.palabrasIngreso?.join(', ') ?? '');
      setPalabrasEgreso(t.palabrasEgreso?.join(', ') ?? '');
      setPlantillaActiva(t);

      // Colocar datos inmediatamente con el mapeo cargado
      aplicarMapeo(mapeoInit);

      const textoLower = textoOcr.toLowerCase();
      if (t.palabrasIngreso?.some(p => textoLower.includes(p.toLowerCase()))) {
        setTipo('ingreso');
      } else if (t.palabrasEgreso?.some(p => textoLower.includes(p.toLowerCase()))) {
        setTipo('egreso');
      }
    });
  }, []);

  // Auto-seleccionar cuenta según tipo cuando hay cuentaKeyword
  useEffect(() => {
    if (!plantillaActiva?.cuentaKeyword || cuentas.length === 0) return;
    const keyword = plantillaActiva.cuentaKeyword.toLowerCase();
    const cuenta  = cuentas.find(c => c.nombre.toLowerCase().includes(keyword));
    if (!cuenta) return;

    if (form.tipo === 'transferencia') {
      // Transferencia: BCP es la cuenta destino, origen queda sin seleccionar
      setField('cuentaDestinoId', cuenta.id);
      setField('cuentaId', null);
    } else {
      // Ingreso/Egreso: BCP es la cuenta del movimiento (etiqueta varía en UI)
      setField('cuentaId', cuenta.id);
      setField('cuentaDestinoId', null);
    }
  }, [cuentas, plantillaActiva, form.tipo]);

  // ── Lógica de mapeo ───────────────────────────────────────────────────────

  /** Resuelve un índice (positivo o negativo) al texto de línea correspondiente */
  function resolverLinea(idx: number): string {
    const i = idx < 0 ? lineasBase.length + idx : idx;
    return (i >= 0 && i < lineasBase.length) ? lineasBase[i] : '';
  }

  /** Resuelve todos los índices de un campo y los une con espacio */
  function resolverCampo(indices: number[]): string {
    return indices
      .map(resolverLinea)
      .filter(t => t && !esLabelEstructura(t))
      .join(' ');
  }

  function aplicarMapeo(m: MapeoState) {
    const get = (c: CampoDestino): string => {
      const indices = m[c];
      if (!indices || indices.length === 0) return '';
      return resolverCampo(indices);
    };

    // ── Persona dinámica: entre monto y fecha ────────────────────────────────
    // Si el mapeo tiene monto + fecha + persona, detectamos persona por contenido
    // para soportar nombres de 1 o 2+ líneas automáticamente.
    let personaDinamica = '';
    if (m['monto'] !== undefined && m['fecha'] !== undefined && m['persona'] !== undefined) {
      const RE_MONTO = /[Ss]\/\s*[\d]|[\d]+[.,]\d{2}/;
      const RE_FECHA = /\d{1,2}\s+[a-záéíóú]{3,10}\.?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/i;
      const idxMonto = lineasBase.findIndex(l => RE_MONTO.test(l));
      const idxFecha = lineasBase.findIndex(l => RE_FECHA.test(l));
      if (idxMonto >= 0 && idxFecha > idxMonto + 1) {
        personaDinamica = lineasBase
          .slice(idxMonto + 1, idxFecha)
          .filter(l => !esLabelEstructura(l) && !RE_MONTO.test(l))
          .join(' ');
      }
    }

    // Notas = flujo + persona (dinámica o por mapeo) + teléfono + destino + descripción
    const notas = [
      get('flujo'),
      personaDinamica || get('persona'),
      get('telefono'),
      get('destino'),
      get('descripcion'),
    ].filter(Boolean);
    setField('descripcion', notas.join(' - '));

    const lineaMonto = get('monto');
    if (lineaMonto) {
      const match = lineaMonto.match(/[\d]+[.,]\d{2}/) ?? lineaMonto.match(/[\d,.]+/);
      if (match) setField('monto', match[0].replace(/,/g, '.'));
    }

    const RE_FECHA_V = /\d{1,2}\s+[a-záéíóú]{3,10}\.?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/i;

    // Si el lineaIdx apuntó a una línea incorrecta, buscar la fecha por contenido
    let fechaTexto = get('fecha');
    if (!RE_FECHA_V.test(fechaTexto)) {
      fechaTexto = lineasBase.find(l => RE_FECHA_V.test(l)) ?? '';
    }

    // Si la fecha no tiene hora, buscarla en otras líneas
    let fechaCompleta = fechaTexto;
    if (fechaTexto && RE_FECHA_V.test(fechaTexto) && !/\d{1,2}:\d{2}/.test(fechaTexto)) {
      const hora = buscarHoraEnLineas(lineasBase.filter(l => l !== fechaTexto));
      if (hora) fechaCompleta = `${fechaTexto} ${hora}`;
    }
    setFecha(fechaCompleta);
    if (fechaCompleta) {
      const fp = parseFechaOcr(fechaCompleta);
      if (fp) setField('fecha', fp);
    }

    setTelefono(get('telefono'));
    const nroOp = get('nro_operacion');
    setNroOperacion(nroOp);
    setField('numeroOperacion', nroOp || '0');
    setDestino(get('destino'));
    setCuentaOrigenHint(get('cuenta_origen'));
    setCuentaDestinoHint(get('cuenta_destino'));
  }

  function handleColocarDatos() {
    aplicarMapeo(mapeo);
  }

  function toggleLinea(campo: CampoDestino, lineaIdx: number | null) {
    setMapeo(prev => {
      const next = { ...prev };
      if (lineaIdx === null) {
        delete next[campo];
      } else {
        const actual = next[campo] ?? [];
        if (actual.includes(lineaIdx)) {
          // Deseleccionar
          const filtrado = actual.filter(i => i !== lineaIdx);
          if (filtrado.length === 0) delete next[campo];
          else next[campo] = filtrado;
        } else {
          // Agregar y ordenar por posición real
          next[campo] = [...actual, lineaIdx].sort((a, b) => {
            const ai = a < 0 ? lineasBase.length + a : a;
            const bi = b < 0 ? lineasBase.length + b : b;
            return ai - bi;
          });
        }
      }
      return next;
    });
  }

  // ── Guardar plantilla + movimiento ────────────────────────────────────────

  async function handleConfirmar() {
    if (!nombrePlantilla.trim()) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para identificar este tipo de imagen (ej: Yape, Plin BCP).');
      return;
    }
    // Expandir arrays a pares [campo, lineaIdx]
    const mapeadas: [CampoDestino, number][] = [];
    Object.entries(mapeo).forEach(([campo, indices]) => {
      (indices as number[]).forEach(idx => mapeadas.push([campo as CampoDestino, idx]));
    });

    if (mapeadas.length === 0) {
      Alert.alert('Sin mapeo', 'Asigna al menos un campo antes de guardar.');
      return;
    }

    setSavingPlantilla(true);
    try {
      const template: OcrTemplate = {
        id:            Date.now().toString(),
        nombre:        nombrePlantilla.trim(),
        palabrasClave: mapeadas.map(([, idx]) => resolverLinea(idx).substring(0, 40)),
        mapeo:         mapeadas.map(([campo, lineaIdx]) => ({
          fragmento: resolverLinea(lineaIdx).substring(0, 40),
          campo,
          lineaIdx,
        })),
        creado_en:     new Date().toISOString(),
        cuentaKeyword: cuentaKeyword.trim() || undefined,
        palabrasIngreso: palabrasIngreso.trim()
          ? palabrasIngreso.split(',').map(p => p.trim()).filter(Boolean)
          : undefined,
        palabrasEgreso: palabrasEgreso.trim()
          ? palabrasEgreso.split(',').map(p => p.trim()).filter(Boolean)
          : undefined,
      };
      console.log('[Plantilla] template construido OK, guardando...');
      await saveTemplate(template);
      console.log('[Plantilla] saveTemplate OK, guardando movimiento...');
      setModalVisible(false);
      await handleSave();
      console.log('[Plantilla] handleSave OK');
    } catch (e) {
      console.error('[Plantilla] ERROR al guardar:', e);
      Alert.alert('Error', 'No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSavingPlantilla(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const camposMapeados  = Object.keys(mapeo).length;
  const campoSelector   = CAMPOS_MAPEO.find(c => c.key === selectorCampo);
  const indicesActivos  = selectorCampo ? (mapeo[selectorCampo] ?? []) : [];

  return (
    <>
      <ScrollView
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Sección de mapeo (solo si NO viene de plantilla) ─────────── */}
        {!plantillaActiva && (
          <>
            {/* Preview de líneas OCR */}
            <View style={st.card}>
              <Text style={st.cardTitle}>Texto detectado — {lineasBase.length} líneas</Text>
              {lineasBase.length === 0 ? (
                <Text style={st.emptyText}>No se detectó texto en la imagen.</Text>
              ) : (
                lineasBase.map((linea, idx) => (
                  <View key={idx} style={st.lineaPreview}>
                    <Text style={st.lineaNum}>{idx + 1}</Text>
                    <Text style={st.lineaTexto} numberOfLines={1}>{linea}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Asignación campo → línea */}
            <View style={st.card}>
              <Text style={st.cardTitle}>¿Qué línea corresponde a cada dato?</Text>
              {CAMPOS_MAPEO.map(campo => (
                <CampoRow
                  key={campo.key}
                  campo={campo}
                  indices={mapeo[campo.key]}
                  lineas={lineasBase}
                  onPress={() => setSelectorCampo(campo.key)}
                />
              ))}
            </View>

            {/* Botón colocar datos */}
            {camposMapeados > 0 && (
              <TouchableOpacity style={st.colocarBtn} onPress={handleColocarDatos} activeOpacity={0.8}>
                <Ionicons name="push-outline" size={18} color={Colors.blanco} />
                <Text style={st.colocarBtnText}>Colocar datos en el formulario</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Formulario del movimiento ─────────────────────────────────── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Movimiento</Text>

          {/* Tipo */}
          <View style={st.tipoRow}>
            <TouchableOpacity
              style={[st.tipoBtn, form.tipo === 'ingreso' && st.tipoBtnIng]}
              onPress={() => setTipo('ingreso')} activeOpacity={0.8}
            >
              <Ionicons name="arrow-up-circle" size={16}
                color={form.tipo === 'ingreso' ? Colors.blanco : Colors.verde} />
              <Text style={[st.tipoBtnText, form.tipo === 'ingreso' && { color: Colors.blanco }]}>Ingreso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.tipoBtn, form.tipo === 'egreso' && st.tipoBtnEgr]}
              onPress={() => setTipo('egreso')} activeOpacity={0.8}
            >
              <Ionicons name="arrow-down-circle" size={16}
                color={form.tipo === 'egreso' ? Colors.blanco : Colors.rojo} />
              <Text style={[st.tipoBtnText, form.tipo === 'egreso' && { color: Colors.blanco }]}>Egreso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.tipoBtn, form.tipo === 'transferencia' && st.tipoBtnTransfer]}
              onPress={() => setTipo('transferencia')} activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={16}
                color={form.tipo === 'transferencia' ? Colors.blanco : Colors.morado} />
              <Text style={[st.tipoBtnText, form.tipo === 'transferencia' && { color: Colors.blanco }]}>Transferir</Text>
            </TouchableOpacity>
          </View>

          {/* Monto */}
          <Text style={st.fieldLabel}>Monto</Text>
          <TextInput
            style={st.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.gris}
            value={form.monto}
            onChangeText={v => setField('monto', v)}
          />

          <Text style={st.fieldLabel}>Fecha</Text>
          <TextInput
            style={st.input}
            placeholder="dd/mm/aaaa hh:mm a. m."
            placeholderTextColor={Colors.gris}
            value={fecha}
            onChangeText={v => {
              setFecha(v);
              const fp = parseFechaOcr(v);
              if (fp) setField('fecha', fp);
            }}
          />

          {telefono !== '' && (
            <>
              <Text style={st.fieldLabel}>Teléfono</Text>
              <TextInput
                style={st.input}
                keyboardType="phone-pad"
                placeholder="Número de celular"
                placeholderTextColor={Colors.gris}
                value={telefono}
                onChangeText={setTelefono}
              />
            </>
          )}

          {destino !== '' && (
            <>
              <Text style={st.fieldLabel}>Destino</Text>
              <TextInput
                style={st.input}
                placeholder="Destinatario"
                placeholderTextColor={Colors.gris}
                value={destino}
                onChangeText={setDestino}
              />
            </>
          )}

          {nroOperacion !== '' && (
            <>
              <Text style={st.fieldLabel}>Nro. Operación</Text>
              <TextInput
                style={st.input}
                placeholder="Número de operación"
                placeholderTextColor={Colors.gris}
                value={nroOperacion}
                onChangeText={v => { setNroOperacion(v); setField('numeroOperacion', v || '0'); }}
              />
            </>
          )}

          {cuentaOrigenHint !== '' && (
            <View style={st.labelRow}>
              <Ionicons name="card-outline" size={15} color={Colors.gris} />
              <Text style={st.labelKey}>Detectado origen</Text>
              <Text style={st.labelVal}>{cuentaOrigenHint}</Text>
            </View>
          )}
          <CuentaSelector
            cuentas={cuentas}
            value={form.cuentaId}
            onChange={id => setField('cuentaId', id)}
            label={form.tipo === 'transferencia' ? 'Cuenta origen' : 'Cuenta'}
          />

          {form.tipo === 'transferencia' && (
            <>
              {cuentaDestinoHint !== '' && (
                <View style={st.labelRow}>
                  <Ionicons name="card-outline" size={15} color={Colors.gris} />
                  <Text style={st.labelKey}>Detectado destino</Text>
                  <Text style={st.labelVal}>{cuentaDestinoHint}</Text>
                </View>
              )}
              <CuentaSelector
                cuentas={cuentas.filter(c => c.id !== form.cuentaId)}
                value={form.cuentaDestinoId}
                onChange={id => setField('cuentaDestinoId', id)}
                label="Cuenta destino"
              />
            </>
          )}

          <CategoriaSelector
            categorias={categoriasFiltradas}
            tipo={form.tipo as 'ingreso' | 'egreso'}
            value={form.categoriaId}
            onChange={setCategoria}
            advertencia={categoriaReset}
          />

          <Text style={st.fieldLabel}>Notas</Text>
          <TextInput
            style={[st.input, st.inputMulti]}
            placeholder="Se completará con los campos marcados como Descripción..."
            placeholderTextColor={Colors.gris}
            value={form.descripcion}
            onChangeText={v => setField('descripcion', v)}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={st.saveBtn}
          onPress={() => plantillaActiva ? handleSave() : setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name={plantillaActiva ? 'save-outline' : 'bookmark'} size={18} color={Colors.blanco} />
          <Text style={st.saveBtnText}>{plantillaActiva ? 'GUARDAR MOVIMIENTO' : 'NOMBRAR Y GUARDAR'}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Modal: selector de línea para un campo ───────────────────────── */}
      <Modal
        visible={!!selectorCampo}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorCampo(null)}
      >
        <TouchableOpacity
          style={st.overlay}
          activeOpacity={1}
          onPress={() => setSelectorCampo(null)}
        />
        <View style={st.pickerSheet}>
          {/* Header */}
          <View style={st.pickerHeader}>
            <View style={[st.pickerDot, { backgroundColor: campoSelector?.color ?? Colors.gris }]} />
            <Text style={st.pickerTitle}>
              Línea para{' '}
              <Text style={{ color: campoSelector?.color }}>{campoSelector?.label}</Text>
            </Text>
            <TouchableOpacity style={st.pickerListoBtn} onPress={() => setSelectorCampo(null)}>
              <Text style={st.pickerListoText}>Listo</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Instrucción multi-select */}
            <View style={st.pickerHint}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.gris} />
              <Text style={st.pickerHintText}>Toca para seleccionar/deseleccionar. Permite múltiples líneas.</Text>
            </View>

            {/* Sin asignar */}
            <TouchableOpacity
              style={[st.pickerLinea, indicesActivos.length === 0 && st.pickerLineaSinAsignar]}
              onPress={() => selectorCampo && toggleLinea(selectorCampo, null)}
              activeOpacity={0.75}
            >
              <Text style={[st.pickerLineaNum, { color: Colors.gris }]}>—</Text>
              <Text style={[st.pickerLineaTexto, { color: Colors.gris }]}>Sin asignar</Text>
            </TouchableOpacity>

            {/* Posiciones relativas (desde el final) */}
            {([-1, -2, -3] as const).map(rel => {
              const seleccionado = indicesActivos.includes(rel);
              const textoLinea   = resolverLinea(rel);
              if (!textoLinea) return null;
              return (
                <TouchableOpacity
                  key={rel}
                  style={[
                    st.pickerLinea, st.pickerLineaRelativa,
                    seleccionado && { backgroundColor: (campoSelector?.color ?? Colors.celeste) + '14',
                                      borderLeftColor: campoSelector?.color ?? Colors.celeste,
                                      borderLeftWidth: 4 },
                  ]}
                  onPress={() => selectorCampo && toggleLinea(selectorCampo, rel)}
                  activeOpacity={0.75}
                >
                  <Text style={[st.pickerLineaEtiqueta, seleccionado && { color: campoSelector?.color }]}>
                    {ETIQUETAS_RELATIVAS[rel]}
                  </Text>
                  <Text
                    style={[st.pickerLineaTexto,
                      seleccionado && { color: campoSelector?.color, fontFamily: Fonts.semiBold }]}
                    numberOfLines={1}
                  >
                    {textoLinea}
                  </Text>
                  {seleccionado && <Ionicons name="checkmark-circle" size={18} color={campoSelector?.color} />}
                </TouchableOpacity>
              );
            })}

            {/* Separador */}
            <View style={st.pickerSeparador}>
              <Text style={st.pickerSeparadorText}>Por posición exacta</Text>
            </View>

            {/* Líneas OCR */}
            {lineasBase.map((linea, idx) => {
              const seleccionado = indicesActivos.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    st.pickerLinea,
                    seleccionado && { backgroundColor: (campoSelector?.color ?? Colors.celeste) + '14',
                                      borderLeftColor: campoSelector?.color ?? Colors.celeste,
                                      borderLeftWidth: 4 },
                  ]}
                  onPress={() => selectorCampo && toggleLinea(selectorCampo, idx)}
                  activeOpacity={0.75}
                >
                  <Text style={[st.pickerLineaNum, seleccionado && { color: campoSelector?.color }]}>
                    {idx + 1}
                  </Text>
                  <Text
                    style={[
                      st.pickerLineaTexto,
                      seleccionado && { color: campoSelector?.color, fontFamily: Fonts.semiBold },
                    ]}
                  >
                    {linea}
                  </Text>
                  {seleccionado && (
                    <Ionicons name="checkmark-circle" size={18} color={campoSelector?.color} />
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: nombre y config de la plantilla ───────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={st.overlay} />
        <ScrollView
          style={st.sheet}
          contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={st.sheetTitle}>¿Cómo se llama esta imagen?</Text>
          <Text style={st.sheetSub}>
            Dale un nombre para identificar este tipo de comprobante (ej: Yape, Plin BCP, BBVA).
            La app la reconocerá automáticamente la próxima vez.
          </Text>
          <TextInput
            style={st.sheetInput}
            placeholder="Nombre (ej: Yape, Plin BCP...)"
            placeholderTextColor={Colors.gris}
            value={nombrePlantilla}
            onChangeText={setNombrePlantilla}
            autoFocus
            maxLength={40}
          />

          <Text style={st.sheetSectionLabel}>Configuración automática (opcional)</Text>

          <Text style={st.sheetFieldLabel}>Cuenta por defecto</Text>
          <TextInput
            style={st.sheetInput}
            placeholder="Ej: BCP, Interbank, BBVA..."
            placeholderTextColor={Colors.gris}
            value={cuentaKeyword}
            onChangeText={setCuentaKeyword}
            maxLength={30}
          />

          <Text style={st.sheetFieldLabel}>Palabras que indican INGRESO</Text>
          <TextInput
            style={st.sheetInput}
            placeholder="Ej: te yapearon, recibiste (separadas por coma)"
            placeholderTextColor={Colors.gris}
            value={palabrasIngreso}
            onChangeText={setPalabrasIngreso}
          />

          <Text style={st.sheetFieldLabel}>Palabras que indican EGRESO</Text>
          <TextInput
            style={st.sheetInput}
            placeholder="Ej: yapeaste, enviaste (separadas por coma)"
            placeholderTextColor={Colors.gris}
            value={palabrasEgreso}
            onChangeText={setPalabrasEgreso}
          />

          <TouchableOpacity
            style={[st.sheetBtn, (savingPlantilla || saving) && { opacity: 0.6 }]}
            onPress={handleConfirmar}
            disabled={savingPlantilla || saving}
            activeOpacity={0.85}
          >
            {(savingPlantilla || saving)
              ? <ActivityIndicator color={Colors.blanco} />
              : <Text style={st.sheetBtnText}>GUARDAR PLANTILLA Y MOVIMIENTO</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={st.sheetCancelBtn} onPress={() => setModalVisible(false)}>
            <Text style={st.sheetCancelText}>Volver a revisar</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  content: { padding: 16, gap: 14 },

  // Card
  card: { backgroundColor: Colors.blanco, borderRadius: 14, overflow: 'hidden' },
  cardTitle: {
    fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.gris,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  emptyText: {
    fontFamily: Fonts.regular, fontSize: 13, color: Colors.gris,
    padding: 14, textAlign: 'center',
  },

  // Preview de líneas OCR
  lineaPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  lineaNum: {
    fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.gris,
    width: 20, textAlign: 'center',
    backgroundColor: Colors.fondo, borderRadius: 4, paddingVertical: 2,
  },
  lineaTexto: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Colors.texto },

  // Botón colocar datos
  colocarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.verde, borderRadius: 14, paddingVertical: 14,
  },
  colocarBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.5 },

  // Formulario
  tipoRow: { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 0 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.borde, backgroundColor: Colors.fondo,
  },
  tipoBtnIng:      { backgroundColor: Colors.verde,  borderColor: Colors.verde  },
  tipoBtnEgr:      { backgroundColor: Colors.rojo,   borderColor: Colors.rojo   },
  tipoBtnTransfer: { backgroundColor: Colors.morado, borderColor: Colors.morado },
  tipoBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.texto },

  fieldLabel: {
    fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto,
    marginTop: 12, paddingHorizontal: 14,
  },
  input: {
    marginHorizontal: 14, marginTop: 6, marginBottom: 2,
    backgroundColor: Colors.fondo, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.texto,
  },
  inputMulti: { minHeight: 72, paddingTop: 11 },

  labelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 10,
    backgroundColor: Colors.fondo, borderRadius: 8, padding: 10,
  },
  labelKey: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.gris, width: 110 },
  labelVal: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.texto },

  // Botón guardar
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.azul, borderRadius: 14, paddingVertical: 16,
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.8 },

  // Picker de líneas
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  pickerSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.blanco,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%', paddingBottom: 12,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  pickerDot:   { width: 12, height: 12, borderRadius: 6 },
  pickerTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: 16, color: Colors.texto },
  pickerLinea: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  pickerHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: Colors.celesteLight,
  },
  pickerHintText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: Colors.gris },
  pickerListoBtn: {
    backgroundColor: Colors.celeste, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  pickerListoText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.blanco },
  pickerLineaSinAsignar: { backgroundColor: Colors.fondo },
  pickerLineaRelativa:   { backgroundColor: Colors.celesteLight },
  pickerLineaEtiqueta: {
    fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.celeste,
    width: 100, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  pickerSeparador: {
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: Colors.fondo, borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  pickerSeparadorText: {
    fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.gris,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  pickerLineaNum: {
    fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.gris,
    width: 22, textAlign: 'center',
  },
  pickerLineaTexto: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.texto },

  // Modal nombre plantilla
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.blanco, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24,
  },
  sheetTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.texto },
  sheetSub:   { fontFamily: Fonts.regular, fontSize: 13, color: Colors.gris, lineHeight: 19 },
  sheetInput: {
    backgroundColor: Colors.fondo, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: Fonts.regular, fontSize: 16, color: Colors.texto,
  },
  sheetBtn: {
    backgroundColor: Colors.azul, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  sheetBtnText:    { fontFamily: Fonts.bold, fontSize: 14, color: Colors.blanco, letterSpacing: 0.5 },
  sheetCancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  sheetCancelText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.gris },
  sheetSectionLabel: {
    fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.gris,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4,
  },
  sheetFieldLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginTop: 6 },
});
