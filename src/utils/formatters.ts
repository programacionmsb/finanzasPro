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
 * Parsea una fecha SQLite/ISO a Date en hora LOCAL (evita el bug de Android
 * donde new Date("YYYY-MM-DDTHH:MM:SS") puede interpretarse como UTC).
 * Acepta: "2024-03-06 14:30:00" o "2024-03-06T14:30:00" o "2024-03-06"
 */
export function parseFechaLocal(fecha: string): Date {
  const [datePart, timePart = '00:00:00'] = fecha.split(/[ T]/);
  const [y, mo, d]  = datePart.split('-').map(Number);
  const [h, mi, s]  = timePart.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, s || 0);
}

/**
 * Formatea una fecha ISO/SQLite a DD/MM/YYYY.
 * Ej: "2024-03-06 14:30:00" → "06/03/2024"
 */
export function formatFecha(fecha: string): string {
  const d = parseFechaLocal(fecha);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Intenta parsear una cadena de texto OCR a Date (hora local).
 * Soporta formatos comunes en comprobantes peruanos:
 *   DD/MM/YYYY [HH:MM[:SS]]
 *   YYYY-MM-DD [HH:MM[:SS]]
 *   DD MMM[.] YYYY [HH:MM [a/p.m.]]   ej: "15 ene. 2024 2:30 p. m."
 * Retorna null si no puede parsear.
 */
export function parseFechaOcr(texto: string): Date | null {
  const t = texto.trim();

  // DD/MM/YYYY [HH:MM[:SS] [h]]
  let m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d](\d{1,2}):(\d{2})(?::(\d{2}))?\s*h?)?/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
    if (!isNaN(d.getTime())) return d;
  }

  // DD-MM-YYYY [HH:MM[:SS] [h]]
  m = t.match(/(\d{1,2})-(\d{1,2})-(\d{4})(?:[^\d](\d{1,2}):(\d{2})(?::(\d{2}))?\s*h?)?/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD [HH:MM[:SS]]
  m = t.match(/(\d{4})-(\d{2})-(\d{2})(?:[^\d](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
    if (!isNaN(d.getTime())) return d;
  }

  // DD MMM[.] YYYY [HH:MM [a/p[. ]m[.]]]  ej: "15 ene. 2024 2:30 p. m."
  const MESES: Record<string, number> = {
    ene:0, enero:0,
    feb:1, febrero:1,
    mar:2, marzo:2,
    abr:3, abril:3,
    may:4, mayo:4,
    jun:5, junio:5,
    jul:6, julio:6,
    ago:7, agosto:7,
    sep:8, set:8, septiembre:8,
    oct:9, octubre:9,
    nov:10, noviembre:10,
    dic:11, diciembre:11,
  };
  m = t.match(/(\d{1,2})\s+([a-záéíóú]{3,10})\.?\s+(\d{4})(?:.*?(\d{1,2}):(\d{2})(?:.*?([aApP]))?)?/i);
  if (m) {
    const mes = MESES[m[2].toLowerCase()];
    if (mes !== undefined) {
      let h = +(m[4] ?? 0);
      const ap = m[6]?.toLowerCase();
      if (ap === 'p' && h < 12) h += 12;
      if (ap === 'a' && h === 12) h = 0;
      const d = new Date(+m[3], mes, +m[1], h, +(m[5] ?? 0), 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/**
 * Busca una línea con patrón de hora (HH:MM a/p.m.) dentro de una lista de líneas OCR.
 * Útil cuando la fecha y la hora aparecen en líneas separadas.
 */
export function buscarHoraEnLineas(lineas: string[]): string | null {
  // Formato 24h con sufijo "h" (ej: "21:43 h")
  const reH = /^\d{1,2}:\d{2}(?::\d{2})?\s*h$/i;
  const lineaH = lineas.find(l => reH.test(l.trim()));
  if (lineaH) return lineaH.trim();

  // Formato 24h puro (ej: "19:39:03")
  const re24 = /^\d{1,2}:\d{2}(?::\d{2})?$/;
  const linea24 = lineas.find(l => re24.test(l.trim()));
  if (linea24) return linea24.trim();

  // Formato 12h con AM/PM (ej: "7:39 p. m.")
  const re12 = /\d{1,2}:\d{2}\s*(a|p)\.?\s*m\./i;
  return lineas.find(l => re12.test(l)) ?? null;
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
  const d   = parseFechaLocal(fecha);
  const diffDias = Math.floor(
    (hoy.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000
  );
  if (diffDias === 0) return 'Hoy';
  if (diffDias === 1) return 'Ayer';
  return formatFecha(fecha);
}
