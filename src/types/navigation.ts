import { NavigatorScreenParams } from '@react-navigation/native';
import { MonedaCode } from './index';

// Datos mínimos del usuario que vienen del login (Google o demo)
// antes de ser persistidos en SQLite
export interface PendingUser {
  id:       string;
  nombre:   string;
  email:    string;
  foto_url: string | null;
  moneda:   MonedaCode;
}

// ── Auth Stack ────────────────────────────────
export type AuthStackParamList = {
  Splash:     undefined;
  Login:      undefined;
  Onboarding: { usuario: PendingUser };
};

// ── Tab Navigator ────────────────────────────
export type TabParamList = {
  Dashboard:  undefined;
  Cuentas:    undefined;
  _AddButton: undefined; // placeholder — nunca navega realmente
  Categorias: undefined;
  Reportes:   undefined;
};

// ── App Stack (dentro del tab + modales) ─────
export type AppStackParamList = {
  TabNavigator:   NavigatorScreenParams<TabParamList>;
  Registro:       { modo: 'manual' | 'foto' | 'compartir' };
  Historial:      undefined;
  Ajustes:        undefined;
  Conciliacion:   { cuentaId: number };
  CategoriaForm:  { categoriaId?: number; parentId?: number; tipo?: 'ingreso' | 'egreso' };
  CuentaForm:     undefined;
  OcrMapeo:       { textoOcr: string; imagenUri: string; templateId?: string };
  OcrPlantillas:  undefined;
};

// ── Root ──────────────────────────────────────
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App:  NavigatorScreenParams<AppStackParamList>;
};
