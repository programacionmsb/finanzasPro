import { MonedaCode } from '../types';

const SIMBOLOS: Record<MonedaCode, string> = {
  PEN: 'S/',
  USD: '$',
  EUR: '€',
};

/**
 * Formatea un monto según la moneda del usuario.
 * Ej: formatMonto(1250.5, 'PEN') → "S/ 1,250.50"
 */
export function formatMonto(monto: number, moneda: MonedaCode = 'PEN'): string {
  const simbolo = SIMBOLOS[moneda];
  const formatted = Math.abs(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${simbolo} ${formatted}`;
}

/**
 * Formatea una fecha ISO/SQLite a DD/MM/YYYY.
 * Ej: "2024-03-06 14:30:00" → "06/03/2024"
 */
export function formatFecha(fecha: string): string {
  const d = new Date(fecha.replace(' ', 'T'));
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formatea fecha para SQLite: YYYY-MM-DD HH:mm:ss
 */
export function toSQLiteDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Retorna etiqueta de fecha amigable: "Hoy", "Ayer" o DD/MM/YYYY.
 */
export function fechaAmigable(fecha: string): string {
  const hoy = new Date();
  const d = new Date(fecha.replace(' ', 'T'));
  const diffDias = Math.floor(
    (hoy.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000
  );
  if (diffDias === 0) return 'Hoy';
  if (diffDias === 1) return 'Ayer';
  return formatFecha(fecha);
}
