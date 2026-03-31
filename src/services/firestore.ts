/**
 * firestore.ts — Sincronización bidireccional con Firebase Firestore.
 * Estrategia: SQLite como caché local, Firestore como fuente de verdad en la nube.
 */

import firestore from '@react-native-firebase/firestore';
import { getDb } from './db';
import { Movimiento, Cuenta, Categoria } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────

function colMovimientos(uid: string) {
  return firestore().collection('users').doc(uid).collection('movimientos');
}
function colCuentas(uid: string) {
  return firestore().collection('users').doc(uid).collection('cuentas');
}
function colCategorias(uid: string) {
  return firestore().collection('users').doc(uid).collection('categorias');
}

// ── SUBIR datos locales → Firestore ──────────────────────────────────────

export async function subirMovimiento(uid: string, mov: Movimiento): Promise<void> {
  const { id, cuenta_nombre, categoria_nombre, categoria_path, ...data } = mov;
  await colMovimientos(uid).doc(String(id)).set(data);
}

export async function subirCuenta(uid: string, cuenta: Cuenta): Promise<void> {
  const { id, saldo, ...data } = cuenta;
  await colCuentas(uid).doc(String(id)).set(data);
}

export async function subirCategoria(uid: string, cat: Categoria): Promise<void> {
  const { id, subcategorias, ...data } = cat;
  await colCategorias(uid).doc(String(id)).set(data);
}

export async function eliminarMovimientoCloud(uid: string, id: number): Promise<void> {
  await colMovimientos(uid).doc(String(id)).delete();
}

export async function eliminarTodosLosDatosCloud(uid: string): Promise<void> {
  const eliminarColeccion = async (col: ReturnType<typeof colMovimientos>) => {
    const snap = await col.get();
    const batch = firestore().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    if (snap.docs.length > 0) await batch.commit();
  };
  await eliminarColeccion(colMovimientos(uid));
  await eliminarColeccion(colCuentas(uid));
  await eliminarColeccion(colCategorias(uid));
  await firestore().collection('users').doc(uid).delete();
}

// ── DESCARGAR Firestore → SQLite (sync al login) ──────────────────────────

export async function sincronizarDesdeFirestore(uid: string): Promise<void> {
  const db = await getDb();

  // Desactivar foreign keys durante la sync para evitar errores de orden
  await db.runAsync('PRAGMA foreign_keys = OFF');

  try {
    // ── Cuentas ──
    const cuentasSnap = await colCuentas(uid).get();
    for (const doc of cuentasSnap.docs) {
      const c = doc.data();
      await db.runAsync(
        `INSERT INTO cuentas (id, usuario_id, nombre, tipo, icono, color, saldo_inicial, activa, orden, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nombre = excluded.nombre, tipo = excluded.tipo, icono = excluded.icono,
           color = excluded.color, saldo_inicial = excluded.saldo_inicial,
           activa = excluded.activa, orden = excluded.orden`,
        [Number(doc.id), c.usuario_id, c.nombre, c.tipo, c.icono, c.color,
         c.saldo_inicial, c.activa, c.orden, c.creado_en]
      );
    }

    // ── Categorías (padres primero, luego hijos) ──
    const catsSnap = await colCategorias(uid).get();
    const cats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    cats.sort((a, b) => (a.nivel ?? 1) - (b.nivel ?? 1));
    for (const c of cats) {
      await db.runAsync(
        `INSERT INTO categorias (id, usuario_id, nombre, icono, color, tipo, parent_id, nivel, orden, activa)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nombre = excluded.nombre, icono = excluded.icono, color = excluded.color,
           tipo = excluded.tipo, parent_id = excluded.parent_id, nivel = excluded.nivel,
           orden = excluded.orden, activa = excluded.activa`,
        [Number(c.id), c.usuario_id, c.nombre, c.icono, c.color, c.tipo,
         c.parent_id ?? null, c.nivel, c.orden, c.activa]
      );
    }

    // ── Movimientos ──
    const movsSnap = await colMovimientos(uid).orderBy('fecha', 'desc').get();
    for (const doc of movsSnap.docs) {
      const m = doc.data();
      await db.runAsync(
        `INSERT INTO movimientos
           (id, usuario_id, cuenta_id, categoria_id, tipo, monto, descripcion, origen,
            cuenta_destino_id, fecha, imagen_path, datos_ocr, numero_operacion, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           monto = excluded.monto, descripcion = excluded.descripcion,
           categoria_id = excluded.categoria_id, cuenta_id = excluded.cuenta_id,
           tipo = excluded.tipo, fecha = excluded.fecha,
           numero_operacion = excluded.numero_operacion`,
        [Number(doc.id), m.usuario_id, m.cuenta_id, m.categoria_id ?? null,
         m.tipo, m.monto, m.descripcion ?? null, m.origen,
         m.cuenta_destino_id ?? null, m.fecha, m.imagen_path ?? null,
         m.datos_ocr ?? null, m.numero_operacion ?? '0', m.creado_en]
      );
    }
  } finally {
    await db.runAsync('PRAGMA foreign_keys = ON');
  }
}

// ── SUBIR todo lo local → Firestore (primera vez / migración) ────────────

export async function subirTodoAFirestore(uid: string): Promise<void> {
  const db = await getDb();

  const cuentas = await db.getAllAsync<Cuenta>('SELECT * FROM cuentas WHERE usuario_id = ?', [uid]);
  const categorias = await db.getAllAsync<Categoria>('SELECT * FROM categorias WHERE usuario_id = ?', [uid]);
  const movimientos = await db.getAllAsync<Movimiento>('SELECT * FROM movimientos WHERE usuario_id = ?', [uid]);

  const batch = firestore().batch();

  for (const c of cuentas) {
    const { id, saldo, ...data } = c;
    batch.set(colCuentas(uid).doc(String(id)), data);
  }
  for (const c of categorias) {
    const { id, subcategorias, ...data } = c;
    batch.set(colCategorias(uid).doc(String(id)), data);
  }
  // Movimientos en batches de 500 (límite de Firestore)
  for (let i = 0; i < movimientos.length; i += 400) {
    const chunk = movimientos.slice(i, i + 400);
    const chunkBatch = firestore().batch();
    for (const m of chunk) {
      const { id, cuenta_nombre, categoria_nombre, categoria_path, ...data } = m;
      chunkBatch.set(colMovimientos(uid).doc(String(id)), data);
    }
    await chunkBatch.commit();
  }

  await batch.commit();
}
