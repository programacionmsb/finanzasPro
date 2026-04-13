import { useRef, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, FlatList, StyleSheet, ActivityIndicator, Alert, Modal, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useHistorial } from '../../hooks/useHistorial';
import { buildCategoriPath, CategoriaSelector } from '../../components/forms/CategoriaSelector';
import { CuentaSelector } from '../../components/forms/CuentaSelector';
import { formatMonto, parseFechaLocal } from '../../utils/formatters';
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
  onEdit,
}: {
  mov: Movimiento;
  categorias: ReturnType<typeof useHistorial>['categorias'];
  onDelete: (id: number) => void;
  onEdit: (mov: Movimiento) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const cfg = ORIGEN_CONFIG[mov.origen] ?? ORIGEN_CONFIG.manual;
  const catPath = mov.categoria_id
    ? buildCategoriPath(mov.categoria_id, categorias)
    : null;
  // Extrae HH:MM de "YYYY-MM-DD HH:MM:SS"
  const hora = mov.fecha?.length > 10 ? mov.fecha.substring(11, 16) : '';

  function handleDelete() {
    swipeRef.current?.close();
    onDelete(mov.id);
  }

  function handleEdit() {
    swipeRef.current?.close();
    onEdit(mov);
  }

  function renderRightActions() {
    return (
      <View style={st.swipeActions}>
        <TouchableOpacity style={st.editAction} onPress={handleEdit} activeOpacity={0.85}>
          <Ionicons name="pencil-outline" size={22} color={Colors.blanco} />
          <Text style={st.swipeActionText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.deleteAction} onPress={handleDelete} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={22} color={Colors.blanco} />
          <Text style={st.swipeActionText}>Borrar</Text>
        </TouchableOpacity>
      </View>
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
          {mov.numero_operacion && mov.numero_operacion !== '0' ? (
            <Text style={st.itemNroOp} numberOfLines={1}>Op. {mov.numero_operacion}</Text>
          ) : null}
        </View>

        {/* Monto */}
        <View style={st.itemMontoCol}>
          <Text
            style={[
              st.itemMonto,
              mov.tipo === 'ingreso'      ? st.montoIngreso :
              mov.tipo === 'transferencia'? st.montoTransfer :
                                           st.montoEgreso,
            ]}
          >
            {mov.tipo === 'ingreso' ? '+' : mov.tipo === 'transferencia' ? '⇄' : '−'}{' '}
            {formatMonto(mov.monto)}
          </Text>
          <Text style={st.itemTipo}>
            {mov.tipo === 'ingreso' ? '↑ Ingreso' :
             mov.tipo === 'transferencia' ? '⇄ Transferencia' :
             '↓ Egreso'}
          </Text>
          {hora ? <Text style={st.itemHora}>{hora}</Text> : null}
        </View>
      </View>
    </Swipeable>
  );
}

// ── Modal de edición ──────────────────────────────────────────────────────

const ORIGENES_EDIT = [
  { key: 'manual'    as const, label: 'Manual',    color: Colors.gris      },
  { key: 'yape'      as const, label: 'Yape',      color: '#7B3FE4'        },
  { key: 'plin'      as const, label: 'Plin',      color: '#00AEEF'        },
  { key: 'bcp'       as const, label: 'BCP',       color: Colors.bcp       },
  { key: 'interbank' as const, label: 'Interbank', color: Colors.interbank },
  { key: 'bbva'      as const, label: 'BBVA',      color: Colors.bbva      },
  { key: 'foto'      as const, label: 'Foto',      color: Colors.celeste   },
];

interface EditForm {
  tipo:             'ingreso' | 'egreso' | 'transferencia';
  monto:            string;
  descripcion:      string;
  cuentaId:         number | null;
  cuentaDestinoId:  number | null;
  categoriaId:      number | null;
  fecha:            Date;
  origen:           Movimiento['origen'];
  numeroOperacion:  string;
}

function EditModal({
  mov,
  cuentas,
  categorias,
  onSave,
  onClose,
}: {
  mov: Movimiento;
  cuentas: ReturnType<typeof useHistorial>['cuentas'];
  categorias: ReturnType<typeof useHistorial>['categorias'];
  onSave: (id: number, form: EditForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    tipo:            mov.tipo as 'ingreso' | 'egreso' | 'transferencia',
    monto:           String(mov.monto),
    descripcion:     mov.descripcion ?? '',
    cuentaId:        mov.cuenta_origen_id,
    cuentaDestinoId: mov.cuenta_destino_id ?? null,
    categoriaId:     mov.categoria_id ?? null,
    fecha:           parseFechaLocal(mov.fecha),
    origen:          mov.origen ?? 'manual',
    numeroOperacion: mov.numero_operacion && mov.numero_operacion !== '0' ? mov.numero_operacion : '',
  });
  const [saving, setSaving] = useState(false);
  const [catReset, setCatReset] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const categoriasFiltradas = useMemo(
    () => categorias.filter(c => c.tipo === form.tipo),
    [form.tipo, categorias]
  );

  function setTipo(tipo: 'ingreso' | 'egreso' | 'transferencia') {
    setForm(f => ({
      ...f,
      tipo,
      categoriaId: f.tipo !== tipo ? null : f.categoriaId,
    }));
    setCatReset(true);
  }

  async function handleSave() {
    const monto = parseFloat(form.monto.replace(',', '.'));
    if (!form.monto || isNaN(monto) || monto <= 0) {
      return Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
    }
    if (!form.cuentaId) {
      return Alert.alert('Falta cuenta', 'Selecciona una cuenta.');
    }
    setSaving(true);
    try {
      await onSave(mov.id, { ...form, monto: form.monto });
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={st.modalSheet}>
        <View style={st.modalHandle} />
        <Text style={st.modalTitle}>Editar movimiento</Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Tipo */}
          <Text style={st.fieldLabel}>Tipo</Text>
          <View style={st.tipoRow}>
            {([
              { key: 'ingreso',       label: 'Ingreso',      icon: 'arrow-up-circle',   active: st.tipoBtnIng      },
              { key: 'egreso',        label: 'Egreso',       icon: 'arrow-down-circle', active: st.tipoBtnEgr      },
              { key: 'transferencia', label: 'Transferir',   icon: 'swap-horizontal',   active: st.tipoBtnTransfer },
            ] as const).map(t => (
              <TouchableOpacity
                key={t.key}
                style={[st.tipoBtn, form.tipo === t.key && t.active]}
                onPress={() => setTipo(t.key)}
              >
                <Ionicons name={t.icon} size={16} color={form.tipo === t.key ? Colors.blanco : Colors.gris} />
                <Text style={[st.tipoBtnText, form.tipo === t.key && { color: Colors.blanco }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Monto */}
          <Text style={st.fieldLabel}>Monto</Text>
          <TextInput
            style={st.fieldInput}
            value={form.monto}
            onChangeText={v => setForm(f => ({ ...f, monto: v }))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.gris}
          />

          {/* Fecha y hora */}
          <Text style={st.fieldLabel}>Fecha y hora</Text>
          <View style={st.fechaRow}>
            <TouchableOpacity style={st.fechaBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.75}>
              <Ionicons name="calendar-outline" size={16} color={Colors.celeste} />
              <Text style={st.fechaBtnText}>
                {form.fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.fechaBtn} onPress={() => setShowTimePicker(true)} activeOpacity={0.75}>
              <Ionicons name="time-outline" size={16} color={Colors.celeste} />
              <Text style={st.fechaBtnText}>
                {String(form.fecha.getHours()).padStart(2, '0')}:{String(form.fecha.getMinutes()).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker value={form.fecha} mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'} maximumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setForm(f => { const n = new Date(date); n.setHours(f.fecha.getHours(), f.fecha.getMinutes(), 0); return { ...f, fecha: n }; });
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker value={form.fecha} mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'} is24Hour
              onChange={(_, date) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (date) setForm(f => { const n = new Date(f.fecha); n.setHours(date.getHours(), date.getMinutes(), 0); return { ...f, fecha: n }; });
              }}
            />
          )}

          {/* Cuenta */}
          <CuentaSelector
            cuentas={cuentas}
            value={form.cuentaId}
            onChange={id => setForm(f => ({ ...f, cuentaId: id }))}
            label={form.tipo === 'transferencia' ? 'Cuenta origen' : 'Cuenta'}
          />

          {/* Cuenta destino — solo transferencia */}
          {form.tipo === 'transferencia' && (
            <CuentaSelector
              cuentas={cuentas.filter(c => c.id !== form.cuentaId)}
              value={form.cuentaDestinoId}
              onChange={id => setForm(f => ({ ...f, cuentaDestinoId: id }))}
              label="Cuenta destino"
            />
          )}

          {/* Categoría */}
          <CategoriaSelector
            categorias={categoriasFiltradas}
            tipo={form.tipo === 'transferencia' ? 'egreso' : form.tipo}
            value={form.categoriaId}
            onChange={id => { setCatReset(false); setForm(f => ({ ...f, categoriaId: id })); }}
            advertencia={catReset}
          />

          {/* Nro. Operación */}
          <Text style={st.fieldLabel}>Nro. Operación</Text>
          <TextInput
            style={st.fieldInput}
            value={form.numeroOperacion}
            onChangeText={v => setForm(f => ({ ...f, numeroOperacion: v }))}
            placeholder="Número de operación o referencia"
            placeholderTextColor={Colors.gris}
          />

          {/* Notas */}
          <Text style={st.fieldLabel}>Notas</Text>
          <TextInput
            style={[st.fieldInput, { minHeight: 72, textAlignVertical: 'top' }]}
            value={form.descripcion}
            onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
            placeholder="Opcional..."
            placeholderTextColor={Colors.gris}
            multiline
            numberOfLines={3}
          />

          {/* Guardar */}
          <TouchableOpacity
            style={[st.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.blanco} />
              : <Text style={st.saveBtnText}>GUARDAR CAMBIOS</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────

export function HistorialScreen() {
  const {
    busqueda, setBusqueda,
    filtro,   setFiltro,
    agrupados, movimientos,
    loading, loadingMore, noHayMas,
    cargarMas, confirmarEliminar, actualizarMovimiento,
    cuentas, categorias,
  } = useHistorial();

  const [editandoMov, setEditandoMov] = useState<Movimiento | null>(null);

  async function handleGuardarEdicion(id: number, form: EditForm) {
    const monto = parseFloat(form.monto.replace(',', '.'));
    const pad = (n: number) => String(n).padStart(2, '0');
    const f = form.fecha;
    const fecha = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())} ${pad(f.getHours())}:${pad(f.getMinutes())}:00`;
    await actualizarMovimiento(id, {
      tipo:              form.tipo,
      monto,
      descripcion:       form.descripcion || null,
      cuenta_origen_id:  form.cuentaId!,
      cuenta_destino_id: form.cuentaDestinoId ?? null,
      categoria_id:      form.categoriaId,
      fecha,
      origen:            form.origen,
      numero_operacion:  form.numeroOperacion || '0',
    });
  }

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
        onEdit={setEditandoMov}
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
      {/* ── Modal edición ──────────────────────────────── */}
      {editandoMov && (
        <EditModal
          mov={editandoMov}
          cuentas={cuentas}
          categorias={categorias}
          onSave={handleGuardarEdicion}
          onClose={() => setEditandoMov(null)}
        />
      )}

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
  listContent:    { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },

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
  itemNroOp:    { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris, marginTop: 1 },
  itemMontoCol: { alignItems: 'flex-end' },
  itemMonto:    { fontFamily: Fonts.bold, fontSize: 15 },
  montoIngreso:  { color: Colors.verde },
  montoEgreso:   { color: Colors.rojo },
  montoTransfer: { color: '#7B3FE4' },
  itemTipo:     { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris, marginTop: 2 },
  itemHora:     { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris, marginTop: 1 },

  // Swipe actions — width explícito para que sean visibles
  swipeActions: { flexDirection: 'row', alignSelf: 'stretch', marginBottom: 8 },
  editAction: {
    width: 80,
    backgroundColor: Colors.celeste,
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  deleteAction: {
    width: 80,
    backgroundColor: Colors.rojo,
    borderTopRightRadius: 14, borderBottomRightRadius: 14,
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  swipeActionText: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.blanco },

  // Edit modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, gap: 12,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: Colors.borde, marginBottom: 8,
  },
  modalTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.texto },
  tipoRow: { flexDirection: 'row', gap: 12 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.borde, backgroundColor: Colors.blanco,
  },
  tipoBtnIng:     { backgroundColor: Colors.verde,  borderColor: Colors.verde  },
  tipoBtnEgr:     { backgroundColor: Colors.rojo,   borderColor: Colors.rojo   },
  tipoBtnTransfer:{ backgroundColor: Colors.morado, borderColor: Colors.morado },
  tipoBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.texto },

  // Origen chips
  origenRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  origenChip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.borde, backgroundColor: Colors.blanco },
  origenChipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto },
  fieldLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto },
  fechaRow:   { flexDirection: 'row', gap: 10 },
  fechaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11,
  },
  fechaBtnText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.texto },
  fieldInput: {
    backgroundColor: Colors.blanco, borderWidth: 1.5, borderColor: Colors.borde,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.texto,
  },
  saveBtn: {
    backgroundColor: Colors.azul, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.blanco, letterSpacing: 0.8 },

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
