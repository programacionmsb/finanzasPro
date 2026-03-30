/**
 * parser.ts — Detecta y extrae datos de transacciones desde texto plano.
 * Soporta: Yape, Plin, BCP SMS, Interbank, BBVA.
 */

import { ParsedTransaction } from '../types';
import { toSQLiteDate } from '../utils/formatters';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Extrae monto en soles: "S/ 1,250.50" → 1250.50 */
function parseMonto(texto: string): number | null {
  const match = texto.match(/S\/\s*([\d,]+\.?\d*)/i);
  if (!match) return null;
  return parseFloat(match[1].replace(',', ''));
}

/** Convierte fecha DD/MM/YYYY al formato SQLite */
function parseFecha(texto: string): string {
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return toSQLiteDate(new Date());
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd} 00:00:00`;
}

/** Extrae la línea que sigue a la que contiene "S/" (suele ser el nombre de la persona) */
function extractPersona(texto: string): string {
  const lines = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const idx = lines.findIndex(l => /S\//.test(l));
  if (idx >= 0 && idx + 1 < lines.length) {
    const next = lines[idx + 1];
    // Descartar si la siguiente línea es una fecha u operación
    if (!/\d{2}\/\d{2}\/\d{4}/.test(next) && !/Operaci/i.test(next)) {
      return next;
    }
  }
  return '';
}

// ── Parsers individuales ─────────────────────────────────────────────────

/**
 * YAPE
 * Ingreso: "¡Te yaperon!", "te envió"
 * Egreso:  "Yapeo exitoso", "Le enviaste"
 */
function parseYape(texto: string): ParsedTransaction | null {
  const upper = texto.toUpperCase();
  const esIngreso = /TE YAPERON|TE ENVIÓ|YAPARON/.test(upper);
  const esEgreso  = /YAPEO EXITOSO|LE ENVIASTE|ENVIASTE A/.test(upper);
  if (!esIngreso && !esEgreso) return null;

  const monto = parseMonto(texto);
  if (!monto) return null;

  const opMatch = texto.match(/Operaci[oó]n\s*N[°º]?:?\s*(\d+)/i);
  const persona = extractPersona(texto);

  return {
    tipo:              esIngreso ? 'ingreso' : 'egreso',
    monto,
    descripcion:       persona
      ? `Yape ${esIngreso ? 'de' : 'a'} ${persona}`
      : `Yape ${esIngreso ? 'recibido' : 'enviado'}`,
    origen:            'yape',
    fecha:             parseFecha(texto),
    numero_operacion:  opMatch?.[1],
    persona,
  };
}

/**
 * PLIN
 * Ingreso: "Recibiste"
 * Egreso:  "Enviaste"
 * Banco:   línea "Banco: NOMBRE"
 */
function parsePlin(texto: string): ParsedTransaction | null {
  const upper = texto.toUpperCase();
  const esIngreso = /RECIBISTE/.test(upper);
  const esEgreso  = /ENVIASTE/.test(upper);
  if (!esIngreso && !esEgreso) return null;

  const monto = parseMonto(texto);
  if (!monto) return null;

  const bancoMatch = texto.match(/Banco:\s*(.+)/i);
  const banco      = bancoMatch?.[1]?.trim() ?? '';
  const persona    = extractPersona(texto);

  return {
    tipo:        esIngreso ? 'ingreso' : 'egreso',
    monto,
    descripcion: persona
      ? `Plin ${esIngreso ? 'de' : 'a'} ${persona}`
      : `Plin ${esIngreso ? 'recibido' : 'enviado'}`,
    origen:      'plin',
    fecha:       parseFecha(texto),
    persona,
    banco,
  };
}

/**
 * BCP SMS
 * Patrón: "BCP: Retiro|Transferencia|Deposito S/123.00"
 */
function parseBCP(texto: string): ParsedTransaction | null {
  const match = texto.match(/BCP:\s*(Retiro|Transferencia|Deposito|Pago)\s*S\/\s*([\d.,]+)/i);
  if (!match) return null;

  const operacion = match[1].toLowerCase();
  const monto     = parseFloat(match[2].replace(',', ''));
  const esIngreso = operacion === 'deposito';

  return {
    tipo:        esIngreso ? 'ingreso' : 'egreso',
    monto,
    descripcion: `BCP: ${match[1]}`,
    origen:      'bcp',
    fecha:       parseFecha(texto),
  };
}

/**
 * INTERBANK
 * Patrón: "Interbank: Pagaste S/ 123.00"
 */
function parseInterbank(texto: string): ParsedTransaction | null {
  const match = texto.match(/Interbank:\s*Pagaste\s*S\/\s*([\d.,]+)/i);
  if (!match) return null;

  return {
    tipo:        'egreso',
    monto:       parseFloat(match[1].replace(',', '')),
    descripcion: 'Interbank: Pago',
    origen:      'interbank',
    fecha:       parseFecha(texto),
  };
}

/**
 * BBVA
 * Patrón: "BBVA | Transferencia enviada|recibida"
 */
function parseBBVA(texto: string): ParsedTransaction | null {
  const match = texto.match(/BBVA\s*\|?\s*Transferencia\s*(enviada|recibida)/i);
  if (!match) return null;

  const monto = parseMonto(texto);
  if (!monto) return null;

  const esIngreso = match[1].toLowerCase() === 'recibida';

  return {
    tipo:        esIngreso ? 'ingreso' : 'egreso',
    monto,
    descripcion: `BBVA: Transferencia ${match[1]}`,
    origen:      'bbva',
    fecha:       parseFecha(texto),
  };
}

// ── API pública ──────────────────────────────────────────────────────────

const PARSERS = [parseYape, parsePlin, parseBCP, parseInterbank, parseBBVA];

/**
 * Intenta parsear texto de cualquier origen.
 * Retorna el primer resultado exitoso, o `null` si no reconoce el formato.
 */
export function parseText(texto: string): ParsedTransaction | null {
  for (const parser of PARSERS) {
    try {
      const result = parser(texto);
      if (result) return result;
    } catch {
      // Continuar con el siguiente parser
    }
  }
  return null;
}
