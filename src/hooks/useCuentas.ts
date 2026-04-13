import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import {
  getEstadisticasPorCuenta,
  EstadisticasCuenta,
  getUltimaConciliacion,
} from '../services/db';
import { Conciliacion } from '../types';
import { toSQLiteDate } from '../utils/formatters';

function getRangoMes(): { desde: string; hasta: string } {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
  return { desde: toSQLiteDate(inicio), hasta: toSQLiteDate(ahora) };
}

export function useCuentas() {
  const { usuario, cuentas, refreshCuentas } = useAppStore();
  const [estadisticas, setEstadisticas] = useState<Map<number, EstadisticasCuenta>>(new Map());
  const [conciliaciones, setConciliaciones] = useState<Map<number, Conciliacion | null>>(new Map());
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      let mounted = true;
      setLoading(true);

      const { desde, hasta } = getRangoMes();

      refreshCuentas().then(async () => {
        if (!mounted) return;
        const { cuentas: rawCuentas } = useAppStore.getState();

        const [stats, concils] = await Promise.all([
          getEstadisticasPorCuenta(usuario.id, desde, hasta),
          Promise.all(rawCuentas.map(c => getUltimaConciliacion(c.id))),
        ]);

        if (!mounted) return;

        const statsMap = new Map(stats.map(s => [s.cuenta_origen_id, s]));
        const concilMap = new Map(rawCuentas.map((c, i) => [c.id, concils[i]]));

        setEstadisticas(statsMap);
        setConciliaciones(concilMap);
        setLoading(false);
      }).catch(() => { if (mounted) setLoading(false); });

      return () => { mounted = false; };
    }, [usuario?.id])
  );

  const saldoTotal = cuentas.reduce((sum, c) => sum + (c.saldo ?? 0), 0);

  /** ¿La última conciliación fue OK y tiene < 7 días? */
  function estaVerificada(cuentaId: number): boolean {
    const conc = conciliaciones.get(cuentaId);
    if (!conc || conc.estado !== 'coincide') return false;
    const dias = (Date.now() - new Date(conc.fecha).getTime()) / 86400000;
    return dias <= 7;
  }

  return { usuario, cuentas, estadisticas, estaVerificada, saldoTotal, loading };
}
