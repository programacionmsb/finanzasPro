import { useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReportes, Periodo } from '../../hooks/useReportes';
import { exportarPDF, exportarExcel } from '../../services/export';
import { formatMonto } from '../../utils/formatters';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/Fonts';

// ── Gráfica de barras personalizada ──────────────────────────────────────

function BarChart({ buckets }: { buckets: Array<{ label: string; ingresos: number; egresos: number }> }) {
  const maxVal = Math.max(1, ...buckets.map(b => Math.max(b.ingresos, b.egresos)));
  const H = 90;

  return (
    <View style={bc.container}>
      {buckets.map((b, i) => (
        <View key={i} style={bc.col}>
          <View style={bc.barsRow}>
            <View style={[bc.bar, bc.barIng, { height: (b.ingresos / maxVal) * H }]} />
            <View style={[bc.bar, bc.barEgr, { height: (b.egresos  / maxVal) * H }]} />
          </View>
          <Text style={bc.label} numberOfLines={1}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

const bc = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    height: 110, paddingBottom: 20,
  },
  col:      { flex: 1, alignItems: 'center', gap: 3 },
  barsRow:  { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  bar:      { width: 9, borderRadius: 4, minHeight: 3 },
  barIng:   { backgroundColor: Colors.verde },
  barEgr:   { backgroundColor: Colors.rojo  },
  label:    { fontFamily: Fonts.regular, fontSize: 10, color: Colors.gris },
});

// ── Lista categorías con porcentaje ───────────────────────────────────────

function DonutSimple({
  data,
}: {
  data: Array<{ label: string; color: string; valor: number; porcentaje: number }>;
}) {
  return (
    <View style={ds.container}>
      {data.slice(0, 6).map((d, i) => (
        <View key={i} style={ds.row}>
          <View style={[ds.dot, { backgroundColor: d.color }]} />
          <Text style={ds.label} numberOfLines={1}>{d.label}</Text>
          <Text style={ds.pct}>{d.porcentaje.toFixed(0)}%</Text>
          <Text style={ds.val}>{formatMonto(d.valor)}</Text>
        </View>
      ))}
    </View>
  );
}

const ds = StyleSheet.create({
  container: { gap: 10 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:       { width: 12, height: 12, borderRadius: 6 },
  label:     { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto },
  pct:       { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.gris, width: 36, textAlign: 'right' },
  val:       { fontFamily: Fonts.mono, fontSize: 13, color: Colors.texto, width: 88, textAlign: 'right' },
});

// ── Barra de progreso ─────────────────────────────────────────────────────

function ProgresoItem({
  label,
  valor,
  total,
  color,
}: {
  label: string;
  valor: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.min(1, valor / total) : 0;
  return (
    <View style={pi.row}>
      <Text style={pi.label} numberOfLines={1}>{label}</Text>
      <View style={pi.barBg}>
        <View style={[pi.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={pi.val}>{formatMonto(valor)}</Text>
    </View>
  );
}

const pi = StyleSheet.create({
  row:    { gap: 6 },
  label:  { fontFamily: Fonts.medium, fontSize: 13, color: Colors.texto },
  barBg:  { height: 8, backgroundColor: Colors.borde, borderRadius: 4, overflow: 'hidden' },
  barFill:{ height: '100%', borderRadius: 4 },
  val:    { fontFamily: Fonts.mono, fontSize: 12, color: Colors.gris, textAlign: 'right' },
});

// ── Pantalla principal ─────────────────────────────────────────────────────

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes',    label: 'Mes'    },
  { key: 'año',    label: 'Año'    },
];

export function ReportesScreen() {
  const {
    periodo, setPeriodo,
    desde, hasta,
    loading,
    resumen,
    gastosCat,
    estadCuentas,
    barBuckets,
    movimientos,
    cuentas,
    usuario,
  } = useReportes();

  const totalGastos = gastosCat.reduce((s, g) => s + g.total, 0);

  const donutData = useMemo(
    () =>
      gastosCat.map(g => ({
        label:      `${g.icono} ${g.categoria_nombre}`,
        color:      g.color,
        valor:      g.total,
        porcentaje: totalGastos > 0 ? (g.total / totalGastos) * 100 : 0,
      })),
    [gastosCat, totalGastos]
  );

  async function handleExportPDF() {
    if (!usuario) return;
    try {
      await exportarPDF({ usuario, movimientos, resumen, gastosCat, desde, hasta });
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    }
  }

  async function handleExportExcel() {
    if (!usuario) return;
    try {
      await exportarExcel({ usuario, movimientos, resumen, gastosCat, desde, hasta });
    } catch {
      Alert.alert('Error', 'No se pudo generar el Excel.');
    }
  }

  return (
    <View style={st.safe}>
      {/* ── Selector de período ───────────────── */}
      <View style={st.periodoRow}>
        {PERIODOS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[st.periodoChip, periodo === p.key && st.periodoChipActive]}
            onPress={() => setPeriodo(p.key)}
            activeOpacity={0.8}
          >
            <Text style={[st.periodoText, periodo === p.key && st.periodoTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.celeste} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Resumen ──────────────────────────── */}
          <View style={st.resumenRow}>
            <View style={[st.resCard, { backgroundColor: Colors.verdeLight }]}>
              <Text style={st.resCardLabel}>↑ Ingresos</Text>
              <Text style={[st.resCardVal, { color: Colors.verde }]}>
                {formatMonto(resumen.ingresos)}
              </Text>
            </View>
            <View style={[st.resCard, { backgroundColor: Colors.rojoLight }]}>
              <Text style={st.resCardLabel}>↓ Egresos</Text>
              <Text style={[st.resCardVal, { color: Colors.rojo }]}>
                {formatMonto(resumen.egresos)}
              </Text>
            </View>
            <View style={[st.resCard, { backgroundColor: Colors.celesteLight }]}>
              <Text style={st.resCardLabel}>= Balance</Text>
              <Text
                style={[
                  st.resCardVal,
                  { color: resumen.balance >= 0 ? Colors.verde : Colors.rojo },
                ]}
              >
                {formatMonto(resumen.balance)}
              </Text>
            </View>
          </View>

          {/* ── Gráfica de barras ────────────────── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>EVOLUCIÓN DEL PERÍODO</Text>
            <View style={st.card}>
              <View style={st.legend}>
                <View style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: Colors.verde }]} />
                  <Text style={st.legendText}>Ingresos</Text>
                </View>
                <View style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: Colors.rojo }]} />
                  <Text style={st.legendText}>Egresos</Text>
                </View>
              </View>
              {barBuckets.length === 0 ? (
                <Text style={st.emptyText}>Sin movimientos en este período</Text>
              ) : (
                <BarChart buckets={barBuckets} />
              )}
            </View>
          </View>

          {/* ── Gastos por categoría ─────────────── */}
          {gastosCat.length > 0 && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>GASTOS POR CATEGORÍA</Text>
              <View style={st.card}>
                <DonutSimple data={donutData} />
                <View style={st.separator} />
                <View style={st.progresosGap}>
                  {gastosCat.map(g => (
                    <ProgresoItem
                      key={g.categoria_id}
                      label={`${g.icono} ${g.categoria_nombre}`}
                      valor={g.total}
                      total={totalGastos}
                      color={g.color}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ── Gastos por cuenta ────────────────── */}
          {estadCuentas.length > 0 && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>MOVIMIENTOS POR CUENTA</Text>
              <View style={st.card}>
                <View style={st.progresosGap}>
                  {estadCuentas.map(ec => {
                    const cuenta = cuentas.find(c => c.id === ec.cuenta_id);
                    if (!cuenta) return null;
                    const total = ec.ingresos + ec.egresos;
                    const maxTotal = Math.max(
                      1,
                      ...estadCuentas.map(e => e.ingresos + e.egresos)
                    );
                    return (
                      <ProgresoItem
                        key={ec.cuenta_id}
                        label={`${cuenta.icono} ${cuenta.nombre}`}
                        valor={total}
                        total={maxTotal}
                        color={cuenta.color}
                      />
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* ── Exportar ─────────────────────────── */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>EXPORTAR</Text>
            <View style={st.exportRow}>
              <TouchableOpacity
                style={[st.exportBtn, { borderColor: Colors.rojo }]}
                onPress={handleExportPDF}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={20} color={Colors.rojo} />
                <Text style={[st.exportBtnText, { color: Colors.rojo }]}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.exportBtn, { borderColor: Colors.verde }]}
                onPress={handleExportExcel}
                activeOpacity={0.8}
              >
                <Ionicons name="grid-outline" size={20} color={Colors.verde} />
                <Text style={[st.exportBtnText, { color: Colors.verde }]}>Excel</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.fondo },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },

  // Período
  periodoRow: {
    flexDirection: 'row',
    backgroundColor: Colors.blanco,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borde,
  },
  periodoChip: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  periodoChipActive: { borderBottomColor: Colors.celeste },
  periodoText:       { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.gris },
  periodoTextActive: { color: Colors.celeste },

  // Resumen
  resumenRow: { flexDirection: 'row', gap: 8 },
  resCard: {
    flex: 1, borderRadius: 12, padding: 12, gap: 4,
  },
  resCardLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.gris },
  resCardVal:   { fontFamily: Fonts.bold, fontSize: 14 },

  // Secciones
  section:      { gap: 8 },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.gris, letterSpacing: 0.8 },
  card: {
    backgroundColor: Colors.blanco, borderRadius: 14, padding: 16, gap: 12,
  },
  separator:    { height: 1, backgroundColor: Colors.borde },
  progresosGap: { gap: 14 },

  // Leyenda
  legend:     { flexDirection: 'row', gap: 16, justifyContent: 'flex-end' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.gris },

  // Exportar
  exportRow: { flexDirection: 'row', gap: 12 },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, backgroundColor: Colors.blanco,
  },
  exportBtnText: { fontFamily: Fonts.semiBold, fontSize: 15 },

  // Empty
  emptyText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.gris, textAlign: 'center', paddingVertical: 20 },
});
