import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { getResumenPeriodo, ResumenPeriodo } from '../services/db';
import { toSQLiteDate } from '../utils/formatters';

/** Retorna el primer y último instante del mes actual en formato SQLite */
function getRangoMesActual(): { desde: string; hasta: string } {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
  return {
    desde: toSQLiteDate(inicio),
    hasta: toSQLiteDate(ahora),
  };
}

export function useDashboard() {
  const {
    usuario,
    cuentas,
    movimientosRecientes,
    refreshCuentas,
    refreshMovimientos,
  } = useAppStore();

  const [resumen, setResumen] = useState<ResumenPeriodo>({
    ingresos: 0,
    egresos: 0,
    balance: 0,
  });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;

      let mounted = true;
      setLoading(true);

      const { desde, hasta } = getRangoMesActual();

      Promise.all([
        refreshCuentas(),
        refreshMovimientos(),
        getResumenPeriodo(usuario.id, desde, hasta),
      ])
        .then(([, , res]) => {
          if (mounted) setResumen(res);
        })
        .catch((e) => console.error('useDashboard error:', e))
        .finally(() => {
          if (mounted) setLoading(false);
        });

      return () => { mounted = false; };
    }, [usuario?.id])
  );

  const saldoTotal = cuentas.reduce((sum, c) => sum + (c.saldo ?? 0), 0);

  return {
    usuario,
    cuentas,
    movimientosRecientes,
    resumen,
    saldoTotal,
    loading,
  };
}
