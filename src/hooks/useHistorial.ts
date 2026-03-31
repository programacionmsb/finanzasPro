import { useState, useCallback, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { getMovimientos, deleteMovimiento, updateMovimiento } from '../services/db';
import { eliminarMovimientoCloud } from '../services/firestore';
import { fechaAmigable } from '../utils/formatters';
import { Movimiento } from '../types';

const PAGE = 20;

export function useHistorial() {
  const { usuario, cuentas, categorias, refreshCuentas } = useAppStore();

  const [busqueda,    setBusqueda]    = useState('');
  const [debouncedQ,  setDebouncedQ]  = useState('');
  const [filtro,      setFiltro]      = useState<string>('todo');
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noHayMas,    setNoHayMas]    = useState(false);

  // ── Debounce de búsqueda ───────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(busqueda), 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  // ── Opciones de query a partir del filtro activo ───────────────────────
  function buildOptions(offset: number) {
    const tipo =
      filtro === 'ingreso' ? 'ingreso' :
      filtro === 'egreso'  ? 'egreso'  :
      undefined;
    const cuentaId =
      !tipo && filtro !== 'todo'
        ? (parseInt(filtro, 10) || undefined)
        : undefined;
    return { limite: PAGE, offset, tipo, cuentaId, busqueda: debouncedQ };
  }

  // ── Carga inicial / por cambio de filtro o búsqueda ───────────────────
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setNoHayMas(false);

      const tipo =
        filtro === 'ingreso' ? 'ingreso' :
        filtro === 'egreso'  ? 'egreso'  :
        undefined;
      const cuentaId =
        !tipo && filtro !== 'todo'
          ? (parseInt(filtro, 10) || undefined)
          : undefined;

      if (usuario) {
        getMovimientos(usuario.id, { limite: PAGE, offset: 0, tipo, cuentaId, busqueda: debouncedQ })
          .then(items => {
            if (!active) return;
            setMovimientos(items);
            setNoHayMas(items.length < PAGE);
          })
          .catch(() => {/* ignore */})
          .finally(() => { if (active) setLoading(false); });
      } else {
        setLoading(false);
      }

      return () => { active = false; };
    }, [usuario, filtro, debouncedQ])
  );

  // ── Paginación ─────────────────────────────────────────────────────────
  async function cargarMas() {
    if (!usuario || noHayMas || loadingMore) return;
    setLoadingMore(true);
    try {
      const items = await getMovimientos(usuario.id, buildOptions(movimientos.length));
      setMovimientos(prev => [...prev, ...items]);
      setNoHayMas(items.length < PAGE);
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────
  function confirmarEliminar(id: number) {
    Alert.alert(
      'Eliminar movimiento',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteMovimiento(id);
            setMovimientos(prev => prev.filter(m => m.id !== id));
            if (usuario) eliminarMovimientoCloud(usuario.id, id).catch(() => {});
            await refreshCuentas();
          },
        },
      ]
    );
  }

  // ── Actualizar ─────────────────────────────────────────────────────────
  async function actualizarMovimiento(
    id: number,
    data: { tipo: 'ingreso' | 'egreso'; monto: number; descripcion: string | null; cuenta_id: number; categoria_id: number | null; fecha: string }
  ) {
    await updateMovimiento(id, data);
    setMovimientos(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
    await refreshCuentas();
  }

  // ── Agrupación por fecha ───────────────────────────────────────────────
  const agrupados = useMemo<Array<[string, Movimiento[]]>>(() => {
    const grupos = new Map<string, Movimiento[]>();
    for (const m of movimientos) {
      const key = fechaAmigable(m.fecha);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(m);
    }
    return [...grupos.entries()];
  }, [movimientos]);

  return {
    busqueda, setBusqueda,
    filtro,   setFiltro,
    agrupados, movimientos,
    loading, loadingMore, noHayMas,
    cargarMas, confirmarEliminar, actualizarMovimiento,
    cuentas, categorias,
  };
}
