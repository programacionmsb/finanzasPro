import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { getDb, getUsuario } from './db';
import { Usuario } from '../types';
import { PendingUser } from '../types/navigation';

// ── Configuración Google Sign-In ──────────────────────────────────────────
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
console.log('[AUTH] webClientId configurado:', WEB_CLIENT_ID);
GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
});

// ── Sign-In con Google (nativo) + Firebase Auth ───────────────────────────
export async function signInWithGoogle(): Promise<PendingUser> {
  console.log('[AUTH] Verificando Play Services...');
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  console.log('[AUTH] Play Services OK, llamando signIn...');
  const response = await GoogleSignin.signIn();
  const user = response.data?.user;
  if (!user) throw new Error('No se recibió información del usuario');

  // Autenticar en Firebase Auth para que Firestore reconozca al usuario
  const idToken = response.data?.idToken;
  console.log('[AUTH] idToken presente:', !!idToken);
  let firebaseUid = user.id;
  if (idToken) {
    console.log('[AUTH] Haciendo signInWithCredential...');
    const credential = auth.GoogleAuthProvider.credential(idToken);
    const result = await auth().signInWithCredential(credential);
    firebaseUid = result.user.uid;
    console.log('[AUTH] Firebase Auth OK, uid:', firebaseUid);
  } else {
    console.warn('[AUTH] idToken es null — usando Google ID como uid');
  }

  return {
    id:       firebaseUid,
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
