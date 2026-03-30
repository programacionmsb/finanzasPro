claude# 📱 FinanzasPro — Prompt Completo para Claude Code

> **Instrucciones para Claude Code:** Construye una aplicación móvil completa llamada **FinanzasPro** usando **React Native con Expo**. Lee este documento completo antes de escribir cualquier código. Sigue cada sección en orden y construye de forma profesional, modular y escalable.

---

## 🧱 STACK TECNOLÓGICO

- **Framework:** React Native + Expo (SDK 51+)
- **Navegación:** React Navigation v6 (Stack + Bottom Tabs)
- **Base de datos local:** SQLite vía `expo-sqlite`
- **Autenticación:** Google Sign-In vía `expo-auth-session` + `expo-web-browser`
- **OCR de imágenes:** `expo-image-picker` + API de Google Vision (o `ml-kit` vía expo plugin)
- **Gráficas:** `react-native-gifted-charts` o `victory-native`
- **Exportar PDF:** `expo-print` + `expo-sharing`
- **Exportar Excel:** `xlsx` (SheetJS)
- **Estado global:** Zustand
- **Estilos:** StyleSheet nativo de React Native (sin Tailwind)
- **Íconos:** `@expo/vector-icons` (Ionicons)
- **Fuentes:** `DM Sans` + `DM Mono` vía `expo-font` o `@expo-google-fonts`

---

## 🎨 DESIGN SYSTEM

### Paleta de colores
```js
export const Colors = {
  azul:          '#1A3C6E',
  celeste:       '#4A90D9',
  celesteLight:  '#EBF4FF',
  verde:         '#1DB87A',
  verdeLight:    '#E8F8F0',
  rojo:          '#E74C3C',
  rojoLight:     '#FDECEA',
  amarillo:      '#F39C12',
  morado:        '#7B3FE4',
  fondo:         '#F0F4F9',
  blanco:        '#FFFFFF',
  gris:          '#7A8B9A',
  texto:         '#1C2B3A',
  borde:         '#DDE6F0',
};
```

### Tipografía
- Títulos: **DM Sans Bold** (700)
- Cuerpo: **DM Sans Regular** (400) / Medium (500) / SemiBold (600)
- Montos y números: **DM Mono** (monospace, para alinear decimales)

### Componentes base reutilizables
Crear en `/src/components/ui/`:
- `Card.tsx` — tarjeta con borde redondeado y sombra suave
- `Badge.tsx` — etiqueta de color (ingreso/egreso/pendiente)
- `Button.tsx` — botón primario con gradiente azul, secundario outline
- `Input.tsx` — campo de texto con label, foco azul
- `MontoText.tsx` — texto de monto que respeta el estado ocultar/mostrar
- `SectionTitle.tsx` — título de sección en mayúsculas + gris
- `BottomSheet.tsx` — panel deslizante desde abajo con overlay
- `Toast.tsx` — notificación flotante temporal (éxito/error)

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS (SQLite)

### Tabla: `usuarios`
```sql
CREATE TABLE usuarios (
  id           TEXT PRIMARY KEY,  -- Google UID
  nombre       TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  foto_url     TEXT,
  moneda       TEXT DEFAULT 'PEN', -- PEN, USD, EUR
  ocultar_montos INTEGER DEFAULT 0,
  creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `cuentas`
```sql
CREATE TABLE cuentas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   TEXT NOT NULL,
  nombre       TEXT NOT NULL,       -- BCP, Interbank, Efectivo…
  tipo         TEXT NOT NULL,       -- banco | efectivo | otro
  icono        TEXT NOT NULL,       -- emoji
  color        TEXT NOT NULL,       -- hex
  saldo_inicial REAL DEFAULT 0,
  activa       INTEGER DEFAULT 1,
  orden        INTEGER DEFAULT 0,
  creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
```

### Tabla: `categorias`
```sql
CREATE TABLE categorias (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   TEXT NOT NULL,
  nombre       TEXT NOT NULL,
  icono        TEXT NOT NULL,
  color        TEXT DEFAULT '#4A90D9',
  tipo         TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
  parent_id    INTEGER DEFAULT NULL,   -- NULL = categoría raíz
  nivel        INTEGER DEFAULT 1,      -- 1=categoría, 2=subcategoría, 3=sub-subcategoría
  orden        INTEGER DEFAULT 0,
  activa       INTEGER DEFAULT 1,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (parent_id) REFERENCES categorias(id)
);
```

### Tabla: `movimientos`
```sql
CREATE TABLE movimientos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     TEXT NOT NULL,
  cuenta_id      INTEGER NOT NULL,
  categoria_id   INTEGER,
  tipo           TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso','transferencia')),
  monto          REAL NOT NULL,
  descripcion    TEXT,
  origen         TEXT DEFAULT 'manual', -- manual | yape | plin | bcp | interbank | bbva | foto | compartir
  cuenta_destino_id INTEGER,            -- solo para transferencias internas
  fecha          DATETIME NOT NULL,
  imagen_path    TEXT,                  -- ruta local de la imagen si se registró por foto
  datos_ocr      TEXT,                  -- JSON con los datos extraídos por OCR
  creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (cuenta_id) REFERENCES cuentas(id),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);
```

### Tabla: `conciliaciones`
```sql
CREATE TABLE conciliaciones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cuenta_id    INTEGER NOT NULL,
  saldo_app    REAL NOT NULL,
  saldo_real   REAL NOT NULL,
  diferencia   REAL NOT NULL,
  estado       TEXT NOT NULL CHECK(estado IN ('coincide','diferencia')),
  fecha        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cuenta_id) REFERENCES cuentas(id)
);
```

---

## 📁 ESTRUCTURA DE CARPETAS

```
/src
  /assets
    /fonts
  /components
    /ui          ← componentes genéricos reutilizables
    /forms       ← formularios complejos
    /charts      ← gráficas
  /screens
    /auth        ← Splash, Login, Onboarding
    /dashboard   ← Pantalla principal
    /cuentas     ← Lista y detalle de cuentas
    /registro    ← Nuevo movimiento (3 modos)
    /historial   ← Lista de movimientos
    /categorias  ← Gestión de categorías
    /reportes    ← Gráficas y estadísticas
    /ajustes     ← Configuración de usuario
  /navigation    ← Stack + Tab navigators
  /store         ← Zustand stores
  /services
    /db.ts       ← SQLite queries
    /auth.ts     ← Google Sign-In
    /ocr.ts      ← Procesamiento de imágenes
    /parser.ts   ← Parseo de textos Yape/Plin/bancos
    /export.ts   ← PDF y Excel
  /hooks         ← Custom hooks
  /utils         ← Helpers, formatters
  /constants     ← Colors, Fonts, Categories defaults
  /types         ← TypeScript interfaces
```

---

## 🔐 MÓDULO 1 — AUTENTICACIÓN

### Pantallas: `Splash`, `Login`, `Onboarding`

### Splash (`/screens/auth/SplashScreen.tsx`)
- Fondo: gradiente azul oscuro `#0F2547` → `#2A5BA8`
- Logo emoji 💰 con animación `scale` de entrada (spring)
- Nombre de la app y tagline
- Auto-redirige a Login después de **1.8 segundos**
- Si el usuario ya tiene sesión guardada → ir directo a Dashboard

### Login (`/screens/auth/LoginScreen.tsx`)
- Header curvo con gradiente azul y logo centrado
- Lista de 3 features con ícono + descripción:
  - 🏦 Múltiples cuentas
  - 🟣 Registro desde Yape / Plin
  - 📊 Reportes y conciliación
- **Botón "Continuar con Google"**: ícono G multicolor + texto, borde suave, sombra
- Separador "o"
- **Botón "Ver demo"**: gradiente azul, accede sin cuenta
- Pie de página con términos y privacidad
- Al hacer login exitoso con Google → guardar `uid`, `name`, `email`, `photoURL` en SQLite → ir a Onboarding si es primera vez, o a Dashboard si ya existe

### Onboarding (`/screens/auth/OnboardingScreen.tsx`)
- **Barra de progreso**: 3 segmentos tipo pill, el actual se ilumina
- **Paso 1 — Moneda:** Opciones seleccionables con bandera + nombre + código. Opciones: 🇵🇪 Sol (S/), 🇺🇸 Dólar ($), 🇪🇺 Euro (€). Por defecto Sol.
- **Paso 2 — Cuentas:** Grid 2×3 con opciones de bancos (Efectivo, BCP, Interbank, BBVA, Scotiabank, Caja Piura). Selección múltiple con check visible. Campo de texto + botón para agregar cuenta personalizada.
- **Paso 3 — Saldos iniciales:** Lista de las cuentas seleccionadas. Cada una con ícono + nombre + campo numérico `DM Mono` para ingresar el saldo actual. Tip azul: "Puedes ingresar 0 si no sabes el saldo exacto ahora."
- Botones: "Continuar →" (primario) y "← Atrás" (ghost)
- Al finalizar → crear registros en `usuarios`, `cuentas`, insertar categorías por defecto → ir a Dashboard

---

## 🏠 MÓDULO 2 — DASHBOARD

### Archivo: `/screens/dashboard/DashboardScreen.tsx`

### Header (fondo gradiente azul)
- Fila superior:
  - Izquierda: avatar circular con inicial del nombre + "Bienvenido de vuelta" + nombre del usuario
  - Derecha: botón 👁️ (ocultar/mostrar montos) + botón 🔔 (notificaciones)
- **Tarjeta de saldo total** (fondo blanco translúcido, blur):
  - Label "Saldo total" en mayúsculas pequeñas
  - Monto grande en `DM Mono` (ej: S/ 2,350.00)
  - Dos chips: ↑ Ingresos (verde) y ↓ Egresos (rojo)

### Cuerpo scrollable
- **Sección "Mis cuentas":** ScrollView horizontal con tarjetas mini por cada cuenta activa. Cada tarjeta: ícono + nombre + saldo + estado de verificación (✅ OK / ⚠️ Pendiente). Al tocar → ir a pantalla de Cuentas.
- **Sección "Últimos movimientos":** Lista de los últimos 5 movimientos. Cada ítem: ícono de origen, nombre/descripción, subcategoría completa (ej: 🍔 Alimentación › Almuerzo), monto con color (verde/rojo), etiqueta de cuenta.

### Funcionalidad ocultar/mostrar montos
- Estado global en Zustand: `amountsHidden: boolean`
- Al activar: todos los componentes `<MontoText>` aplican `blur` o reemplazan texto con `••••••`
- El estado persiste en SQLite (columna `ocultar_montos` del usuario)

---

## 🏦 MÓDULO 3 — CUENTAS

### Pantalla lista (`/screens/cuentas/CuentasScreen.tsx`)
- **Banner superior** con gradiente azul: "Patrimonio total", monto total sumado, cantidad de cuentas activas y verificadas
- **Tarjeta por cuenta** con borde izquierdo de color según banco:
  - BCP → rojo `#E74C3C`
  - Interbank → naranja `#E67E22`
  - BBVA → azul oscuro `#1A5276`
  - Efectivo → verde `#1DB87A`
  - Otras → celeste
  - Contenido: ícono + nombre + tipo + saldo + estado verificación
  - Stats: ingresos del mes, egresos del mes, nº movimientos
  - Botón "🔍 Verificar saldo"
- **Botón "+ Agregar cuenta"**: borde punteado, estilo dashed

### Pantalla verificar saldo (`/screens/cuentas/ConciliacionScreen.tsx`)
- Header con nombre de cuenta
- Tarjeta con ícono, nombre, saldo calculado por la app
- Sección "¿Cuánto ves en tu app del banco?": campo numérico grande en `DM Mono`
- Botón "VERIFICAR AHORA"
- Resultado:
  - ✅ Verde si coincide exactamente
  - ⚠️ Amarillo si hay diferencia, mostrando el monto de diferencia en rojo/verde
- Lista de últimos movimientos de esa cuenta
- Guardar resultado en tabla `conciliaciones`

---

## ➕ MÓDULO 4 — REGISTRO DE MOVIMIENTOS

### Bottom Sheet de selección de modo
Al tocar el botón ➕ central del tab bar, se abre un `BottomSheet` con 3 opciones:
1. **📤 Compartir desde app** — para recibir texto desde Yape, Plin, apps bancarias
2. **📷 Desde foto / galería** — seleccionar captura de pantalla para OCR
3. **✍️ Ingresar manualmente** — formulario directo

### Pantalla de registro (`/screens/registro/RegistroScreen.tsx`)
3 tabs en la parte superior: `📤 Compartir`, `📷 Foto`, `✍️ Manual`

---

#### Modo 1: Compartir (`SharePanel.tsx`)

**Configuración como Share Target:**
- En `app.json`/`app.config.js`, registrar la app como objetivo de compartir (`intentFilters` en Android, `Share Extension` en iOS)
- Recibir texto plano compartido desde otras apps

**Parser de texto** (`/services/parser.ts`):
Detectar el origen y extraer datos según estos patrones:

```typescript
// YAPE
// Ingreso: "¡Te yaperon!", "te envió"
// Egreso: "Yapeo exitoso", "Le enviaste"
// Monto: /S\/\s*([\d,]+\.?\d*)/
// Persona: línea siguiente al monto
// Fecha: /\d{2}\/\d{2}\/\d{4}/
// Op: /Operación N[°º]?:?\s*(\d+)/

// PLIN
// Ingreso: "Recibiste"
// Egreso: "Enviaste"
// Banco: línea "Banco: NOMBRE"

// BCP SMS
// Patrón: /BCP:\s*(Retiro|Transferencia|Deposito)\s*S\/([\d.]+)/

// INTERBANK
// Patrón: /Interbank:\s*Pagaste\s*S\/\s*([\d.]+)/

// BBVA
// Patrón: /BBVA\s*\|\s*Transferencia\s*(enviada|recibida)/
```

**UI del panel:**
- Tarjeta "Detectado desde [Yape/Plin/BCP]" con datos extraídos
- Monto grande en `DM Mono`
- Nombre de persona, fecha, número de operación
- Botones tipo/ingreso-egreso (ver reglas de filtrado abajo)
- Selector de cuenta (pre-seleccionado según banco detectado)
- Selector de categoría filtrado (ver reglas abajo)
- Campo de nota opcional
- Botón GUARDAR

---

#### Modo 2: Foto / Galería (`FotoPanel.tsx`)

**Grid de últimas 6 imágenes:**
- Usar `expo-image-picker` con `mediaTypes: 'images'`, `quality: 0.8`
- Mostrar miniaturas en grid 3×2
- Al seleccionar → mostrar borde azul en la seleccionada
- Botones adicionales: "📂 Ver galería" y "📷 Cámara"

**OCR:**
- Enviar imagen a **Google Cloud Vision API** (texto: `TEXT_DETECTION`)
- O usar `@react-native-ml-kit/text-recognition` para on-device
- Extraer texto y pasarlo por el mismo `parser.ts`
- Mostrar banner "🔍 Detectado: S/ 80.00 · Plin · Egreso · 06/03"

**Formulario post-OCR:** igual al modo Compartir

---

#### Modo 3: Manual (`ManualPanel.tsx`)

- Campo de monto grande (`DM Mono`, teclado numérico, alineado a la derecha)
- Botones ingreso/egreso
- Selector de cuenta
- Selector de categoría filtrado
- Campo de fecha (DatePicker nativo)
- Campo de nota
- Botón GUARDAR

---

### 🔑 REGLA CRÍTICA: Filtrado de categorías por tipo

```typescript
// En el store o hook useCategorias:
const categoriasFiltradas = useMemo(() => {
  if (!tipoSeleccionado) return [];
  return categorias.filter(cat => cat.tipo === tipoSeleccionado);
}, [tipoSeleccionado, categorias]);

// Si el usuario cambia de tipo (ingreso ↔ egreso):
// 1. Limpiar la categoría seleccionada
// 2. Mostrar aviso: "⚠️ Categoría reiniciada — selecciona una nueva"
// 3. El selector de categoría muestra solo las del nuevo tipo
```

**Selector de categoría en cascada (3 niveles):**
- Nivel 1: Lista de categorías raíz del tipo seleccionado
- Al tocar una con subcategorías → expandir para mostrar sus hijos
- Al tocar una subcategoría con sub-subcategorías → expandir segundo nivel
- Al tocar la opción final → cerrar dropdown y mostrar el path completo: `🍔 Alimentación › Restaurantes › Almuerzo`
- Si no hay tipo seleccionado → mostrar mensaje "⚠️ Selecciona primero ↑ Ingreso o ↓ Egreso"

---

## 📋 MÓDULO 5 — HISTORIAL

### Pantalla (`/screens/historial/HistorialScreen.tsx`)

- Header con buscador (ícono 🔍)
- **Chips de filtro** scrollables horizontalmente:
  - Todo / Ingresos / Egresos / [Nombre de cada cuenta activa]
- Lista agrupada por fecha (hoy, ayer, fecha específica)
- Cada ítem: ícono origen, nombre, subcategoría completa con breadcrumb, monto, cuenta
- Soporte para **scroll infinito** / paginación de 20 en 20
- Swipe to delete (con confirmación)

---

## 🗂️ MÓDULO 6 — CATEGORÍAS

### Pantalla (`/screens/categorias/CategoriasScreen.tsx`)

- Tabs: **↓ Egresos** | **↑ Ingresos**
- Lista de categorías raíz con badge de tipo (rojo "Egreso" / verde "Ingreso")
- Cada categoría expandible al tocar (acordeón):
  - Muestra sus subcategorías
  - Cada subcategoría también expandible → muestra sub-subcategorías
- Iconos de editar ✏️ en cada nivel
- Botón "＋ Agregar subcategoría" al final de cada grupo
- Botón "+ Nueva categoría" flotante o en el header
- Pantalla de creación/edición:
  - Campo nombre
  - Selector de emoji para el ícono
  - Selector de color
  - Selector de tipo (ingreso / egreso) — solo para nivel 1
  - Selector de categoría padre — para niveles 2 y 3

### Categorías por defecto (insertar en onboarding)

**Egresos:**
- 🍔 Alimentación → Restaurantes (Desayuno, Almuerzo, Cena), Supermercado, Cafeterías
- 🚗 Transporte → Taxi/Uber, Bus/Metro, Combustible
- 🏠 Hogar → Alquiler, Servicios básicos (Luz, Agua, Internet)
- 🏥 Salud → Medicamentos, Consultas médicas
- 🎮 Ocio → Streaming, Salidas (Cine, Bares, Conciertos)
- 📦 Compras → Ropa, Tecnología
- 📚 Educación → Cursos, Libros

**Ingresos:**
- 💼 Trabajo → Salario, Freelance, Bonos
- 💸 Transferencias recibidas → Yape recibido, Plin recibido, Transferencia bancaria
- 🎁 Otros → Regalo, Devolución, Venta de objeto

---

## 📊 MÓDULO 7 — REPORTES

### Pantalla (`/screens/reportes/ReportesScreen.tsx`)

- Selector de período: Semana / Mes / Año con DatePicker
- **Tarjeta resumen:** Ingresos totales (verde), Egresos totales (rojo), Balance (azul)
- **Gráfica de barras dobles** por semana/mes: barras verdes (ingresos) + rojas (egresos)
- **Gráfica de dona** por categorías de egresos
- **Lista de gastos por categoría** con barra de progreso proporcional y monto
- **Lista de ingresos por categoría** con barra de progreso verde
- **Gastos por cuenta** con barra proporcional y color por banco
- Botones "📄 Exportar PDF" y "📊 Exportar Excel"

### Exportar PDF (`/services/export.ts`)
- Usar `expo-print` para generar HTML → PDF
- Incluir: período, resumen, tabla de movimientos, gráficas (como imágenes base64)
- Usar `expo-sharing` para compartir el PDF

### Exportar Excel
- Usar `xlsx` (SheetJS)
- Hoja 1: Movimientos del período
- Hoja 2: Resumen por categorías
- Hoja 3: Saldos por cuenta

---

## ⚙️ MÓDULO 8 — AJUSTES

### Pantalla (`/screens/ajustes/AjustesScreen.tsx`)

- Avatar + nombre + email del usuario
- Secciones:
  - **Preferencias:** Moneda, Ocultar montos por defecto
  - **Cuentas:** Acceso rápido a gestión de cuentas
  - **Categorías:** Acceso rápido
  - **Seguridad:** PIN / biometría (futuro)
  - **Exportar datos:** PDF / Excel del historial completo
  - **Acerca de:** versión, términos, privacidad
  - **Cerrar sesión:** con confirmación modal

---

## 🗺️ MÓDULO 9 — NAVEGACIÓN

### Tab Bar inferior (`/navigation/TabNavigator.tsx`)
- 5 tabs con ícono + label:
  - 🏠 Inicio → DashboardScreen
  - 🏦 Cuentas → CuentasScreen
  - ➕ (botón central grande con gradiente, elevado, border-radius 15) → abre BottomSheet
  - 🗂️ Categorías → CategoriasScreen
  - 📊 Reportes → ReportesScreen
- El botón central NO es un tab real, es un `TouchableOpacity` personalizado que abre el BottomSheet de registro

### Stack principal (`/navigation/AppNavigator.tsx`)
```
AuthStack (sin tab bar):
  - SplashScreen
  - LoginScreen
  - OnboardingScreen

AppStack (con tab bar):
  - TabNavigator
    - DashboardScreen
    - CuentasScreen → ConciliacionScreen
    - CategoriasScreen → CategoriaFormScreen
    - ReportesScreen
  - RegistroScreen (modal full-screen, sin tab bar)
  - HistorialScreen
  - AjustesScreen
```

---

## 🔒 MÓDULO 10 — ESTADO GLOBAL (Zustand)

```typescript
// /store/useAppStore.ts
interface AppStore {
  // Usuario
  usuario: Usuario | null;
  setUsuario: (u: Usuario | null) => void;

  // Montos
  amountsHidden: boolean;
  toggleAmountsHidden: () => void;

  // Cuentas
  cuentas: Cuenta[];
  setCuentas: (c: Cuenta[]) => void;
  refreshCuentas: () => Promise<void>;

  // Movimientos
  movimientosRecientes: Movimiento[];
  refreshMovimientos: () => Promise<void>;

  // Categorías
  categorias: Categoria[];
  setCategorias: (c: Categoria[]) => void;
  getCategoriasByTipo: (tipo: 'ingreso' | 'egreso') => Categoria[];
}
```

---

## 📐 REGLAS DE DESARROLLO

1. **TypeScript estricto** — todas las interfaces en `/types/index.ts`
2. **Sin any** — tipar todo correctamente
3. **Componentes funcionales** con hooks, sin clases
4. **Separación de responsabilidades:**
   - Pantallas: solo composición de componentes + llamadas al store
   - Servicios: toda la lógica de negocio y BD
   - Hooks: lógica reutilizable de UI
5. **Manejo de errores** — try/catch en todas las operaciones de BD y red
6. **Loading states** — mostrar indicadores de carga en operaciones async
7. **Accesibilidad** — usar `accessibilityLabel` en botones sin texto visible
8. **Consistencia visual** — usar siempre el Design System definido arriba, nunca hardcodear colores
9. **Responsive** — usar `Dimensions` y `%` donde sea necesario para funcionar en diferentes tamaños
10. **Comentarios** — comentar funciones complejas especialmente el parser y el OCR

---

## 🚀 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. Setup del proyecto (Expo, dependencias, estructura de carpetas)
2. Design System y componentes base UI
3. Base de datos SQLite (crear tablas, funciones CRUD)
4. Zustand store
5. Autenticación (Splash → Login → Onboarding)
6. Navegación completa (stacks + tabs)
7. Dashboard
8. Módulo de Cuentas + Conciliación
9. Módulo de Registro (Manual primero, luego Foto, luego Compartir)
10. Historial
11. Categorías
12. Reportes + Exportación
13. Ajustes
14. Pulir animaciones, transiciones y detalles visuales

---

## 📝 NOTAS ADICIONALES IMPORTANTES

- **Perú como mercado principal:** La moneda por defecto es Soles (S/), los bancos principales son BCP, Interbank, BBVA, Scotiabank y Caja Piura. Los parsers deben priorizar el formato de Yape y Plin (apps muy usadas en Perú).
- **Offline first:** La app debe funcionar completamente sin internet. Solo el login y el OCR requieren conexión.
- **Privacidad:** Los datos financieros NUNCA salen del dispositivo salvo exportación explícita del usuario. No hay sincronización con servidores propios.
- **Transferencias internas:** Cuando se registra un retiro de BCP para tener efectivo, debe registrarse como `tipo: 'transferencia'` con `cuenta_id` (origen) y `cuenta_destino_id` (destino). Esto NO debe contar como ingreso ni egreso en los reportes.
- **Saldo calculado:** El saldo de cada cuenta = `saldo_inicial` + suma de ingresos - suma de egresos + transferencias recibidas - transferencias enviadas. Nunca almacenar el saldo calculado directamente, siempre calcularlo dinámicamente.
- **Fechas:** Usar `YYYY-MM-DD HH:mm:ss` para SQLite. Mostrar en formato `DD/MM/YYYY` en la UI.

---

*Versión del documento: 1.0 — Generado desde prototipo FinanzasPro v4*
