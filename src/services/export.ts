import * as Print   from 'expo-print';
import * as Sharing  from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { Movimiento, Usuario } from '../types';
import { ResumenPeriodo, GastoCategoria } from './db';

export interface ExportParams {
  usuario:     Usuario;
  movimientos: Movimiento[];
  resumen:     ResumenPeriodo;
  gastosCat:   GastoCategoria[];
  desde:       string;
  hasta:       string;
}

// ── PDF ───────────────────────────────────────────────────────────────────

function moneda(monto: number) {
  return `S/ ${Math.abs(monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function buildHTML(p: ExportParams): string {
  const filas = p.movimientos
    .map(
      m =>
        `<tr>
          <td>${m.fecha.substring(0, 10)}</td>
          <td>${m.tipo === 'ingreso' ? '↑' : '↓'} ${m.tipo}</td>
          <td style="text-align:right;color:${m.tipo === 'ingreso' ? '#1DB87A' : '#E74C3C'}">${moneda(m.monto)}</td>
          <td>${m.descripcion ?? ''}</td>
          <td>${m.cuenta_nombre ?? ''}</td>
          <td>${m.categoria_nombre ?? ''}</td>
        </tr>`
    )
    .join('');

  const catFilas = p.gastosCat
    .map(g => `<tr><td>${g.icono} ${g.categoria_nombre}</td><td style="text-align:right">${moneda(g.total)}</td></tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #1C2B3A; }
  h1   { color: #1A3C6E; font-size: 22px; margin-bottom: 4px; }
  h2   { color: #4A90D9; font-size: 16px; margin: 20px 0 8px; }
  .summary { display: flex; gap: 16px; margin: 12px 0; }
  .card { padding: 12px 20px; border-radius: 10px; flex: 1; }
  .ing { background:#E8F8F0; color:#1DB87A; }
  .egr { background:#FDECEA; color:#E74C3C; }
  .bal { background:#EBF4FF; color:#1A3C6E; }
  .val { font-size: 20px; font-weight: bold; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { background:#1A3C6E; color:white; padding:7px 10px; text-align:left; }
  td { padding:6px 10px; border-bottom:1px solid #DDE6F0; }
  tr:nth-child(even) td { background:#F0F4F9; }
  .periodo { color:#7A8B9A; font-size:13px; }
</style>
</head>
<body>
<h1>💰 FinanzasPro — Reporte</h1>
<p class="periodo">Período: ${p.desde.substring(0, 10)} → ${p.hasta.substring(0, 10)}</p>
<p class="periodo">Usuario: ${p.usuario.nombre} &lt;${p.usuario.email}&gt;</p>

<h2>Resumen del período</h2>
<div class="summary">
  <div class="card ing"><div>↑ Ingresos</div><div class="val">${moneda(p.resumen.ingresos)}</div></div>
  <div class="card egr"><div>↓ Egresos</div><div class="val">${moneda(p.resumen.egresos)}</div></div>
  <div class="card bal"><div>= Balance</div><div class="val">${moneda(p.resumen.balance)}</div></div>
</div>

<h2>Gastos por categoría</h2>
<table>
  <tr><th>Categoría</th><th style="text-align:right">Total</th></tr>
  ${catFilas || '<tr><td colspan="2">Sin gastos</td></tr>'}
</table>

<h2>Movimientos (${p.movimientos.length})</h2>
<table>
  <tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Descripción</th><th>Cuenta</th><th>Categoría</th></tr>
  ${filas || '<tr><td colspan="6">Sin movimientos</td></tr>'}
</table>
</body>
</html>`;
}

export async function exportarPDF(params: ExportParams): Promise<void> {
  const html = buildHTML(params);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
  }
}

// ── Excel ─────────────────────────────────────────────────────────────────

export async function exportarExcel(params: ExportParams): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Movimientos
  const movData = params.movimientos.map(m => ({
    Fecha:        m.fecha.substring(0, 10),
    Tipo:         m.tipo,
    Monto:        m.monto,
    Descripción:  m.descripcion ?? '',
    Cuenta:       m.cuenta_nombre ?? '',
    Categoría:    m.categoria_nombre ?? '',
    Origen:       m.origen,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movData), 'Movimientos');

  // Hoja 2: Gastos por categoría
  const catData = params.gastosCat.map(g => ({
    Categoría: `${g.icono} ${g.categoria_nombre}`,
    Total:     g.total,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), 'Por Categoría');

  // Hoja 3: Resumen
  const resData = [
    { Concepto: 'Ingresos', Monto: params.resumen.ingresos },
    { Concepto: 'Egresos',  Monto: params.resumen.egresos  },
    { Concepto: 'Balance',  Monto: params.resumen.balance  },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resData), 'Resumen');

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = (FileSystem.documentDirectory ?? '') + 'FinanzasPro.xlsx';
  await FileSystem.writeAsStringAsync(uri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      UTI: '.xlsx',
    });
  }
}
