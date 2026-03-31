// Categorías por defecto que se insertan en el onboarding

export interface CategoriaDefault {
  nombre: string;
  icono: string;
  color: string;
  tipo: 'ingreso' | 'egreso';
  subcategorias?: {
    nombre: string;
    icono: string;
    subsubcategorias?: string[];
  }[];
}

export const CATEGORIAS_DEFAULT: CategoriaDefault[] = [
  // ── EGRESOS ──────────────────────────────────
  {
    nombre: 'Alimentación',
    icono: '🍔',
    color: '#E67E22',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Restaurantes', icono: '🍽️', subsubcategorias: ['Desayuno', 'Almuerzo', 'Cena'] },
      { nombre: 'Supermercado', icono: '🛒' },
      { nombre: 'Cafeterías',   icono: '☕' },
    ],
  },
  {
    nombre: 'Transporte',
    icono: '🚗',
    color: '#3498DB',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Taxi/Uber',   icono: '🚕' },
      { nombre: 'Bus/Metro',   icono: '🚌' },
      { nombre: 'Combustible', icono: '⛽' },
    ],
  },
  {
    nombre: 'Hogar',
    icono: '🏠',
    color: '#8E44AD',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Alquiler',          icono: '🏡' },
      { nombre: 'Servicios básicos', icono: '💡', subsubcategorias: ['Luz', 'Agua', 'Internet'] },
    ],
  },
  {
    nombre: 'Salud',
    icono: '🏥',
    color: '#E74C3C',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Medicamentos',      icono: '💊' },
      { nombre: 'Consultas médicas', icono: '👨‍⚕️' },
    ],
  },
  {
    nombre: 'Ocio',
    icono: '🎮',
    color: '#1DB87A',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Streaming', icono: '📺' },
      { nombre: 'Salidas',   icono: '🎭', subsubcategorias: ['Cine', 'Bares', 'Conciertos'] },
    ],
  },
  {
    nombre: 'Compras',
    icono: '📦',
    color: '#F39C12',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Ropa',       icono: '👕' },
      { nombre: 'Tecnología', icono: '💻' },
    ],
  },
  {
    nombre: 'Educación',
    icono: '📚',
    color: '#2ECC71',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Cursos', icono: '🎓' },
      { nombre: 'Libros', icono: '📖' },
    ],
  },
  {
    nombre: 'Servicios',
    icono: '🔧',
    color: '#5D6D7E',
    tipo: 'egreso',
    subcategorias: [
      { nombre: 'Internet', icono: '🌐' },
    ],
  },

  // ── INGRESOS ─────────────────────────────────
  {
    nombre: 'Servicios',
    icono: '🔧',
    color: '#5D6D7E',
    tipo: 'ingreso',
    subcategorias: [
      { nombre: 'Internet', icono: '🌐' },
    ],
  },
  {
    nombre: 'Trabajo',
    icono: '💼',
    color: '#4A90D9',
    tipo: 'ingreso',
    subcategorias: [
      { nombre: 'Salario',   icono: '💰' },
      { nombre: 'Freelance', icono: '💻' },
      { nombre: 'Bonos',     icono: '🎁' },
    ],
  },
  {
    nombre: 'Transferencias recibidas',
    icono: '💸',
    color: '#1DB87A',
    tipo: 'ingreso',
    subcategorias: [
      { nombre: 'Yape recibido',        icono: '🟣' },
      { nombre: 'Plin recibido',        icono: '🔵' },
      { nombre: 'Transferencia bancaria', icono: '🏦' },
    ],
  },
  {
    nombre: 'Otros',
    icono: '🎁',
    color: '#7B3FE4',
    tipo: 'ingreso',
    subcategorias: [
      { nombre: 'Regalo',           icono: '🎀' },
      { nombre: 'Devolución',       icono: '↩️' },
      { nombre: 'Venta de objeto',  icono: '🛍️' },
    ],
  },
];

// Plantillas de cuentas para el onboarding
export const CUENTAS_TEMPLATE = [
  { nombre: 'Efectivo',   tipo: 'efectivo' as const, icono: '💵', color: '#1DB87A' },
  { nombre: 'BCP',        tipo: 'banco'    as const, icono: '🏦', color: '#E74C3C' },
  { nombre: 'Interbank',  tipo: 'banco'    as const, icono: '🏦', color: '#E67E22' },
  { nombre: 'BBVA',       tipo: 'banco'    as const, icono: '🏦', color: '#1A5276' },
  { nombre: 'Scotiabank', tipo: 'banco'    as const, icono: '🏦', color: '#E31837' },
  { nombre: 'Caja Piura', tipo: 'banco'    as const, icono: '🏦', color: '#0066CC' },
];
