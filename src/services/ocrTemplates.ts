import AsyncStorage from '@react-native-async-storage/async-storage';
import { buscarHoraEnLineas } from '../utils/formatters';

const KEY = 'finanzaspro_ocr_templates_v1';

export type CampoDestino =
  | 'monto'
  | 'fecha'
  | 'descripcion'
  | 'flujo'
  | 'persona'
  | 'telefono'
  | 'nro_operacion'
  | 'destino'
  | 'cuenta_origen'
  | 'cuenta_destino'
  | 'ignorar';

export interface OcrTemplate {
  id: string;
  nombre: string;
  /** Fragmentos de texto que identifican este tipo de imagen */
  palabrasClave: string[];
  /** Mapeo de línea → campo destino */
  mapeo: {
    fragmento: string;   // texto original (fallback para labels estáticos)
    campo: CampoDestino;
    lineaIdx: number;    // posición en el OCR (estrategia primaria)
  }[];
  creado_en: string;
  /** Keyword para auto-seleccionar cuenta (ej: "BCP", "Interbank") */
  cuentaKeyword?: string;
  /** Palabras en el texto OCR que indican que es un INGRESO */
  palabrasIngreso?: string[];
  /** Palabras en el texto OCR que indican que es un EGRESO */
  palabrasEgreso?: string[];
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<OcrTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveTemplate(t: OcrTemplate): Promise<void> {
  const all = await getTemplates();
  const idx = all.findIndex(x => x.id === t.id);
  if (idx >= 0) all[idx] = t;
  else all.push(t);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function deleteTemplate(id: string): Promise<void> {
  const all = await getTemplates();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter(t => t.id !== id)));
}

// ── Detección y aplicación ────────────────────────────────────────────────────

/** Retorna la primera plantilla cuyas palabrasClave aparecen en el texto OCR */
export function detectarTemplate(texto: string, templates: OcrTemplate[]): OcrTemplate | null {
  const upper = texto.toUpperCase();
  for (const t of templates) {
    if (t.palabrasClave.some(kw => upper.includes(kw.toUpperCase()))) {
      return t;
    }
  }
  return null;
}

export interface DatosAplicados {
  monto?:         number;
  fecha?:         string;
  descripcion?:   string;
  flujo?:         string;
  persona?:       string;
  telefono?:      string;
  nro_operacion?: string;
  destino?:       string;
  cuenta_origen?: string;
  cuenta_destino?:string;
}

/** Extrae valores del texto OCR usando el mapeo de una plantilla */
export function aplicarTemplate(texto: string, template: OcrTemplate): DatosAplicados {
  const lineas = texto.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const result: DatosAplicados = {};
  const partes_descripcion: string[] = [];

  function procesarLinea(linea: string, campo: CampoDestino) {
    if (esLabelEstructura(linea)) return; // descarta labels del recibo
    switch (campo) {
      case 'monto': {
        // Extrae el primer número con decimales de la línea
        const match = linea.match(/[\d]+[.,]\d{2}/) ?? linea.match(/[\d,.]+/);
        if (match) result.monto = parseFloat(match[0].replace(/,/g, '.'));
        break;
      }
      case 'fecha': {
        const RE_FECHA_V = /\d{1,2}\s+[a-záéíóú]{3,10}\.?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/i;
        if (!RE_FECHA_V.test(linea)) break; // no es una fecha real, ignorar
        if (/\d{1,2}:\d{2}/.test(linea)) {
          result.fecha = linea;
        } else {
          const hora = buscarHoraEnLineas(lineas.filter(l => l !== linea));
          result.fecha = hora ? `${linea} ${hora}` : linea;
        }
        break;
      }
      case 'flujo':        result.flujo = linea; break;
      case 'descripcion':  partes_descripcion.push(linea); break;
      case 'persona':      break; // persona se detecta dinámicamente abajo
      case 'telefono':       result.telefono       = linea; break;
      case 'nro_operacion':  result.nro_operacion  = linea; break;
      case 'destino':        result.destino        = linea; break;
      case 'cuenta_origen':  result.cuenta_origen  = linea; break;
      case 'cuenta_destino': result.cuenta_destino = linea; break;
    }
  }

  for (const m of template.mapeo) {
    if (m.campo === 'ignorar') continue;

    // ── Estrategia 1: posición (índice de línea) ───────────────────────────
    // Soporta índices negativos: -1 = último, -2 = penúltimo, -3 = antepenúltimo.
    const resolvedIdx = m.lineaIdx < 0
      ? lineas.length + m.lineaIdx
      : m.lineaIdx;

    if (resolvedIdx >= 0 && resolvedIdx < lineas.length) {
      procesarLinea(lineas[resolvedIdx], m.campo);
      continue;
    }

    // ── Estrategia 2: fragmento (fallback para labels estáticos) ───────────
    // Solo aplica si el nuevo OCR tiene menos líneas que el original.
    for (const linea of lineas) {
      if (linea.toLowerCase().includes(m.fragmento.toLowerCase())) {
        procesarLinea(linea, m.campo);
        break;
      }
    }
  }

  // ── Detección dinámica de persona ────────────────────────────────────────
  // Si la plantilla mapea monto Y fecha, buscamos esos campos por CONTENIDO
  // en el OCR real y extraemos todo lo que esté entre ellos como persona.
  // Esto resuelve el problema de nombres con 1 o 2+ líneas sin romper el mapeo.
  const tieneMonto   = template.mapeo.some(m => m.campo === 'monto');
  const tieneFecha   = template.mapeo.some(m => m.campo === 'fecha');
  const tienePersona = template.mapeo.some(m => m.campo === 'persona');

  if (tieneMonto && tieneFecha && tienePersona) {
    const RE_MONTO = /[Ss]\/\s*[\d]|[\d]+[.,]\d{2}/;
    const RE_FECHA = /\d{1,2}\s+[a-záéíóú]{3,10}\.?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/i;

    const idxMonto = lineas.findIndex(l => RE_MONTO.test(l));
    const idxFecha = lineas.findIndex(l => RE_FECHA.test(l));

    if (idxMonto >= 0 && idxFecha > idxMonto + 1) {
      const personaDinamica = lineas
        .slice(idxMonto + 1, idxFecha)
        .filter(l => !esLabelEstructura(l) && !RE_MONTO.test(l));
      if (personaDinamica.length > 0) {
        partes_descripcion.unshift(personaDinamica.join(' '));
      }
    }
  }

  if (partes_descripcion.length > 0) {
    result.descripcion = partes_descripcion.join(' - ');
  }

  // ── Post-proceso: fecha por contenido ─────────────────────────────────────
  // Si el lineaIdx apuntó a una línea incorrecta, buscar la fecha real en todo el OCR.
  const RE_FECHA_POST = /\d{1,2}\s+[a-záéíóú]{3,10}\.?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/i;
  if (!result.fecha || !RE_FECHA_POST.test(result.fecha)) {
    const lineaFecha = lineas.find(l => RE_FECHA_POST.test(l));
    if (lineaFecha) {
      if (/\d{1,2}:\d{2}/.test(lineaFecha)) {
        result.fecha = lineaFecha;
      } else {
        const hora = buscarHoraEnLineas(lineas.filter(l => l !== lineaFecha));
        result.fecha = hora ? `${lineaFecha} ${hora}` : lineaFecha;
      }
    }
  }

  // ── Post-proceso: nro_operacion ───────────────────────────────────────────
  // Si el valor extraído parece un label (solo letras, sin dígitos), el lineaIdx
  // apunta a una línea incorrecta. El nro de operación casi siempre está al final
  // y puede ser numérico o alfanumérico.
  if (result.nro_operacion && !/\d/.test(result.nro_operacion)) {
    // Estrategia 1: primera línea con al menos un dígito después del label "operación"
    const labelIdx = lineas.findIndex(l => /operaci[oó]n/i.test(l));
    let encontrado = false;
    if (labelIdx >= 0) {
      for (let i = labelIdx + 1; i < Math.min(labelIdx + 8, lineas.length); i++) {
        const l = lineas[i].trim();
        if (/\d/.test(l) && !/^(nro|cel|destino|monto|fecha)/i.test(l)) {
          result.nro_operacion = l;
          encontrado = true;
          break;
        }
      }
    }
    // Estrategia 2: última línea del OCR que contenga al menos un dígito
    if (!encontrado) {
      for (let i = lineas.length - 1; i >= 0; i--) {
        if (/\d/.test(lineas[i].trim())) {
          result.nro_operacion = lineas[i].trim();
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Labels de estructura del comprobante que nunca deben usarse como valor de un campo.
 * Si una línea extrae uno de estos textos, se descarta.
 */
const LABELS_ESTRUCTURA = [
  'código de seguridad',
  'datos de la transacción',
  'nro. de celular',
  'nro. de operación',
  'número de operación',
  'destino',
  'monto',
  'fecha',
  'hora',
  'tipo de pago',
  'comprobante',
  'detalle',
  'información',
];

export function esLabelEstructura(texto: string): boolean {
  const t = texto.toLowerCase().trim();
  return LABELS_ESTRUCTURA.some(l => t === l || t.startsWith(l));
}

/** Divide el texto OCR en líneas significativas */
export function extraerLineas(texto: string): string[] {
  return texto
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(l => l.length >= 2);
}
