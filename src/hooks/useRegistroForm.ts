import { useState, useMemo, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { insertMovimiento } from '../services/db';
import { toSQLiteDate } from '../utils/formatters';
import { ParsedTransaction, Movimiento } from '../types';

export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia';

export interface RegistroFormState {
  tipo:             TipoMovimiento;
  monto:            string;
  descripcion:      string;
  cuentaId:         number | null;
  cuentaDestinoId:  number | null;
  categoriaId:      number | null;
  fecha:            Date;
  origen:           Movimiento['origen'];
  imagenPath:       string | null;
  datosOcr:         string | null;
}

const INITIAL: RegistroFormState = {
  tipo:             'egreso',
  monto:            '',
  descripcion:      '',
  cuentaId:         null,
  cuentaDestinoId:  null,
  categoriaId:      null,
  fecha:            new Date(),
  origen:           'manual',
  imagenPath:       null,
  datosOcr:         null,
};

export function useRegistroForm(onSaved?: () => void) {
  const { usuario, cuentas, categorias, refreshCuentas, refreshMovimientos, refreshCategorias } = useAppStore();

  // Carga categorías si aún no se han cargado (por si el usuario abrió el form sin pasar por Dashboard)
  useEffect(() => {
    if (categorias.length === 0 && usuario) {
      refreshCategorias();
    }
  }, [usuario?.id]);

  const [form, setForm]               = useState<RegistroFormState>(INITIAL);
  const [saving, setSaving]           = useState(false);
  const [categoriaReset, setCatReset] = useState(false);

  // ── Categorías filtradas por tipo ──────────────────────────────────────
  const categoriasFiltradas = useMemo(
    () => (form.tipo ? categorias.filter(c => c.tipo === form.tipo) : []),
    [form.tipo, categorias]
  );

  // ── Setters ────────────────────────────────────────────────────────────
  const setTipo = useCallback((tipo: TipoMovimiento) => {
    setForm(f => {
      const cambio = f.tipo !== tipo;
      if (cambio) setCatReset(true);
      return {
        ...f,
        tipo,
        categoriaId:    (cambio || tipo === 'transferencia') ? null : f.categoriaId,
        cuentaDestinoId: tipo !== 'transferencia' ? null : f.cuentaDestinoId,
      };
    });
  }, []);

  const setCategoria = useCallback((id: number) => {
    setCatReset(false);
    setForm(f => ({ ...f, categoriaId: id }));
  }, []);

  const setField = useCallback(<K extends keyof RegistroFormState>(
    key: K, value: RegistroFormState[K]
  ) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  /** Pre-carga el formulario con datos parseados (OCR o texto compartido) */
  const prefill = useCallback((parsed: ParsedTransaction) => {
    setForm(f => ({
      ...f,
      tipo:        parsed.tipo,
      monto:       String(parsed.monto),
      descripcion: parsed.descripcion,
      origen:      parsed.origen,
      fecha:       new Date(parsed.fecha.replace(' ', 'T')),
    }));
    setCatReset(false);
  }, []);

  const resetForm = useCallback(() => {
    setForm(INITIAL);
    setCatReset(false);
  }, []);

  // ── Guardar ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!usuario) return;

    const monto = parseFloat(form.monto.replace(',', '.'));
    if (!form.monto || isNaN(monto) || monto <= 0)
      return Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
    if (!form.cuentaId)
      return Alert.alert('Falta cuenta', 'Selecciona una cuenta.');

    if (form.tipo === 'transferencia') {
      if (!form.cuentaDestinoId)
        return Alert.alert('Falta cuenta destino', 'Selecciona la cuenta a la que transferirás.');
      if (form.cuentaId === form.cuentaDestinoId)
        return Alert.alert('Cuentas iguales', 'La cuenta origen y destino deben ser diferentes.');
    }

    setSaving(true);
    try {
      await insertMovimiento({
        usuario_id:        usuario.id,
        cuenta_id:         form.cuentaId,
        categoria_id:      form.tipo === 'transferencia' ? null : form.categoriaId,
        tipo:              form.tipo,
        monto,
        descripcion:       form.descripcion || null,
        origen:            form.origen,
        cuenta_destino_id: form.tipo === 'transferencia' ? form.cuentaDestinoId : null,
        fecha:             toSQLiteDate(form.fecha),
        imagen_path:       form.imagenPath,
        datos_ocr:         form.datosOcr,
      });

      await Promise.all([refreshCuentas(), refreshMovimientos()]);
      resetForm();
      onSaved?.();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el movimiento. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }, [form, usuario, onSaved]);

  return {
    form, setField, setTipo, setCategoria, prefill, resetForm,
    saving, handleSave, categoriasFiltradas, categoriaReset,
    cuentas, categorias,
  };
}
