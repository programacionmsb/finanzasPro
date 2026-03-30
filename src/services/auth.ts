import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { getDb, getUsuario } from './db';
import { Usuario } from '../types';
import { PendingUser } from '../types/navigation';

// Necesario para cerrar el browser después del OAuth
WebBrowser.maybeCompleteAuthSession();

// ── Configuración Google OAuth ────────────────────────────────────────────
// Reemplazar con tus Client IDs de Google Cloud Console
// https://console.cloud.google.com/apis/credentials
const GOOGLE_CONFIG = {
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  webClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
};

// ── Hook de Google Sign-In (usar en LoginScreen) ──────────────────────────
export function useGoogleAuth() {
  return Google.useAuthRequest(GOOGLE_CONFIG);
}

// ── Obtener perfil de Google con el access token ──────────────────────────
export async function fetchGoogleProfile(accessToken: string): Promise<PendingUser> {
  const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('No se pudo obtener el perfil de Google');

  const data = await res.json();
  return {
    id:       data.id,
    nombre:   data.name,
    email:    data.email,
    foto_url: data.picture ?? null,
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
