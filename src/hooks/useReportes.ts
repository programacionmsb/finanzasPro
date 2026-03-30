import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import {
  getResumenPeriodo, getGastosPorCategoria, getEstadisticasPorCuenta,
  getMovimientosDiarios, getMovimientosPeriodo,
  ResumenPeriodo, GastoCategoria, EstadisticasCuenta, DatosDia,
} from '../services/db';
import { toSQLiteDate } from '../utils/formatters';
import { Movimiento } from '../types';

export type Periodo = 'semana' | 'mes' | 'año';

export interface BarBucket {
  label:    string;
  ingresos: number;
  egresos:  number;
}

function computeRango(p: Periodo): { desde: string; hasta: string } {
  const now   = new Date();
  const hasta = toSQLiteDate(now);
  let desde: Date;
  if (p === 'semana') {
    desde = new Date(now);
    desde.setDate(desde.getDate() - 6);
    desde.setHours(0, 0, 0, 0);
  } else if (p === 'mes') {
    desde = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    desde = new Date(now.getFullYear(), 0, 1);
  }
  return { desde: toSQLiteDate(desde), hasta };
}

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIAS_CORTOS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function agruparParaChart(dias: DatosDia[], periodo: Periodo): BarBucket[] {
  if (periodo === 'semana') {
    // 7 days, one bucket per day
    return dias.map(d => {
      const date = new Date(d.dia + 'T00:00:00');
      return { label: DIAS_CORTOS[date.getDay()], ingresos: d.ingresos, egresos: d.egresos };
    });
  }

  if (periodo === 'mes') {
    // Group by week of month (1-5)
    const semanas: Record<number, BarBucket> = {};
    for (const d of dias) {
      const day = parseInt(d.dia.substring(8, 10), 10);
      const semana = Math.ceil(day / 7);
      if (!semanas[semana]) semanas[semana] = { label: `Sem ${semana}`, ingresos: 0, egresos: 0 };
      semanas[semana].ingresos += d.ingresos;
      semanas[semana].egresos  += d.egresos;
    }
    return Object.values(semanas);
  }

  // año: group by month
  const meses: Record<string, BarBucket> = {};
  for (const d of dias) {
    const key = d.dia.substring(0, 7);
    const mes = parseInt(d.dia.substring(5, 7), 10) - 1;
    if (!meses[key]) meses[key] = { label: MESES_CORTOS[mes], ingresos: 0, egresos: 0 };
    meses[key].ingresos += d.ingresos;
    meses[key].egresos  += d.egresos;
  }
  return Object.values(meses);
}

export function useReportes() {
  const { usuario, cuentas } = useAppStore();

  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [loading, setLoading] = useState(true);
  const [resumen,      setResumen]      = useState<ResumenPeriodo>({ ingresos: 0, egresos: 0, balance: 0 });
  const [gastosCat,    setGastosCat]    = useState<GastoCategoria[]>([]);
  const [estadCuentas, setEstadCuentas] = useState<EstadisticasCuenta[]>([]);
  const [diasData,     setDiasData]     = useState<DatosDia[]>([]);
  const [movimientos,  setMovimientos]  = useState<Movimiento[]>([]);

  const { desde, hasta } = useMemo(() => computeRango(periodo), [periodo]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      if (!usuario) { setLoading(false); return; }

      Promise.all([
        getResumenPeriodo(usuario.id, desde, hasta),
        getGastosPorCategoria(usuario.id, desde, hasta),
        getEstadisticasPorCuenta(usuario.id, desde, hasta),
        getMovimientosDiarios(usuario.id, desde, hasta),
        getMovimientosPeriodo(usuario.id, desde, hasta),
      ]).then(([res, gastos, stats, dias, movs]) => {
        if (!active) return;
        setResumen(res);
        setGastosCat(gastos);
        setEstadCuentas(stats);
        setDiasData(dias);
        setMovimientos(movs);
      }).catch(() => {
        /* ignore */
      }).finally(() => {
        if (active) setLoading(false);
      });

      return () => { active = false; };
    }, [usuario, desde, hasta])
  );

  const barBuckets = useMemo(
    () => agruparParaChart(diasData, periodo),
    [diasData, periodo]
  );

  return {
    periodo, setPeriodo,
    desde, hasta,
    loading,
    resumen,
    gastosCat,
    estadCuentas,
    barBuckets,
    movimientos,
    cuentas,
    usuario,
  };
}
