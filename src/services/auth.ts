import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { getDb, getUsuario } from './db';
import { Usuario } from '../types';
import { PendingUser } from '../types/navigation';

// ── Configuración Google Sign-In ──────────────────────────────────────────
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  scopes: ['profile', 'email'],
});

// ── Sign-In con Google (nativo) ───────────────────────────────────────────
export async function signInWithGoogle(): Promise<PendingUser> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const user = response.data?.user;
  if (!user) throw new Error('No se recibió información del usuario');
  return {
    id:       user.id,
    nombre:   user.name ?? '',
    email:    user.email,
    foto_url: user.photo ?? null,
    moneda:   'PEN',
  };
}

// ── Usuario demo para pruebas sin cuenta Google ───────────────────────────
export function buildDemoUser(): PendingUser {
  return {
    id:       'demo-user-001',
    nombre:   'Usuario Demo',
    email:    'demo@finanzaspro.app',
    foto_url: null,
    moneda:   'PEN',
  };
}

// ── Leer sesión guardada (usuario más reciente en SQLite) ─────────────────
export async function getSessionUser(): Promise<Usuario | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM usuarios ORDER BY creado_en ASC LIMIT 1'
    );
    if (!row) return null;
    return getUsuario(row.id);
  } catch {
    return null;
  }
}

export { statusCodes };
