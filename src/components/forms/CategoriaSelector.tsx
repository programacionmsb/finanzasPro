import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { Categoria } from '../../types';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

// ── Árbol de categorías ──────────────────────────────────────────────────

function buildTree(cats: Categoria[]): Categoria[] {
  const roots = cats.filter(c => c.parent_id === null);
  const addChildren = (c: Categoria): Categoria => ({
    ...c,
    subcategorias: cats
      .filter(s => s.parent_id === c.id)
      .map(addChildren),
  });
  return roots.map(addChildren);
}

/** Construye el path completo de una categoría: "🍔 Alimentación › 🍽️ Restaurantes › Almuerzo" */
export function buildCategoriPath(categoriaId: number, allCats: Categoria[]): string {
  const cat = allCats.find(c => c.id === categoriaId);
  if (!cat) return '';
  const parts: string[] = [`${cat.icono} ${cat.nombre}`];
  let current = cat;
  while (current.parent_id !== null) {
    const parent = allCats.find(c => c.id === current.parent_id);
    if (!parent) break;
    parts.unshift(`${parent.icono} ${parent.nombre}`);
    current = parent;
  }
  return parts.join(' › ');
}

// ── Nodo del acordeón ────────────────────────────────────────────────────

function NodoCat({
  cat,
  nivel,
  selected,
  onSelect,
}: {
  cat: Categoria;
  nivel: number;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tieneHijos = (cat.subcategorias?.length ?? 0) > 0;
  const esSeleccionado = selected === cat.id;

  function handlePress() {
    if (tieneHijos) {
      setExpanded(e => !e);
    } else {
      onSelect(cat.id);
    }
  }

  return (
    <View>
      <TouchableOpacity
        style={[
          st.nodo,
          { paddingLeft: 16 + nivel * 16 },
          esSeleccionado && st.nodoSelected,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={st.nodoIcon}>{cat.icono}</Text>
        <Text style={[st.nodoNombre, esSeleccionado && { color: Colors.celeste }]} numberOfLines={1}>
          {cat.nombre}
        </Text>
        {tieneHijos ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.gris}
          />
        ) : esSeleccionado ? (
          <Ionicons name="checkmark-circle" size={18} color={Colors.celeste} />
        ) : (
          <View style={st.dot} />
        )}
      </TouchableOpacity>

      {tieneHijos && expanded && (
        <View style={[st.children, { borderLeftColor: cat.color + '55' }]}>
          {cat.subcategorias?.map(sub => (
            <NodoCat
              key={sub.id}
              cat={sub}
              nivel={nivel + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Selector público ──────────────────────────────────────────────────────

interface CategoriaSelectorProps {
  categorias:  Categoria[];
  tipo:        'ingreso' | 'egreso' | null;
  value:       number | null;
  onChange:    (id: number) => void;
  advertencia?: boolean;   // mostrar aviso de categoría reiniciada
  label?:      string;
}

export function CategoriaSelector({
  categorias, tipo, value, onChange, advertencia, label = 'Categoría',
}: CategoriaSelectorProps) {
  const [open, setOpen] = useState(false);

  const filtradas = useMemo(
    () => (tipo ? categorias.filter(c => c.tipo === tipo) : []),
    [tipo, categorias]
  );

  const arbol = useMemo(() => buildTree(filtradas), [filtradas]);

  const path = useMemo(
    () => (value ? buildCategoriPath(value, categorias) : ''),
    [value, categorias]
  );

  function handleSelect(id: number) {
    onChange(id);
    setOpen(false);
  }

  return (
    <View style={st.container}>
      <Text style={st.label}>{label}</Text>

      {advertencia && (
        <View style={st.advertencia}>
          <Ionicons name="warning-outline" size={14} color={Colors.amarillo} />
          <Text style={st.advertenciaText}>
            Categoría reiniciada — selecciona una nueva
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[st.trigger, !tipo && st.triggerDisabled]}
        onPress={() => tipo && setOpen(true)}
        activeOpacity={tipo ? 0.75 : 1}
      >
        {!tipo ? (
          <Text style={st.triggerPlaceholder}>
            ⚠️ Selecciona primero ↑ Ingreso o ↓ Egreso
          </Text>
        ) : path ? (
          <Text style={st.triggerValue} numberOfLines={1}>{path}</Text>
        ) : (
          <Text style={st.triggerPlaceholder}>Selecciona una categoría</Text>
        )}
        {tipo && <Ionicons name="chevron-down" size={18} color={Colors.gris} />}
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight={520}>
        <ScrollView contentContainerStyle={st.sheetContent} showsVerticalScrollIndicator={false}>
          <Text style={st.sheetTitle}>
            {tipo === 'ingreso' ? '↑ Categorías de ingreso' : '↓ Categorías de egreso'}
          </Text>

          {arbol.length === 0 ? (
            <Text style={st.emptyText}>No hay categorías disponibles</Text>
          ) : (
            arbol.map(cat => (
              <NodoCat
                key={cat.id}
                cat={cat}
                nivel={0}
                selected={value}
                onSelect={handleSelect}
              />
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { gap: 6 },
  label:     { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto },
  advertencia: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8E7', borderRadius: 8, padding: 8,
  },
  advertenciaText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.amarillo, flex: 1 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  triggerDisabled:     { backgroundColor: Colors.fondo },
  triggerValue:        { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: Colors.texto },
  triggerPlaceholder:  { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: Colors.gris },
  sheetContent:        { paddingHorizontal: 12, paddingBottom: 20 },
  sheetTitle:          { fontFamily: Fonts.bold, fontSize: 16, color: Colors.texto, textAlign: 'center', paddingVertical: 12 },
  emptyText:           { fontFamily: Fonts.regular, fontSize: 14, color: Colors.gris, textAlign: 'center', marginTop: 20 },
  // Nodo acordeón
  nodo: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingRight: 16, gap: 10,
  },
  nodoSelected: { backgroundColor: Colors.celesteLight, borderRadius: 10 },
  nodoIcon:     { fontSize: 18, width: 24, textAlign: 'center' },
  nodoNombre:   { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: Colors.texto },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.borde },
  children:     { borderLeftWidth: 2, marginLeft: 28 },
});
