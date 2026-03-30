import { useState, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { insertMovimiento } from '../services/db';
import { toSQLiteDate } from '../utils/formatters';
import { ParsedTransaction, Movimiento } from '../types';

export type TipoMovimiento = 'ingreso' | 'egreso';

export interface RegistroFormState {
  tipo:        TipoMovimiento | null;
  monto:       string;
  descripcion: string;
  cuentaId:    number | null;
  categoriaId: number | null;
  fecha:       Date;
  origen:      Movimiento['origen'];
  imagenPath:  string | null;
  datosOcr:    string | null;
}

const INITIAL: RegistroFormState = {
  tipo:        null,
  monto:       '',
  descripcion: '',
  cuentaId:    null,
  categoriaId: null,
  fecha:       new Date(),
  origen:      'manual',
  imagenPath:  null,
  datosOcr:    null,
};

export function useRegistroForm(onSaved?: () => void) {
  const { usuario, cuentas, categorias, refreshCuentas, refreshMovimientos } = useAppStore();

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
      const cambio = f.tipo !== null && f.tipo !== tipo;
      if (cambio) setCatReset(true);
      return { ...f, tipo, categoriaId: cambio ? null : f.categoriaId };
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
    if (!form.tipo)          return Alert.alert('Falta tipo', 'Selecciona Ingreso o Egreso.');
    if (!form.monto || isNaN(monto) || monto <= 0)
                             return Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
    if (!form.cuentaId)      return Alert.alert('Falta cuenta', 'Selecciona una cuenta.');

    setSaving(true);
    try {
      await insertMovimiento({
        usuario_id:        usuario.id,
        cuenta_id:         form.cuentaId,
        categoria_id:      form.categoriaId,
        tipo:              form.tipo,
        monto,
        descripcion:       form.descripcion || null,
        origen:            form.origen,
        cuenta_destino_id: null,
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
