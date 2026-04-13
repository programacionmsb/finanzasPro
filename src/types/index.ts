// ──────────────────────────────────────────────
// FinanzasPro — TypeScript Interfaces
// ──────────────────────────────────────────────

export interface Usuario {
  id: string;          // Google UID
  nombre: string;
  email: string;
  foto_url: string | null;
  moneda: 'PEN' | 'USD' | 'EUR';
  ocultar_montos: number; // 0 | 1
  creado_en: string;
}

export interface Cuenta {
  id: number;
  usuario_id: string;
  nombre: string;
  tipo: 'banco' | 'efectivo' | 'otro';
  icono: string;       // emoji
  color: string;       // hex
  saldo_inicial: number;
  activa: number;      // 0 | 1
  orden: number;
  creado_en: string;
  // Calculados dinámicamente (no en BD)
  saldo?: number;
}

export interface Categoria {
  id: number;
  usuario_id: string;
  nombre: string;
  icono: string;
  color: string;
  tipo: 'ingreso' | 'egreso';
  parent_id: number | null;
  nivel: number;       // 1=raíz, 2=subcategoría, 3=sub-subcategoría
  orden: number;
  activa: number;      // 0 | 1
  // Relaciones (no en BD, construidas en app)
  subcategorias?: Categoria[];
}

export interface Movimiento {
  id: number;
  usuario_id: string;
  cuenta_origen_id: number;
  categoria_id: number | null;
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  monto: number;
  descripcion: string | null;
  origen: 'manual' | 'yape' | 'plin' | 'bcp' | 'interbank' | 'bbva' | 'foto' | 'compartir';
  cuenta_destino_id: number | null;
  fecha: string;
  imagen_path: string | null;
  datos_ocr: string | null;  // JSON string
  numero_operacion: string | null;
  creado_en: string;
  // Joins (para UI)
  cuenta_nombre?: string;
  categoria_nombre?: string;
  categoria_path?: string;   // "Alimentación › Restaurantes › Almuerzo"
}

export interface Conciliacion {
  id: number;
  cuenta_origen_id: number;
  saldo_app: number;
  saldo_real: number;
  diferencia: number;
  estado: 'coincide' | 'diferencia';
  fecha: string;
}

// Para el onboarding
export interface CuentaTemplate {
  nombre: string;
  tipo: 'banco' | 'efectivo' | 'otro';
  icono: string;
  color: string;
}

export type MonedaCode = 'PEN' | 'USD' | 'EUR';

export * from './navigation';

export interface MonedaOption {
  codigo: MonedaCode;
  nombre: string;
  simbolo: string;
  bandera: string;
}
