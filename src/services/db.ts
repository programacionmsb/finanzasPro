import * as SQLite from 'expo-sqlite';
import { Usuario, Cuenta, Categoria, Movimiento, Conciliacion } from '../types';
import { CATEGORIAS_DEFAULT } from '../constants/Categories';
import { toSQLiteDate } from '../utils/formatters';

// ──────────────────────────────────────────────
// Conexión
// ──────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('finanzaspro.db');
  }
  return _db;
}

// ──────────────────────────────────────────────
// Inicialización — crear tablas
// ──────────────────────────────────────────────

export async function initDB(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS usuarios (
      id           TEXT PRIMARY KEY,
      nombre       TEXT NOT NULL,
      email        TEXT NOT NULL UNIQUE,
      foto_url     TEXT,
      moneda       TEXT DEFAULT 'PEN',
      ocultar_montos INTEGER DEFAULT 0,
      creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cuentas (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id    TEXT NOT NULL,
      nombre        TEXT NOT NULL,
      tipo          TEXT NOT NULL,
      icono         TEXT NOT NULL,
      color         TEXT NOT NULL,
      saldo_inicial REAL DEFAULT 0,
      activa        INTEGER DEFAULT 1,
      orden         INTEGER DEFAULT 0,
      creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      nombre     TEXT NOT NULL,
      icono      TEXT NOT NULL,
      color      TEXT DEFAULT '#4A90D9',
      tipo       TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
      parent_id  INTEGER DEFAULT NULL,
      nivel      INTEGER DEFAULT 1,
      orden      INTEGER DEFAULT 0,
      activa     INTEGER DEFAULT 1,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (parent_id) REFERENCES categorias(id)
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id        TEXT NOT NULL,
      cuenta_id         INTEGER NOT NULL,
      categoria_id      INTEGER,
      tipo              TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso','transferencia')),
      monto             REAL NOT NULL,
      descripcion       TEXT,
      origen            TEXT DEFAULT 'manual',
      cuenta_destino_id INTEGER,
      fecha             DATETIME NOT NULL,
      imagen_path       TEXT,
      datos_ocr         TEXT,
      numero_operacion  TEXT DEFAULT '0',
      creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (cuenta_id) REFERENCES cuentas(id),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );

  `);

  // Migración: agregar numero_operacion si no existe (para DBs ya creadas)
  try {
    await db.execAsync(`ALTER TABLE movimientos ADD COLUMN numero_operacion TEXT DEFAULT '0'`);
  } catch { /* columna ya existe */ }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS conciliaciones (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cuenta_id  INTEGER NOT NULL,
      saldo_app  REAL NOT NULL,
      saldo_real REAL NOT NULL,
      diferencia REAL NOT NULL,
      estado     TEXT NOT NULL CHECK(estado IN ('coincide','diferencia')),
      fecha      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cuenta_id) REFERENCES cuentas(id)
    );
  `);
}

// ──────────────────────────────────────────────
// USUARIOS
// ──────────────────────────────────────────────

export async function upsertUsuario(usuario: Omit<Usuario, 'creado_en'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO usuarios (id, nombre, email, foto_url, moneda, ocultar_montos)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nombre = excluded.nombre,
       foto_url = excluded.foto_url`,
    [usuario.id, usuario.nombre, usuario.email, usuario.foto_url ?? null, usuario.moneda, usuario.ocultar_montos]
  );
}

export async function getUsuario(id: string): Promise<Usuario | null> {
  const db = await getDb();
  return await db.getFirstAsync<Usuario>('SELECT * FROM usuarios WHERE id = ?', [id]);
}

export async function updateUsuarioMoneda(id: string, moneda: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE usuarios SET moneda = ? WHERE id = ?', [moneda, id]);
}

export async function updateUsuarioOcultarMontos(id: string, ocultar: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE usuarios SET ocultar_montos = ? WHERE id = ?', [ocultar, id]);
}

// ──────────────────────────────────────────────
// CUENTAS
// ──────────────────────────────────────────────

export async function getCuentas(usuarioId: string): Promise<Cuenta[]> {
  const db = await getDb();
  return await db.getAllAsync<Cuenta>(
    'SELECT * FROM cuentas WHERE usuario_id = ? AND activa = 1 ORDER BY orden ASC',
    [usuarioId]
  );
}

export async function insertCuenta(
  cuenta: Omit<Cuenta, 'id' | 'creado_en' | 'saldo'>
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO cuentas (usuario_id, nombre, tipo, icono, color, saldo_inicial, activa, orden)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [cuenta.usuario_id, cuenta.nombre, cuenta.tipo, cuenta.icono, cuenta.color,
     cuenta.saldo_inicial, cuenta.activa, cuenta.orden]
  );
  return result.lastInsertRowId;
}

export async function updateCuenta(id: number, data: Partial<Cuenta>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id');
  const values = fields.map(k => (data as Record<string, string | number | null>)[k]);
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.runAsync(`UPDATE cuentas SET ${set} WHERE id = ?`, [...values, id]);
}

export async function deleteCuenta(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE cuentas SET activa = 0 WHERE id = ?', [id]);
}

export async function contarMovimientosCuenta(cuentaId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) as total FROM movimientos WHERE cuenta_id = ? OR cuenta_destino_id = ?',
    [cuentaId, cuentaId]
  );
  return row?.total ?? 0;
}

export async function eliminarCuentaDefinitivo(cuentaId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM movimientos WHERE cuenta_id = ? OR cuenta_destino_id = ?', [cuentaId, cuentaId]);
  await db.runAsync('DELETE FROM cuentas WHERE id = ?', [cuentaId]);
}

export async function contarMovimientosCategoria(categoriaId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) as total FROM movimientos WHERE categoria_id = ?',
    [categoriaId]
  );
  return row?.total ?? 0;
}

export async function eliminarCategoria(categoriaId: number): Promise<void> {
  const db = await getDb();
  // Desasociar movimientos de esta categoría y sus subcategorías
  const subs = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM categorias WHERE parent_id = ?', [categoriaId]
  );
  for (const sub of subs) {
    await db.runAsync('UPDATE movimientos SET categoria_id = NULL WHERE categoria_id = ?', [sub.id]);
    await db.runAsync('DELETE FROM categorias WHERE id = ?', [sub.id]);
  }
  await db.runAsync('UPDATE movimientos SET categoria_id = NULL WHERE categoria_id = ?', [categoriaId]);
  await db.runAsync('DELETE FROM categorias WHERE id = ?', [categoriaId]);
}

/**
 * Calcula el saldo actual de una cuenta dinámicamente.
 * saldo = saldo_inicial + ingresos - egresos + transferencias_recibidas - transferencias_enviadas
 */
export async function calcularSaldo(cuentaId: number): Promise<number> {
  const db = await getDb();

  const cuenta = await db.getFirstAsync<{ saldo_inicial: number }>(
    'SELECT saldo_inicial FROM cuentas WHERE id = ?', [cuentaId]
  );
  if (!cuenta) return 0;

  const ingresos = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos
     WHERE cuenta_id = ? AND tipo = 'ingreso'`, [cuentaId]
  );

  const egresos = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos
     WHERE cuenta_id = ? AND tipo = 'egreso'`, [cuentaId]
  );

  const transRecibidas = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos
     WHERE cuenta_destino_id = ? AND tipo = 'transferencia'`, [cuentaId]
  );

  const transEnviadas = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos
     WHERE cuenta_id = ? AND tipo = 'transferencia'`, [cuentaId]
  );

  return (
    cuenta.saldo_inicial +
    (ingresos?.total ?? 0) -
    (egresos?.total ?? 0) +
    (transRecibidas?.total ?? 0) -
    (transEnviadas?.total ?? 0)
  );
}

// ──────────────────────────────────────────────
// CATEGORÍAS
// ──────────────────────────────────────────────

export async function getCategorias(usuarioId: string): Promise<Categoria[]> {
  const db = await getDb();
  return await db.getAllAsync<Categoria>(
    'SELECT * FROM categorias WHERE usuario_id = ? AND activa = 1 ORDER BY orden ASC',
    [usuarioId]
  );
}

export async function insertCategoria(
  cat: Omit<Categoria, 'id' | 'subcategorias'>
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO categorias (usuario_id, nombre, icono, color, tipo, parent_id, nivel, orden, activa)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cat.usuario_id, cat.nombre, cat.icono, cat.color, cat.tipo,
     cat.parent_id ?? null, cat.nivel, cat.orden, cat.activa]
  );
  return result.lastInsertRowId;
}

export async function updateCategoria(id: number, data: Partial<Categoria>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => !['id', 'subcategorias'].includes(k));
  const values = fields.map(k => (data as Record<string, string | number | null>)[k]);
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.runAsync(`UPDATE categorias SET ${set} WHERE id = ?`, [...values, id]);
}

/**
 * Asegura que ciertas categorías existan para el usuario.
 * Se usa para agregar categorías nuevas a usuarios existentes sin borrar las suyas.
 */
export async function ensureCategoriasExtra(usuarioId: string): Promise<void> {
  const db = await getDb();

  const maxOrden = await db.getFirstAsync<{ max: number }>(
    `SELECT COALESCE(MAX(orden), 0) as max FROM categorias WHERE usuario_id = ? AND nivel = 1`,
    [usuarioId]
  );
  let orden = (maxOrden?.max ?? 0) + 1;

  for (const tipo of ['egreso', 'ingreso'] as const) {
    const existe = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM categorias WHERE usuario_id = ? AND nombre = 'Servicios' AND tipo = ? AND nivel = 1`,
      [usuarioId, tipo]
    );
    if (existe) continue;

    const parentId = await insertCategoria({
      usuario_id: usuarioId,
      nombre:     'Servicios',
      icono:      '🔧',
      color:      '#5D6D7E',
      tipo,
      parent_id:  null,
      nivel:      1,
      orden:      orden++,
      activa:     1,
    });

    await insertCategoria({
      usuario_id: usuarioId,
      nombre:     'Internet',
      icono:      '🌐',
      color:      '#5D6D7E',
      tipo,
      parent_id:  parentId,
      nivel:      2,
      orden:      0,
      activa:     1,
    });
  }
}

/**
 * Inserta las categorías por defecto para un nuevo usuario.
 */
export async function insertCategoriasDefault(usuarioId: string): Promise<void> {
  let orden = 0;
  for (const cat of CATEGORIAS_DEFAULT) {
    const parentId = await insertCategoria({
      usuario_id: usuarioId,
      nombre: cat.nombre,
      icono: cat.icono,
      color: cat.color,
      tipo: cat.tipo,
      parent_id: null,
      nivel: 1,
      orden: orden++,
      activa: 1,
    });

    let subOrden = 0;
    for (const sub of cat.subcategorias ?? []) {
      const subId = await insertCategoria({
        usuario_id: usuarioId,
        nombre: sub.nombre,
        icono: sub.icono,
        color: cat.color,
        tipo: cat.tipo,
        parent_id: parentId,
        nivel: 2,
        orden: subOrden++,
        activa: 1,
      });

      let subSubOrden = 0;
      for (const subSub of sub.subsubcategorias ?? []) {
        await insertCategoria({
          usuario_id: usuarioId,
          nombre: subSub,
          icono: sub.icono,
          color: cat.color,
          tipo: cat.tipo,
          parent_id: subId,
          nivel: 3,
          orden: subSubOrden++,
          activa: 1,
        });
      }
    }
  }
}

// ──────────────────────────────────────────────
// MOVIMIENTOS
// ──────────────────────────────────────────────

export async function getMovimientos(
  usuarioId: string,
  options?: { limite?: number; offset?: number; cuentaId?: number; tipo?: string; busqueda?: string; nroOperacion?: string }
): Promise<Movimiento[]> {
  const db = await getDb();
  const { limite = 20, offset = 0, cuentaId, tipo, busqueda, nroOperacion } = options ?? {};

  const where: string[] = ['m.usuario_id = ?'];
  const params: (string | number)[] = [usuarioId];

  if (cuentaId !== undefined) {
    where.push('m.cuenta_id = ?');
    params.push(cuentaId);
  }
  if (tipo) {
    where.push('m.tipo = ?');
    params.push(tipo);
  }
  if (nroOperacion && nroOperacion.trim() && nroOperacion.trim() !== '0') {
    where.push('m.numero_operacion = ?');
    params.push(nroOperacion.trim());
  }
  if (busqueda && busqueda.trim()) {
    const q = `%${busqueda.trim()}%`;
    where.push('(m.descripcion LIKE ? OR c.nombre LIKE ? OR m.origen LIKE ? OR m.numero_operacion LIKE ?)');
    params.push(q, q, q, q);
  }

  params.push(limite, offset);

  return await db.getAllAsync<Movimiento>(
    `SELECT m.*,
            c.nombre AS cuenta_nombre,
            cat.nombre AS categoria_nombre
     FROM movimientos m
     LEFT JOIN cuentas c ON c.id = m.cuenta_id
     LEFT JOIN categorias cat ON cat.id = m.categoria_id
     WHERE ${where.join(' AND ')}
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    params
  );
}

export async function insertMovimiento(
  mov: Omit<Movimiento, 'id' | 'creado_en' | 'cuenta_nombre' | 'categoria_nombre' | 'categoria_path'>
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO movimientos
       (usuario_id, cuenta_id, categoria_id, tipo, monto, descripcion, origen,
        cuenta_destino_id, fecha, imagen_path, datos_ocr, numero_operacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mov.usuario_id, mov.cuenta_id, mov.categoria_id ?? null, mov.tipo, mov.monto,
      mov.descripcion ?? null, mov.origen, mov.cuenta_destino_id ?? null,
      mov.fecha, mov.imagen_path ?? null, mov.datos_ocr ?? null,
      mov.numero_operacion ?? '0',
    ]
  );
  return result.lastInsertRowId;
}

export async function updateMovimiento(
  id: number,
  data: {
    tipo?: 'ingreso' | 'egreso';
    monto?: number;
    descripcion?: string | null;
    cuenta_id?: number;
    categoria_id?: number | null;
    fecha?: string;
  }
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data) as (keyof typeof data)[];
  const values = fields.map(k => data[k] ?? null);
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.runAsync(`UPDATE movimientos SET ${set} WHERE id = ?`, [...values, id]);
}

export async function deleteMovimiento(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM movimientos WHERE id = ?', [id]);
}

// ──────────────────────────────────────────────
// CONCILIACIONES
// ──────────────────────────────────────────────

export async function insertConciliacion(
  conc: Omit<Conciliacion, 'id' | 'fecha'>
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO conciliaciones (cuenta_id, saldo_app, saldo_real, diferencia, estado)
     VALUES (?, ?, ?, ?, ?)`,
    [conc.cuenta_id, conc.saldo_app, conc.saldo_real, conc.diferencia, conc.estado]
  );
}

export async function getUltimaConciliacion(cuentaId: number): Promise<Conciliacion | null> {
  const db = await getDb();
  return await db.getFirstAsync<Conciliacion>(
    'SELECT * FROM conciliaciones WHERE cuenta_id = ? ORDER BY fecha DESC LIMIT 1',
    [cuentaId]
  );
}

// ──────────────────────────────────────────────
// REPORTES
// ──────────────────────────────────────────────

export interface ResumenPeriodo {
  ingresos: number;
  egresos: number;
  balance: number;
}

export async function getResumenPeriodo(
  usuarioId: string,
  desde: string,
  hasta: string
): Promise<ResumenPeriodo> {
  const db = await getDb();

  const ingresos = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos
     WHERE usuario_id = ? AND tipo = 'ingreso' AND fecha BETWEEN ? AND ?`,
    [usuarioId, desde, hasta]
  );

  const egresos = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos
     WHERE usuario_id = ? AND tipo = 'egreso' AND fecha BETWEEN ? AND ?`,
    [usuarioId, desde, hasta]
  );

  const ing = ingresos?.total ?? 0;
  const egr = egresos?.total ?? 0;

  return { ingresos: ing, egresos: egr, balance: ing - egr };
}

// ── Estadísticas mensuales por cuenta (todas a la vez) ───────────────────

export interface EstadisticasCuenta {
  cuenta_id:       number;
  ingresos:        number;
  egresos:         number;
  num_movimientos: number;
}

export async function getEstadisticasPorCuenta(
  usuarioId: string,
  desde: string,
  hasta: string
): Promise<EstadisticasCuenta[]> {
  const db = await getDb();
  return await db.getAllAsync<EstadisticasCuenta>(
    `SELECT
       cuenta_id,
       COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
       COALESCE(SUM(CASE WHEN tipo = 'egreso'  THEN monto ELSE 0 END), 0) AS egresos,
       COUNT(*) AS num_movimientos
     FROM movimientos
     WHERE usuario_id = ?
       AND tipo IN ('ingreso','egreso')
       AND fecha BETWEEN ? AND ?
     GROUP BY cuenta_id`,
    [usuarioId, desde, hasta]
  );
}

// ── Obtener cuenta por id ─────────────────────────────────────────────────

export async function getCuentaById(id: number): Promise<Cuenta | null> {
  const db = await getDb();
  return await db.getFirstAsync<Cuenta>(
    'SELECT * FROM cuentas WHERE id = ?', [id]
  );
}

export interface GastoCategoria {
  categoria_id: number;
  categoria_nombre: string;
  icono: string;
  color: string;
  total: number;
}

export async function getGastosPorCategoria(
  usuarioId: string,
  desde: string,
  hasta: string
): Promise<GastoCategoria[]> {
  const db = await getDb();
  return await db.getAllAsync<GastoCategoria>(
    `SELECT m.categoria_id, cat.nombre AS categoria_nombre, cat.icono, cat.color,
            SUM(m.monto) AS total
     FROM movimientos m
     JOIN categorias cat ON cat.id = m.categoria_id
     WHERE m.usuario_id = ? AND m.tipo = 'egreso' AND m.fecha BETWEEN ? AND ?
     GROUP BY m.categoria_id
     ORDER BY total DESC`,
    [usuarioId, desde, hasta]
  );
}

// ── Movimientos agrupados por día (para gráficas) ─────────────────────────

export interface DatosDia {
  dia:      string;  // YYYY-MM-DD
  ingresos: number;
  egresos:  number;
}

export async function getMovimientosDiarios(
  usuarioId: string,
  desde: string,
  hasta: string
): Promise<DatosDia[]> {
  const db = await getDb();
  return await db.getAllAsync<DatosDia>(
    `SELECT
       DATE(fecha) AS dia,
       COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
       COALESCE(SUM(CASE WHEN tipo='egreso'  THEN monto ELSE 0 END), 0) AS egresos
     FROM movimientos
     WHERE usuario_id = ? AND tipo IN ('ingreso','egreso')
       AND fecha BETWEEN ? AND ?
     GROUP BY DATE(fecha)
     ORDER BY dia ASC`,
    [usuarioId, desde, hasta]
  );
}

// ── Movimientos filtrados por rango para exportación ─────────────────────

export async function getMovimientosPeriodo(
  usuarioId: string,
  desde: string,
  hasta: string
): Promise<Movimiento[]> {
  const db = await getDb();
  return await db.getAllAsync<Movimiento>(
    `SELECT m.*,
            c.nombre AS cuenta_nombre,
            cat.nombre AS categoria_nombre
     FROM movimientos m
     LEFT JOIN cuentas c ON c.id = m.cuenta_id
     LEFT JOIN categorias cat ON cat.id = m.categoria_id
     WHERE m.usuario_id = ? AND m.tipo IN ('ingreso','egreso')
       AND m.fecha BETWEEN ? AND ?
     ORDER BY m.fecha DESC`,
    [usuarioId, desde, hasta]
  );
}
