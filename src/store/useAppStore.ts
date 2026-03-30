import { create } from 'zustand';
import { Usuario, Cuenta, Movimiento, Categoria } from '../types';
import { getCuentas, calcularSaldo, getMovimientos, getCategorias } from '../services/db';

interface AppStore {
  // ── Usuario ────────────────────────────────
  usuario: Usuario | null;
  setUsuario: (u: Usuario | null) => void;

  // ── Montos ocultos ─────────────────────────
  amountsHidden: boolean;
  toggleAmountsHidden: () => void;
  setAmountsHidden: (v: boolean) => void;

  // ── Cuentas ────────────────────────────────
  cuentas: Cuenta[];
  setCuentas: (c: Cuenta[]) => void;
  refreshCuentas: () => Promise<void>;

  // ── Movimientos ────────────────────────────
  movimientosRecientes: Movimiento[];
  refreshMovimientos: () => Promise<void>;

  // ── Categorías ─────────────────────────────
  categorias: Categoria[];
  setCategorias: (c: Categoria[]) => void;
  refreshCategorias: () => Promise<void>;
  getCategoriasByTipo: (tipo: 'ingreso' | 'egreso') => Categoria[];

  // ── App state ──────────────────────────────
  isReady: boolean;
  setIsReady: (v: boolean) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Usuario ────────────────────────────────
  usuario: null,
  setUsuario: (u) => set({ usuario: u }),

  // ── Montos ocultos ─────────────────────────
  amountsHidden: false,
  toggleAmountsHidden: () => set(s => ({ amountsHidden: !s.amountsHidden })),
  setAmountsHidden: (v) => set({ amountsHidden: v }),

  // ── Cuentas ────────────────────────────────
  cuentas: [],
  setCuentas: (c) => set({ cuentas: c }),
  refreshCuentas: async () => {
    const { usuario } = get();
    if (!usuario) return;
    try {
      const rawCuentas = await getCuentas(usuario.id);
      // Calcular saldo de cada cuenta dinámicamente
      const cuentasConSaldo = await Promise.all(
        rawCuentas.map(async (c) => ({
          ...c,
          saldo: await calcularSaldo(c.id),
        }))
      );
      set({ cuentas: cuentasConSaldo });
    } catch (e) {
      console.error('Error refreshCuentas:', e);
    }
  },

  // ── Movimientos ────────────────────────────
  movimientosRecientes: [],
  refreshMovimientos: async () => {
    const { usuario } = get();
    if (!usuario) return;
    try {
      const movs = await getMovimientos(usuario.id, { limite: 5 });
      set({ movimientosRecientes: movs });
    } catch (e) {
      console.error('Error refreshMovimientos:', e);
    }
  },

  // ── Categorías ─────────────────────────────
  categorias: [],
  setCategorias: (c) => set({ categorias: c }),
  refreshCategorias: async () => {
    const { usuario } = get();
    if (!usuario) return;
    try {
      const cats = await getCategorias(usuario.id);
      set({ categorias: cats });
    } catch (e) {
      console.error('Error refreshCategorias:', e);
    }
  },
  getCategoriasByTipo: (tipo) => {
    return get().categorias.filter(c => c.tipo === tipo);
  },

  // ── App state ──────────────────────────────
  isReady: false,
  setIsReady: (v) => set({ isReady: v }),
}));
