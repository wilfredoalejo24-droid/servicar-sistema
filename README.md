# SERVI CAR PLATINIUM — Sistema de Gestión v2.1

Sistema de gestión integral para taller automotriz en Viacha, La Paz, Bolivia.  
Frontend 100% estático con Supabase como backend. Desplegado en Vercel.

---

## Archivos del Sistema

| Archivo | Función | Acceso |
|---------|---------|--------|
| `index.html` | Login + Menú principal + Control de turno | Todos |
| `ventas.html` | Registro de ventas de tienda | Admin, Encargado, Vendedor |
| `servicios.html` | Servicios rápidos (aceite, lavado, alineado) | Admin, Encargado, Vendedor |
| `ot.html` | Lista de Órdenes de Trabajo | Admin, Encargado, Vendedor, Mecánico |
| `ot-detalle.html` | Detalle y gestión de una OT | Admin, Encargado (sus OTs: Vendedor, Mecánico) |
| `caja.html` | Apertura, cierre e informes de caja | Admin, Encargado |
| `admin.html` | Inventario, CRM, Herramientas, Personal, Facturas IA, Config API | Admin, Encargado |
| `reportes.html` | Informes diarios y por rango, exportación Excel | Admin, Encargado |
| `dashboard.html` | KPIs en tiempo real, punto de equilibrio | Admin |
| `usuarios.html` | Gestión de accesos y contraseñas | Admin |
| `cliente.html` | Portal público para clientes (consulta de OT por placa) | Público |
| `asistencia.html` | Marcado de entrada/salida de turno | Todos |
| `wilfredo-ia.html` | Panel IA con acceso total (Claude + ChatGPT) | Solo Admin (Wilfredo) |
| `asistente-trabajo.html` | Asistente IA guiado para técnicos y vendedores | Vendedor, Mecánico, Encargado |

---

## Roles y Permisos

| Rol | Usuarios | Acceso |
|-----|---------|--------|
| `admin` | Wilfredo | Todo sin límites. Único que puede BORRAR registros. |
| `encargado` | William, Selena | OTs completas, caja, admin. No puede borrar. |
| `vendedor` | Diego, Evo, Joel, Adolfo | Ventas, servicios rápidos, sus OTs asignadas. No puede borrar. |
| `mecanico` | Técnicos | Sus OTs asignadas. No puede borrar. |

### Regla de oro: SOLO Wilfredo borra
- OTs: botón eliminar solo visible con `rol=admin`
- Repuestos en OT: `borrarRepUsado()` verifica `esAdmin()`
- Servicios en OT: `borrarServicio()` verifica `esAdmin()`
- Herramientas en admin: botón eliminar solo visible con `esAdmin()`

---

## Control de Acceso por Turno

Flujo para vendedores y mecánicos:
1. Marcan **entrada** en `asistencia.html` → acceso al sistema
2. Marcan **salida** → quedan bloqueados en todos los dispositivos
3. En el próximo turno marcan entrada nuevamente
4. Wilfredo puede dar **acceso de emergencia** desde `wilfredo-ia.html` → botón "Desbloquear turno"

Administradores y encargados tienen acceso **24/7** (no se aplica bloqueo de turno).

La verificación ocurre en `index.html` al cargar después del login:
- Consulta tabla `asistencia` → último registro del usuario
- Si es "salida" → consulta tabla `acceso_especial`
- Si no hay acceso especial → muestra pantalla Bloqueado

---

## Módulos de IA

### Wilfredo IA (`wilfredo-ia.html`)
- Chat con Claude (Anthropic) o ChatGPT (OpenAI)
- Tool use: ejecuta operaciones reales en Supabase
- Comandos de ejemplo:
  - `"registra compra pastillas cerámicas costo 100 venta 200"`
  - `"agrégalo a la OT de Roberto Gómez"`
  - `"¿cuánto ganamos hoy?"`
  - `"muéstrame OTs abiertas"`
  - `"desbloquea a Diego por 4 horas"`
- Entrada por voz (Web Speech API)
- API Keys cargadas desde Supabase `config`

### Asistente de Trabajo (`asistente-trabajo.html`)
- Chat guiado para técnicos y vendedores
- Lee inventario en tiempo real
- SIEMPRE pide confirmación antes de ejecutar acciones
- NO puede borrar registros
- Limitado a operaciones del rol del usuario

### Facturas IA (en `admin.html` → pestaña Facturas IA)
- Subir foto de factura o lista de compra
- Claude lee la imagen con visión (vision API)
- Extrae productos con precios automáticamente
- Muestra tabla editable para confirmar
- Registra en inventario masivamente

---

## Configuración API Keys

En `admin.html` → pestaña **Configuración**:

1. Ingresar API Key de Claude (Anthropic): `sk-ant-api03-...`
2. Ingresar API Key de ChatGPT (OpenAI): `sk-proj-...`
3. Botón "Probar" para verificar conexión
4. Botón "Guardar" para almacenar en Supabase tabla `config`

---

## Base de Datos (Supabase)

### Tablas existentes
- `usuarios` — Cuentas del sistema (user_name, pass, nombre, rol, taller)
- `inventario` — Productos (cod, nom, marca, cat, stock, costo, precio, min)
- `ots` — Órdenes de trabajo (num, placa, cliente, marca, modelo, paso, repuestos, servicios, total)
- `caja` — Movimientos de caja (tipo, monto, descripcion, taller, fecha)
- `crm` — Historial de servicios por cliente (placa, cliente, vehiculo, ganancia_neta, capital)
- `herramientas` — Dotación de herramientas por trabajador
- `vacaciones_saldo` — Saldo de vacaciones por trabajador
- `vacaciones_solicitudes` — Solicitudes de vacaciones

### Tablas nuevas (ejecutar SQL en Supabase)

```sql
-- Configuración del sistema (API Keys de IA, etc.)
CREATE TABLE IF NOT EXISTS config (
  id SERIAL PRIMARY KEY,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Control de asistencia (entrada/salida por turno)
CREATE TABLE IF NOT EXISTS asistencia (
  id SERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  nombre TEXT,
  tipo TEXT CHECK (tipo IN ('entrada', 'salida')),
  fecha TEXT,
  hora_registro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acceso de emergencia otorgado por Wilfredo
CREATE TABLE IF NOT EXISTS acceso_especial (
  id SERIAL PRIMARY KEY,
  user_name TEXT UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT FALSE,
  motivo TEXT,
  activado_por TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

> El SQL también está disponible en `admin.html` → Configuración → botón "Copiar SQL"

---

## Supabase

- **URL:** `https://epirsbudngwbxgcsryvv.supabase.co`
- **Key (pública):** `sb_publishable_zsqvMzJMc80Ypf3UQqs-SA_IrV-XIGc`

---

## Empresa

- **Nombre:** SERVI CAR PLATINIUM
- **Ciudad:** Viacha, La Paz, Bolivia
- **Taller 1:** Av. Montes
- **Taller 2:** Bella Vista, Calle María Barzola
- **Teléfonos:** 68167264 · 60574920

---

## Stack Técnico

- **Frontend:** HTML + Vanilla JS (algunos módulos con React 18 via CDN)
- **Backend:** Supabase (PostgreSQL + API REST)
- **IA:** Anthropic Claude API + OpenAI ChatGPT API (llamadas directas desde browser)
- **Deploy:** Vercel
- **Exports:** Excel (SheetJS), CSV, PDF (print)
- **Voz:** Web Speech API (SpeechRecognition)

---

## Versiones

| Versión | Cambios |
|---------|---------|
| v1.0 | Sistema base: ventas, servicios, OTs, caja |
| v2.0 | Admin completo, reportes, dashboard, cliente portal |
| v2.1 | IA completa: wilfredo-ia, asistente-trabajo, facturas IA, config API keys, control de turno, permisos finales |
