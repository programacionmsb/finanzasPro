import { useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, FlatList, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useHistorial } from '../../hooks/useHistorial';
import { buildCategoriPath } from '../../components/forms/CategoriaSelector';
import { formatMonto } from '../../utils/formatters';
import { Movimiento } from '../../types';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

// ── Configuración de origen ───────────────────────────────────────────────

const ORIGEN_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  yape:      { icon: 'radio-button-on',     color: '#7B3FE4' },
  plin:      { icon: 'radio-button-on',     color: '#00AEEF' },
  bcp:       { icon: 'card-outline',        color: Colors.bcp },
  interbank: { icon: 'card-outline',        color: Colors.interbank },
  bbva:      { icon: 'card-outline',        color: Colors.bbva },
  foto:      { icon: 'camera-outline',      color: Colors.celeste },
  compartir: { icon: 'share-social-outline',color: Colors.morado },
  manual:    { icon: 'create-outline',      color: Colors.gris },
};

// ── Item individual ───────────────────────────────────────────────────────

function MovimientoItem({
  mov,
  categorias,
  onDelete,
}: {
  mov: Movimiento;
  categorias: ReturnType<typeof useHistorial>['categorias'];
  onDelete: (id: number) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const cfg = ORIGEN_CONFIG[mov.origen] ?? ORIGEN_CONFIG.manual;
  const catPath = mov.categoria_id
    ? buildCategoriPath(mov.categoria_id, categorias)
    : null;

  function handleDelete() {
    swipeRef.current?.close();
    onDelete(mov.id);
  }

  function renderRightActions() {
    return (
      <TouchableOpacity style={st.deleteAction} onPress={handleDelete} activeOpacity={0.85}>
        <Ionicons name="trash-outline" size={22} color={Colors.blanco} />
        <Text style={st.deleteActionText}>Borrar</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <View style={st.itemCard}>
        {/* Ícono de origen */}
        <View style={[st.origenCircle, { backgroundColor: cfg.color + '20' }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>

        {/* Detalle */}
        <View style={st.itemBody}>
          <Text style={st.itemTitulo} numberOfLines={1}>
            {mov.descripcion
              ?? (mov.origen.charAt(0).toUpperCase() + mov.origen.slice(1))}
          </Text>
          {catPath ? (
            <Text style={st.itemCat} numberOfLines={1}>{catPath}</Text>
          ) : null}
          <Text style={st.itemCuenta} numberOfLines={1}>
            {mov.cuenta_nombre ?? '—'}
          </Text>
        </View>

        {/* Monto */}
        <View style={st.itemMontoCol}>
          <Text
            style={[
              st.itemMonto,
              mov.tipo === 'ingreso' ? st.montoIngreso : st.montoEgreso,
            ]}
          >
            {mov.tipo === 'ingreso' ? '+' : '−'}{' '}
            {formatMonto(mov.monto)}
          </Text>
          <Text style={st.itemTipo}>
            {mov.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────

export function HistorialScreen() {
  const {
    busqueda, setBusqueda,
    filtro,   setFiltro,
    agrupados, movimientos,
    loading, loadingMore, noHayMas,
    cargarMas, confirmarEliminar,
    cuentas, categorias,
  } = useHistorial();

  // ── Chips de filtro ──────────────────────────────────────────────────
  const chips: { key: string; label: string }[] = [
    { key: 'todo',    label: 'Todo' },
    { key: 'ingreso', label: '↑ Ingresos' },
    { key: 'egreso',  label: '↓ Egresos' },
    ...cuentas.map(c => ({ key: String(c.id), label: c.nombre })),
  ];

  // ── Lista aplanada con separadores de fecha ──────────────────────────
  type ListItem =
    | { kind: 'header'; fecha: string }
    | { kind: 'mov'; mov: Movimiento };

  const listData: ListItem[] = [];
  for (const [fecha, items] of agrupados) {
    listData.push({ kind: 'header', fecha });
    for (const m of items) {
      listData.push({ kind: 'mov', mov: m });
    }
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.kind === 'header') {
      return (
        <View style={st.fechaHeader}>
          <Text style={st.fechaHeaderText}>{item.fecha}</Text>
        </View>
      );
    }
    return (
      <MovimientoItem
        mov={item.mov}
        categorias={categorias}
        onDelete={confirmarEliminar}
      />
    );
  }

  function renderFooter() {
    if (loadingMore) {
      return (
        <View style={st.loadMoreRow}>
          <ActivityIndicator color={Colors.celeste} />
        </View>
      );
    }
    if (!noHayMas && movimientos.length > 0) {
      return (
        <TouchableOpacity style={st.loadMoreBtn} onPress={cargarMas} activeOpacity={0.8}>
          <Text style={st.loadMoreText}>Cargar más</Text>
        </TouchableOpacity>
      );
    }
    return <View style={{ height: 24 }} />;
  }

  return (
    <View style={st.safe}>
      {/* ── Buscador ────────────────────────────────────── */}
      <View style={st.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.gris} style={st.searchIcon} />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar movimientos..."
          placeholderTextColor={Colors.gris}
          value={busqueda}
          onChangeText={setBusqueda}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Chips de filtro ────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.chipsRow}
        style={st.chipsScroll}
      >
        {chips.map(chip => {
          const active = filtro === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[st.chip, active && st.chipActive]}
              onPress={() => setFiltro(chip.key)}
              activeOpacity={0.75}
            >
              <Text style={[st.chipText, active && st.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Lista ──────────────────────────────────────── */}
      {loading ? (
        <View style={st.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.celeste} />
        </View>
      ) : listData.length === 0 ? (
        <View style={st.emptyCenter}>
          <Text style={st.emptyEmoji}>📭</Text>
          <Text style={st.emptyTitle}>Sin movimientos</Text>
          <Text style={st.emptySub}>
            {busqueda
              ? 'No se encontraron resultados para tu búsqueda.'
              : 'Registra tu primer movimiento desde el botón +'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) =>
            item.kind === 'header' ? `h-${item.fecha}` : `m-${item.mov.id}-${i}`
          }
          renderItem={renderItem}
          ListFooterComponent={renderFooter}
          contentContainerStyle={st.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.fondo },

  // Buscador
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.blanco, margin: 16, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.borde,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: {
    flex: 1, fontFamily: Fonts.regular, fontSize: 15,
    color: Colors.texto, padding: 0,
  },

  // Chips
  chipsScroll: { maxHeight: 44 },
  chipsRow:    { paddingHorizontal: 16, gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
  },
  chipActive:    { backgroundColor: Colors.azul, borderColor: Colors.azul },
  chipText:      { fontFamily: Fonts.medium, fontSize: 13, color: Colors.gris },
  chipTextActive:{ color: Colors.blanco },

  // Lista
  listContent:    { paddingHorizontal: 16, paddingTop: 12 },

  // Fecha header
  fechaHeader:     { paddingVertical: 8 },
  fechaHeaderText: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.gris, letterSpacing: 0.5 },

  // Item movimiento
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.blanco, borderRadius: 14, padding: 14,
    marginBottom: 8,
  },
  origenCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemBody:     { flex: 1 },
  itemTitulo:   { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.texto },
  itemCat:      { fontFamily: Fonts.regular, fontSize: 12, color: Colors.gris, marginTop: 1 },
  itemCuenta:   { fontFamily: Fonts.regular, fontSize: 11, color: Colors.borde, marginTop: 1 },
  itemMontoCol: { alignItems: 'flex-end' },
  itemMonto:    { fontFamily: Fonts.bold, fontSize: 15 },
  montoIngreso: { color: Colors.verde },
  montoEgreso:  { color: Colors.rojo },
  itemTipo:     { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris, marginTop: 2 },

  // Swipe delete
  deleteAction: {
    backgroundColor: Colors.rojo, borderRadius: 14, marginBottom: 8,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20, gap: 4,
  },
  deleteActionText: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.blanco },

  // Load more
  loadMoreRow: { paddingVertical: 20, alignItems: 'center' },
  loadMoreBtn: {
    alignSelf: 'center', marginVertical: 16,
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.borde,
    backgroundColor: Colors.blanco,
  },
  loadMoreText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.gris },

  // Empty / loading
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCenter:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyEmoji:    { fontSize: 56 },
  emptyTitle:    { fontFamily: Fonts.bold, fontSize: 20, color: Colors.texto },
  emptySub:      { fontFamily: Fonts.regular, fontSize: 14, color: Colors.gris, textAlign: 'center', lineHeight: 20 },
});
