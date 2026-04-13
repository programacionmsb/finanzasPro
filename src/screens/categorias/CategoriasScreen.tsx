import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { contarMovimientosCategoria, eliminarCategoria } from '../../services/db';
import { AppStackParamList } from '../../types/navigation';
import { Categoria } from '../../types';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

type Nav = StackNavigationProp<AppStackParamList>;

// ── Árbol de categorías ───────────────────────────────────────────────────

function buildTree(cats: Categoria[]): Categoria[] {
  const roots = cats.filter(c => c.parent_id === null);
  const addChildren = (c: Categoria): Categoria => ({
    ...c,
    subcategorias: cats.filter(s => s.parent_id === c.id).map(addChildren),
  });
  return roots.map(addChildren);
}

// ── Nodo de acordeón ──────────────────────────────────────────────────────

function NodoCat({
  cat,
  nivel,
  nav,
  onEliminar,
}: {
  cat: Categoria;
  nivel: number;
  nav: Nav;
  onEliminar: (cat: Categoria) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tieneHijos = (cat.subcategorias?.length ?? 0) > 0;

  return (
    <View>
      <View style={[st.nodo, { paddingLeft: 14 + nivel * 18 }]}>
        <Text style={st.nodoIcono}>{cat.icono}</Text>
        <TouchableOpacity
          style={st.nodoNombreRow}
          onPress={() => tieneHijos && setExpanded(e => !e)}
          activeOpacity={tieneHijos ? 0.7 : 1}
        >
          <Text style={st.nodoNombre} numberOfLines={1}>{cat.nombre}</Text>
          {tieneHijos && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.gris}
            />
          )}
        </TouchableOpacity>

        {/* Agregar subcategoría */}
        <TouchableOpacity
          style={st.editBtn}
          onPress={() => nav.navigate('CategoriaForm', { parentId: cat.id, tipo: cat.tipo })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add-circle-outline" size={18} color={Colors.verde} />
        </TouchableOpacity>
        {/* Editar */}
        <TouchableOpacity
          style={st.editBtn}
          onPress={() => nav.navigate('CategoriaForm', { categoriaId: cat.id })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="pencil-outline" size={16} color={Colors.celeste} />
        </TouchableOpacity>
        {/* Eliminar */}
        <TouchableOpacity
          style={st.editBtn}
          onPress={() => onEliminar(cat)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.rojo} />
        </TouchableOpacity>
      </View>

      {tieneHijos && expanded && (
        <View style={[st.children, { borderLeftColor: cat.color + '55' }]}>
          {cat.subcategorias!.map(sub => (
            <NodoCat key={sub.id} cat={sub} nivel={nivel + 1} nav={nav} onEliminar={onEliminar} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────

export function CategoriasScreen() {
  const nav = useNavigation<Nav>();
  const { categorias, refreshCategorias } = useAppStore();
  const [tabActivo, setTabActivo] = useState<'egreso' | 'ingreso'>('egreso');

  useFocusEffect(useCallback(() => { refreshCategorias(); }, []));

  const arbol = useMemo(
    () => buildTree(categorias.filter(c => c.tipo === tabActivo)),
    [categorias, tabActivo]
  );

  async function handleEliminar(cat: Categoria) {
    const movsPropios = await contarMovimientosCategoria(cat.id);
    let movsHijos = 0;
    for (const sub of cat.subcategorias ?? []) {
      movsHijos += await contarMovimientosCategoria(sub.id);
    }
    const totalMovs = movsPropios + movsHijos;

    if (totalMovs > 0) {
      Alert.alert(
        'No se puede eliminar',
        `"${cat.nombre}" tiene ${totalMovs} movimiento(s) asociado(s). Reasigna o elimina esos movimientos primero.`
      );
      return;
    }

    Alert.alert('Eliminar categoría', `¿Eliminar "${cat.nombre}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await eliminarCategoria(cat.id);
          await refreshCategorias();
        },
      },
    ]);
  }

  return (
    <View style={st.safe}>
      {/* ── Tabs ──────────────────────────────────── */}
      <View style={st.tabBar}>
        {(['egreso', 'ingreso'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[st.tab, tabActivo === t && st.tabActive]}
            onPress={() => setTabActivo(t)}
            activeOpacity={0.75}
          >
            <Text style={[st.tabText, tabActivo === t && st.tabTextActive]}>
              {t === 'egreso' ? '↓ Egresos' : '↑ Ingresos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Lista de categorías ───────────────────── */}
      <ScrollView
        contentContainerStyle={st.list}
        showsVerticalScrollIndicator={false}
      >
        {arbol.length === 0 ? (
          <View style={st.emptyCenter}>
            <Text style={st.emptyEmoji}>🗂️</Text>
            <Text style={st.emptyText}>No hay categorías de {tabActivo}</Text>
          </View>
        ) : (
          arbol.map(cat => (
            <View key={cat.id} style={st.rootCard}>
              <NodoCat cat={cat} nivel={0} nav={nav} onEliminar={handleEliminar} />
            </View>
          ))
        )}

        {/* Botón nueva categoría raíz */}
        <TouchableOpacity
          style={st.newCatBtn}
          onPress={() => nav.navigate('CategoriaForm', { tipo: tabActivo })}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={20} color={Colors.celeste} />
          <Text style={st.newCatText}>Nueva categoría de {tabActivo}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.fondo },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.blanco,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borde,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: Colors.celeste },
  tabText:       { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.gris },
  tabTextActive: { color: Colors.celeste },

  // Lista
  list: { padding: 16, gap: 12 },

  // Tarjeta raíz
  rootCard: {
    backgroundColor: Colors.blanco, borderRadius: 14, overflow: 'hidden',
  },

  // Nodo
  nodo: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingRight: 14, gap: 10,
  },
  nodoIcono:    { fontSize: 18, width: 24, textAlign: 'center' },
  nodoNombreRow:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  nodoNombre:   { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: Colors.texto },
  editBtn:      { padding: 4 },
  children:     { borderLeftWidth: 2, marginLeft: 32 },

  // Nueva categoría
  newCatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.celeste, borderStyle: 'dashed',
    backgroundColor: Colors.celesteLight,
  },
  newCatText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.celeste },

  // Empty
  emptyCenter: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyEmoji:  { fontSize: 48 },
  emptyText:   { fontFamily: Fonts.regular, fontSize: 14, color: Colors.gris },
});
