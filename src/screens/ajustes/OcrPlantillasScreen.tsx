import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Fonts }  from '../../constants/Fonts';
import { OcrTemplate, getTemplates, deleteTemplate, CampoDestino } from '../../services/ocrTemplates';

// ── Colores de campo ──────────────────────────────────────────────────────────

const CAMPO_COLOR: Record<CampoDestino, string> = {
  monto:          Colors.verde,
  fecha:          Colors.celeste,
  descripcion:    Colors.morado,
  persona:        Colors.amarillo,
  telefono:       '#E67E22',
  nro_operacion:  '#1A5276',
  destino:        '#16A085',
  cuenta_origen:  Colors.bcp,
  cuenta_destino: Colors.interbank,
  ignorar:        Colors.gris,
};

// ── Tarjeta de plantilla ──────────────────────────────────────────────────────

function PlantillaCard({
  template,
  onDelete,
}: {
  template: OcrTemplate;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={pc.card}>
      <TouchableOpacity
        style={pc.header}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.75}
      >
        <View style={pc.headerLeft}>
          <Ionicons name="scan-outline" size={20} color={Colors.celeste} />
          <Text style={pc.nombre}>{template.nombre}</Text>
        </View>
        <View style={pc.headerRight}>
          <Text style={pc.campos}>{template.mapeo.length} campo{template.mapeo.length !== 1 ? 's' : ''}</Text>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.rojo} />
          </TouchableOpacity>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.gris}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={pc.body}>
          <Text style={pc.sectionLabel}>Palabras clave</Text>
          <View style={pc.chipRow}>
            {template.palabrasClave.slice(0, 5).map((kw, i) => (
              <View key={i} style={pc.kwChip}>
                <Text style={pc.kwText} numberOfLines={1}>{kw}</Text>
              </View>
            ))}
          </View>

          <Text style={pc.sectionLabel}>Mapeo de campos</Text>
          {template.mapeo.map((m, i) => (
            <View key={i} style={pc.mapRow}>
              <View style={[pc.campoBadge, { borderColor: CAMPO_COLOR[m.campo] }]}>
                <Text style={[pc.campoText, { color: CAMPO_COLOR[m.campo] }]}>{m.campo}</Text>
              </View>
              <Text style={pc.fragmento} numberOfLines={1}>{m.fragmento}</Text>
            </View>
          ))}

          <Text style={pc.fecha}>
            Creada: {new Date(template.creado_en).toLocaleDateString('es-PE')}
          </Text>
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  card: { backgroundColor: Colors.blanco, borderRadius: 14, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nombre:      { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.texto, flex: 1 },
  campos:      { fontFamily: Fonts.regular, fontSize: 12, color: Colors.gris },

  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: Colors.borde, paddingTop: 12 },
  sectionLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.gris, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kwChip:  { backgroundColor: Colors.fondo, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 180 },
  kwText:  { fontFamily: Fonts.regular, fontSize: 11, color: Colors.texto },

  mapRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  campoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5 },
  campoText:  { fontFamily: Fonts.semiBold, fontSize: 11 },
  fragmento:  { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Colors.texto },

  fecha: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris, marginTop: 4 },
});

// ── Pantalla principal ────────────────────────────────────────────────────────

export function OcrPlantillasScreen() {
  const [templates, setTemplates] = useState<OcrTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);

  useFocusEffect(useCallback(() => {
    loadTemplates();
  }, []));

  async function loadTemplates() {
    setLoading(true);
    setTemplates(await getTemplates());
    setLoading(false);
  }

  function handleDelete(t: OcrTemplate) {
    Alert.alert(
      'Eliminar plantilla',
      `¿Eliminar "${t.nombre}"? La app ya no reconocerá automáticamente imágenes de este tipo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteTemplate(t.id);
            await loadTemplates();
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={st.safe}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Explicación */}
      <View style={st.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.celeste} />
        <Text style={st.infoText}>
          Las plantillas permiten que la app reconozca automáticamente imágenes de pagos
          que configuraste previamente al procesar una foto.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.celeste} style={{ marginTop: 40 }} />
      ) : templates.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyEmoji}>🗂️</Text>
          <Text style={st.emptyTitle}>Sin plantillas</Text>
          <Text style={st.emptyText}>
            Al procesar una foto no reconocida, podés guardarla como plantilla para que
            la app la detecte automáticamente la próxima vez.
          </Text>
        </View>
      ) : (
        <>
          <Text style={st.count}>{templates.length} plantilla{templates.length !== 1 ? 's' : ''} configurada{templates.length !== 1 ? 's' : ''}</Text>
          {templates.map(t => (
            <PlantillaCard key={t.id} template={t} onDelete={() => handleDelete(t)} />
          ))}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.fondo },
  content: { padding: 16, gap: 12 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.celesteLight, borderRadius: 12, padding: 12,
  },
  infoText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Colors.texto, lineHeight: 18 },

  count: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.gris },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 10, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.texto },
  emptyText:  { fontFamily: Fonts.regular, fontSize: 14, color: Colors.gris, textAlign: 'center', lineHeight: 20 },
});
