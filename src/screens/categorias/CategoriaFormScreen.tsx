import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { insertCategoria, updateCategoria } from '../../services/db';
import { AppStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type Props = StackScreenProps<AppStackParamList, 'CategoriaForm'>;

// ── Paletas ───────────────────────────────────────────────────────────────

const COLORES = [
  '#E74C3C', '#E67E22', '#F39C12', '#2ECC71', '#1DB87A',
  '#27AE60', '#3498DB', '#4A90D9', '#1A3C6E', '#9B59B6',
  '#7B3FE4', '#E91E63', '#795548', '#607D8B', '#7A8B9A',
];

const ICONOS = [
  '🍔','🚗','🏠','🏥','🎮','📦','📚','💼','💸','🎁',
  '✈️','⚽','🎵','🍕','☕','🛒','💊','🔧','📱','💡',
  '🏦','💰','🎓','🌿','🐾','🏋️','🎨','🌮','🍜','🚀',
];

// ── Componente ────────────────────────────────────────────────────────────

export function CategoriaFormScreen({ navigation, route }: Props) {
  const { categoriaId, parentId, tipo: tipoParam } = route.params ?? {};
  const { usuario, categorias, refreshCategorias } = useAppStore();

  // ── Estado del formulario ─────────────────────────────────────────────
  const [nombre,  setNombre]  = useState('');
  const [icono,   setIcono]   = useState('📦');
  const [color,   setColor]   = useState<string>(Colors.celeste);
  const [tipo,    setTipo]    = useState<'ingreso' | 'egreso'>(tipoParam ?? 'egreso');
  const [saving,  setSaving]  = useState(false);

  // Buscar categoría padre (si aplica)
  const parent = parentId ? categorias.find(c => c.id === parentId) : null;
  // Nivel de la nueva categoría
  const nivel = parent ? parent.nivel + 1 : 1;
  // Si estamos editando, cargar datos actuales
  const editando = categoriaId
    ? categorias.find(c => c.id === categoriaId)
    : null;

  useEffect(() => {
    if (editando) {
      setNombre(editando.nombre);
      setIcono(editando.icono);
      setColor(editando.color);
      setTipo(editando.tipo);
    }
  }, []);  // only on mount

  // ── Guardar ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!usuario) return;
    const trimmed = nombre.trim();
    if (!trimmed) return Alert.alert('Falta nombre', 'Escribe un nombre para la categoría.');

    setSaving(true);
    try {
      if (editando) {
        await updateCategoria(editando.id, { nombre: trimmed, icono, color });
      } else {
        await insertCategoria({
          usuario_id: usuario.id,
          nombre: trimmed,
          icono,
          color,
          tipo,
          parent_id: parentId ?? null,
          nivel,
          orden: 99,
          activa: 1,
        });
      }
      await refreshCategorias();
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la categoría.');
    } finally {
      setSaving(false);
    }
  }

  const titulo = editando
    ? `Editar: ${editando.nombre}`
    : parent
      ? `Sub de ${parent.icono} ${parent.nombre}`
      : 'Nueva categoría';

  return (
    <ScrollView
      contentContainerStyle={st.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={st.titulo}>{titulo}</Text>

      {/* ── Tipo (solo nivel 1 y modo creación) ── */}
      {!editando && !parent && (
        <View>
          <Text style={st.label}>Tipo</Text>
          <View style={st.tipoRow}>
            {(['egreso', 'ingreso'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  st.tipoBtn,
                  tipo === t && (t === 'egreso' ? st.tipoBtnEgr : st.tipoBtnIng),
                ]}
                onPress={() => setTipo(t)}
                activeOpacity={0.8}
              >
                <Text style={[st.tipoBtnText, tipo === t && { color: Colors.blanco }]}>
                  {t === 'egreso' ? '↓ Egreso' : '↑ Ingreso'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Nombre ───────────────────────────────── */}
      <View>
        <Text style={st.label}>Nombre</Text>
        <TextInput
          style={st.input}
          placeholder="Ej: Alimentación"
          placeholderTextColor={Colors.gris}
          value={nombre}
          onChangeText={setNombre}
          autoFocus={!editando}
          maxLength={40}
        />
      </View>

      {/* ── Ícono ────────────────────────────────── */}
      <View>
        <Text style={st.label}>Ícono</Text>
        <View style={st.grid}>
          {ICONOS.map(e => (
            <TouchableOpacity
              key={e}
              style={[st.emojiCell, icono === e && { backgroundColor: Colors.celesteLight, borderColor: Colors.celeste }]}
              onPress={() => setIcono(e)}
              activeOpacity={0.75}
            >
              <Text style={st.emoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Color ────────────────────────────────── */}
      <View>
        <Text style={st.label}>Color</Text>
        <View style={st.colorRow}>
          {COLORES.map(c => (
            <TouchableOpacity
              key={c}
              style={[st.colorDot, { backgroundColor: c }, color === c && st.colorDotSelected]}
              onPress={() => setColor(c)}
              activeOpacity={0.8}
            >
              {color === c && (
                <Ionicons name="checkmark" size={14} color={Colors.blanco} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Vista previa ─────────────────────────── */}
      <View style={st.preview}>
        <View style={[st.previewIcon, { backgroundColor: color + '20' }]}>
          <Text style={st.previewEmoji}>{icono}</Text>
        </View>
        <Text style={st.previewNombre}>{nombre || 'Nombre de categoría'}</Text>
      </View>

      {/* ── Guardar ──────────────────────────────── */}
      <TouchableOpacity
        style={[st.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color={Colors.blanco} />
          : <Text style={st.saveBtnText}>
              {editando ? 'GUARDAR CAMBIOS' : 'CREAR CATEGORÍA'}
            </Text>
        }
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  content: { padding: 20, gap: 20 },

  titulo: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.texto },

  label: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto, marginBottom: 8 },

  // Tipo
  tipoRow: { flexDirection: 'row', gap: 12 },
  tipoBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.borde,
    alignItems: 'center', backgroundColor: Colors.blanco,
  },
  tipoBtnEgr:  { backgroundColor: Colors.rojo,  borderColor: Colors.rojo  },
  tipoBtnIng:  { backgroundColor: Colors.verde, borderColor: Colors.verde },
  tipoBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.texto },

  // Input
  input: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: Fonts.regular, fontSize: 16, color: Colors.texto,
  },

  // Emoji grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: {
    width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
  },
  emoji: { fontSize: 22 },

  // Color row
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotSelected: { borderWidth: 2.5, borderColor: Colors.blanco, elevation: 4 },

  // Preview
  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.blanco, borderRadius: 14, padding: 16,
  },
  previewIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 26 },
  previewNombre:{ fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.texto, flex: 1 },

  // Save
  saveBtn: {
    backgroundColor: Colors.azul, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.8 },
});
