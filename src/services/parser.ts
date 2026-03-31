/**
 * parser.ts — Detecta y extrae datos de transacciones desde texto OCR.
 * Soporta: Yape, Plin, BCP, Interbank, BBVA.
 */

import { ParsedTransaction } from '../types';
import { toSQLiteDate } from '../utils/formatters';

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extrae el monto principal en soles.
 * Acepta: "S/ 1,250.50", "s/50", "S/1.250,50"
 */
function parseMonto(texto: string): number | null {
  // Busca todos los "S/ número" en el texto
  const matches = [...texto.matchAll(/[Ss]\s*\/\s*([\d,.]+)/g)];
  if (matches.length === 0) return null;
  // Toma el primero (suele ser el monto principal en la pantalla)
  const raw = matches[0][1].replace(/,/g, '');
  const n = parseFloat(raw);
  return isNaN(n) || n <= 0 ? null : n;
}

const MESES: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

/**
 * Extrae la hora del texto OCR con rangos válidos (00:00–23:59).
 * Ej: "07:06 p. m." → "19:06:00"
 * Usa hora actual si no encuentra ninguna.
 */
function parseHora(texto: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Horas 0-23, minutos 0-59, opcional a.m./p.m.
  const match = texto.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(p\.?\s*m\.?|a\.?\s*m\.?)?(?!\s*\/)/i);
  if (!match) {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  }
  let h = parseInt(match[1], 10);
  const min = match[2];
  const ampm = (match[3] ?? '').replace(/[\s.]/g, '').toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${pad(h)}:${min}:00`;
}

/**
 * Convierte fecha a formato SQLite preservando la hora del OCR.
 * Soporta: DD/MM/YYYY, "30 mar. 2026", DD/MM/YY
 */
function parseFecha(texto: string): string {
  const hora = parseHora(texto);
  // Formato DD/MM/YYYY
  const m1 = texto.match(/(\d{1,2})\/(\d{2})\/(\d{4})/);
  if (m1) {
    const [, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm}-${dd.padStart(2, '0')} ${hora}`;
  }
  // Formato "30 mar. 2026" o "30 mar 2026"
  const m2 = texto.match(/(\d{1,2})\s+([a-záéíóú]{3})\.?\s+(\d{4})/i);
  if (m2) {
    const [, dd, mes, yyyy] = m2;
    const mm = MESES[mes.toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')} ${hora}`;
  }
  // Formato DD/MM/YY
  const m3 = texto.match(/(\d{1,2})\/(\d{2})\/(\d{2})\b/);
  if (m3) {
    const [, dd, mm, yy] = m3;
    return `20${yy}-${mm}-${dd.padStart(2, '0')} ${hora}`;
  }
  return toSQLiteDate(new Date());
}

/**
 * Extrae el nombre de la persona involucrada en la transacción.
 * Prioriza etiquetas explícitas (A:, Para:, De:), luego heurística posicional.
 * Maneja el caso donde ML Kit fusiona nombre + fecha en una sola línea.
 */
function extractPersona(texto: string): string {
  // Etiquetas explícitas: "A: Juan", "Para: María", "De: Pedro"
  const labeled = texto.match(/(?:^|\n)\s*(?:[Aa]:|[Pp]ara:|[Dd]e:)\s*(.+)/m);
  if (labeled) return labeled[1].trim();

  // Heurística: línea inmediatamente después del monto
  const lines = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const idx = lines.findIndex(l => /[Ss]\s*\//.test(l));
  if (idx >= 0 && idx + 1 < lines.length) {
    const next = lines[idx + 1];

    // ML Kit a veces fusiona nombre + fecha en una sola línea.
    // Si hay una fecha embebida, extraer solo la parte antes de ella.
    const fechaIdx = next.search(/\d{1,2}\s+[a-záéíóú]{3}\.?\s+\d{4}|\d{1,2}[\/\-]\d{2}[\/\-]\d{2,4}/i);
    const candidato = fechaIdx > 0 ? next.substring(0, fechaIdx).trim() : next;

    if (
      !/Operaci/i.test(candidato) &&
      !/Mensaje/i.test(candidato) &&
      !/Descripci/i.test(candidato) &&
      !/DATOS/i.test(candidato) &&
      !/^\d{5,}$/.test(candidato) &&
      candidato.length >= 2 && candidato.length < 80
    ) {
      return candidato;
    }
  }
  return '';
}

/**
 * Extrae el número de celular peruano del texto OCR.
 * Acepta: "987 654 321", "+51 987654321", "51 9XX XXX XXX"
 */
function extractTelefono(texto: string): string {
  // Con prefijo internacional +51 o 51
  const m1 = texto.match(/(?:\+51|51)\s*([9]\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/);
  if (m1) return m1[1].replace(/[\s\-]/g, '');
  // Celular peruano suelto: 9XXXXXXXX con o sin espacios
  const m2 = texto.match(/\b(9\d{2}[\s]?\d{3}[\s]?\d{3})\b/);
  if (m2) return m2[1].replace(/\s/g, '');
  return '';
}

/**
 * Extrae el mensaje/nota escrito por el usuario (campo "Mensaje" en Yape o Plin).
 */
function extractMensaje(texto: string): string {
  // "Mensaje\nTexto" — patrón típico de Yape
  const m1 = texto.match(/Mensaje\s*\n\s*(.+)/i);
  if (m1) return m1[1].trim();
  // "Mensaje: Texto" — variante inline
  const m2 = texto.match(/Mensaje:\s*(.+)/i);
  if (m2) return m2[1].trim();
  // "Descripción: Texto" — Plin / bancos
  const m3 = texto.match(/Descripci[oó]n[:\s]+(.+)/i);
  if (m3) return m3[1].trim();
  return '';
}

// Plataformas/palabras conocidas que aparecen como intermedias en el comprobante Yape
const PALABRAS_INTERMEDIAS = /^(yape|plin|bcp|interbank|bbva|destino|origen|banco|cuenta|soles?)$/i;

/**
 * Extrae el número de operación de Yape.
 * Puede ser alfanumérico. Siempre es el último dato del comprobante.
 * Estructura típica: "Nro. de operación\nYape\nbc6a15e4"
 */
function extractNroOperacionYape(texto: string): string {
  const lineas = texto.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

  // Estrategia 1 — buscar la etiqueta y tomar el valor 2 líneas después
  // (saltando la línea intermedia tipo "Yape", "Plin", etc.)
  const idxLabel = lineas.findIndex(l =>
    /nro\.?\s*de\s*operaci[oó]n|n[uú]mero\s*de\s*operaci[oó]n/i.test(l)
  );
  if (idxLabel !== -1) {
    // Buscar el primer valor alfanumérico después de la etiqueta, saltando intermedios conocidos
    for (let i = idxLabel + 1; i < lineas.length; i++) {
      const l = lineas[i];
      if (!PALABRAS_INTERMEDIAS.test(l) && /^[a-zA-Z0-9]{4,}$/.test(l)) {
        return l;
      }
    }
  }

  // Estrategia 2 — última línea alfanumérica del texto (sin espacios, 4+ chars)
  for (let i = lineas.length - 1; i >= 0; i--) {
    const l = lineas[i];
    if (
      /^[a-zA-Z0-9]{4,}$/.test(l) &&
      !PALABRAS_INTERMEDIAS.test(l) &&
      !/^\d{1,2}\/\d{2}\/\d{2,4}$/.test(l) &&
      !/^\d{1,2}:\d{2}/.test(l) &&
      !/^[Ss]\s*\//.test(l) &&
      !/^\d{4}$/.test(l) &&
      !/^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)$/i.test(l)
    ) {
      return l;
    }
  }

  return '0';
}

// ── Parsers individuales ─────────────────────────────────────────────────

/**
 * YAPE
 * Egreso:  "¡Yapeaste!", "Yapeo exitoso", "Le enviaste", "Enviaste a"
 * Ingreso: "¡Te Yapearon!", "te envió", "te yaparon"
 */
function parseYape(texto: string): ParsedTransaction | null {
  const upper = texto.toUpperCase();
  const esIngreso = /TE YAPERON|TE ENVI[OÓ]|YAPARON|TE YAPEARON|TE YAP[EÉ]/.test(upper);
  const esEgreso  = /YAPEO EXITOSO|LE ENVIASTE|ENVIASTE A|YAPEASTE|[¡!]YAPEASTE/.test(upper);
  if (!esIngreso && !esEgreso) return null;

  const monto = parseMonto(texto);
  if (!monto) return null;

  // Extraer la frase exacta de acción que aparece en el comprobante
  let accion: string;
  if (esIngreso) {
    if (/¡TE YAPEARON!/i.test(upper))      accion = '¡Te Yapearon!';
    else if (/TE YAPEARON/i.test(upper))   accion = 'Te Yapearon';
    else if (/TE ENVI[OÓ]/i.test(upper))   accion = 'Te envió';
    else                                    accion = 'Te yaparon';
  } else {
    if (/¡YAPEASTE!/i.test(upper))          accion = '¡Yapeaste!';
    else if (/YAPEO EXITOSO/i.test(upper))  accion = 'Yapeo exitoso';
    else if (/ENVIASTE A/i.test(upper))     accion = 'Enviaste a';
    else                                    accion = 'Yapeaste';
  }

  const persona  = extractPersona(texto);
  const telefono = extractTelefono(texto);
  const nroOperacion = extractNroOperacionYape(texto);

  // Descripción: "[acción] a/de [nombre] [teléfono]"
  const partes: string[] = [accion];
  if (persona) {
    partes.push(esIngreso ? 'de' : 'a');
    partes.push(persona);
  }
  if (telefono) partes.push(telefono);
  const descripcion = partes.join(' ');

  return {
    tipo:             esIngreso ? 'ingreso' : 'egreso',
    monto,
    descripcion,
    origen:           'yape',
    fecha:            parseFecha(texto),
    numero_operacion: nroOperacion,
    persona,
    telefono,
  };
}

/**
 * PLIN
 * Requiere la palabra "PLIN" en el texto.
 * Egreso:  "Enviaste"
 * Ingreso: "Recibiste"
 */
function parsePlin(texto: string): ParsedTransaction | null {
  const upper = texto.toUpperCase();
  if (!/PLIN/.test(upper)) return null;

  const esIngreso = /RECIBISTE/.test(upper);
  const esEgreso  = /ENVIASTE/.test(upper);
  if (!esIngreso && !esEgreso) return null;

  const monto = parseMonto(texto);
  if (!monto) return null;

  const persona = extractPersona(texto);
  const mensaje = extractMensaje(texto);
  const bancoMatch = texto.match(/Banco:\s*(.+)/i);
  const banco = bancoMatch?.[1]?.trim() ?? '';

  let descripcion: string;
  if (mensaje) {
    descripcion = persona
      ? `${mensaje} (${esIngreso ? 'de' : 'a'} ${persona})`
      : mensaje;
  } else if (persona) {
    descripcion = `Plin ${esIngreso ? 'de' : 'a'} ${persona}`;
  } else {
    descripcion = `Plin ${esIngreso ? 'recibido' : 'enviado'}`;
  }

  return {
    tipo:        esIngreso ? 'ingreso' : 'egreso',
    monto,
    descripcion,
    origen:      'plin',
    fecha:       parseFecha(texto),
    persona,
    banco,
  };
}

/**
 * BCP — SMS o notificación de app
 * Ej: "BCP: Transferencia S/500.00"
 */
function parseBCP(texto: string): ParsedTransaction | null {
  const match = texto.match(
    /BCP:\s*(Retiro|Transferencia|Dep[oó]sito|Deposito|Pago|Compra|Cobro)\s*S\/\s*([\d.,]+)/i
  );
  if (!match) return null;

  const operacion = match[1].toLowerCase();
  const monto     = parseFloat(match[2].replace(/,/g, ''));
  const esIngreso = /dep[oó]sito|cobro/.test(operacion);

  return {
    tipo:        esIngreso ? 'ingreso' : 'egreso',
    monto,
    descripcion: `BCP: ${match[1]}`,
    origen:      'bcp',
    fecha:       parseFecha(texto),
  };
}

/**
 * INTERBANK — SMS o app
 * Ej: "Interbank: Pagaste S/ 123" o "Transferencia enviada/recibida"
 */
function parseInterbank(texto: string): ParsedTransaction | null {
  const upper = texto.toUpperCase();
  if (!/INTERBANK/.test(upper)) return null;

  // SMS clásico
  const sms = texto.match(/Interbank:\s*Pagaste\s*S\/\s*([\d.,]+)/i);
  if (sms) {
    return {
      tipo:        'egreso',
      monto:       parseFloat(sms[1].replace(/,/g, '')),
      descripcion: 'Interbank: Pago',
      origen:      'interbank',
      fecha:       parseFecha(texto),
    };
  }

  // App: Transferencia enviada / recibida
  const trans = texto.match(/Transferencia\s*(enviada|recibida)/i);
  const monto = parseMonto(texto);
  if (trans && monto) {
    const esIngreso = trans[1].toLowerCase() === 'recibida';
    return {
      tipo:        esIngreso ? 'ingreso' : 'egreso',
      monto,
      descripcion: `Interbank: Transferencia ${trans[1]}`,
      origen:      'interbank',
      fecha:       parseFecha(texto),
    };
  }

  return null;
}

/**
 * BBVA — app o SMS
 * Ej: "BBVA | Transferencia enviada S/ 200"
 */
function parseBBVA(texto: string): ParsedTransaction | null {
  const upper = texto.toUpperCase();
  if (!/BBVA/.test(upper)) return null;

  const monto = parseMonto(texto);
  if (!monto) return null;

  // Transferencia enviada / recibida
  const trans = texto.match(/Transferencia\s*(enviada|recibida)/i);
  if (trans) {
    const esIngreso = trans[1].toLowerCase() === 'recibida';
    return {
      tipo:        esIngreso ? 'ingreso' : 'egreso',
      monto,
      descripcion: `BBVA: Transferencia ${trans[1]}`,
      origen:      'bbva',
      fecha:       parseFecha(texto),
    };
  }

  // Pago / Compra / Retiro
  const pago = texto.match(/\b(Pago|Compra|Retiro|Disposici[oó]n)\b/i);
  if (pago) {
    return {
      tipo:        'egreso',
      monto,
      descripcion: `BBVA: ${pago[1]}`,
      origen:      'bbva',
      fecha:       parseFecha(texto),
    };
  }

  return null;
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
