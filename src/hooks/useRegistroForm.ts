import { useState, useMemo, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { insertMovimiento, getDb } from '../services/db';
import { subirMovimiento } from '../services/firestore';
import { Movimiento } from '../types';
import { toSQLiteDate } from '../utils/formatters';

export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia';

export interface RegistroFormState {
  tipo:              TipoMovimiento;
  monto:             string;
  descripcion:       string;
  cuentaId:          number | null;
  cuentaDestinoId:   number | null;
  categoriaId:       number | null;
  fecha:             Date;
  origen:            Movimiento['origen'];
  imagenPath:        string | null;
  datosOcr:          string | null;
  numeroOperacion:   string;
}

const INITIAL: RegistroFormState = {
  tipo:              'egreso',
  monto:             '',
  descripcion:       '',
  cuentaId:          null,
  cuentaDestinoId:   null,
  categoriaId:       null,
  fecha:             new Date(),
  origen:            'manual',
  imagenPath:        null,
  datosOcr:          null,
  numeroOperacion:   '0',
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

      // Auto-seleccionar subcategoría "Internet" cuando el tipo es ingreso
      let categoriaId = (cambio || tipo === 'transferencia') ? null : f.categoriaId;
      if (tipo === 'ingreso') {
        const internet = categorias.find(
          c => c.nombre === 'Internet' && c.tipo === 'ingreso' && c.nivel === 2
        );
        if (internet) categoriaId = internet.id;
      }

      return {
        ...f,
        tipo,
        categoriaId,
        cuentaDestinoId: tipo !== 'transferencia' ? null : f.cuentaDestinoId,
      };
    });
  }, [categorias]);

  const setCategoria = useCallback((id: number) => {
    setCatReset(false);
    setForm(f => ({ ...f, categoriaId: id }));
  }, []);

  const setField = useCallback(<K extends keyof RegistroFormState>(
    key: K, value: RegistroFormState[K]
  ) => {
    setForm(f => ({ ...f, [key]: value }));
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
        cuenta_origen_id:  form.cuentaId,
        categoria_id:      form.tipo === 'transferencia' ? null : form.categoriaId,
        tipo:              form.tipo,
        monto,
        descripcion:       form.descripcion || null,
        origen:            form.origen,
        cuenta_destino_id: form.tipo === 'transferencia' ? form.cuentaDestinoId : null,
        fecha:             toSQLiteDate(form.fecha),
        imagen_path:       form.imagenPath,
        datos_ocr:         form.datosOcr,
        numero_operacion:  form.numeroOperacion || '0',
      });

      // Subir a Firestore en segundo plano (no bloquea el guardado local)
      const db = await getDb();
      const saved = await db.getFirstAsync<Movimiento>(
        'SELECT * FROM movimientos WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
        [usuario.id]
      );
      if (saved) subirMovimiento(usuario.id, saved).catch(() => {});

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
    form, setField, setTipo, setCategoria, resetForm,
    saving, handleSave, categoriasFiltradas, categoriaReset,
    cuentas, categorias,
  };
}
