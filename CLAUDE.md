# SERVI CAR PLATINIUM — Guía para Claude Code

## Qué es este proyecto

Sistema de gestión integral para taller automotriz (Servi Car Platinium) en Viacha, La Paz, Bolivia.
Frontend 100% estático. Backend: Supabase. Deploy: Vercel.

URL: https://servicar-sistema.vercel.app

---

## Conexión Supabase

```javascript
const SB = window.supabase.createClient(
  "https://epirsbudngwbxgcsryvv.supabase.co",
  "sb_publishable_zsqvMzJMc80Ypf3UQqs-SA_IrV-XIGc"
);
```

La key publicable ya está hardcodeada en todos los archivos. Es correcta e intencional (es una anon key de Supabase).

---

## Sesión de usuario

Todos los módulos usan esta función para obtener la sesión:

```javascript
function getSession() {
  try { return JSON.parse(localStorage.getItem("scp_user")) || null; }
  catch { return null; }
}
```

El objeto `usuario` contiene: `{ id, nombre, user_name, pass, rol, taller }`

### Roles
- `admin` → Wilfredo (acceso total, único que puede borrar)
- `encargado` → William, Selena (acceso a todo excepto borrar)
- `vendedor` → Diego, Evo, Joel, Adolfo (ventas + servicios rápidos + sus OTs)
- `mecanico` → Técnicos (solo sus OTs)

---

## Convenciones del código

1. **Sin frameworks de estado** en archivos nuevos — usar vanilla JS con funciones `render()` y `actualizarContenido()`
2. **React** solo en archivos donde ya existe (ventas.html, servicios.html, index.html)
3. **Dark theme**: background `#0f172a`, cards `#1e293b`, bordes `#334155`, amarillo `#fbbf24`
4. **Formato moneda**: `fmt(n)` → `Bs. X.XX`
5. **Fecha**: `hoy()` → fecha local en español boliviano
6. **Modales**: `bottom sheet` animado con clase `.su` (slide up)

---

## Tablas Supabase

### Existentes
| Tabla | Columnas clave |
|-------|---------------|
| `usuarios` | id, nombre, user_name, pass, rol, taller |
| `inventario` | id, cod, nom, marca, cat, para, medida, stock, min, costo, precio, prov, foto |
| `ots` | id, num, placa, cliente, marca, modelo, anio, km, tel, tecnico, taller, paso, estado, repuestos (JSONB), servicios (JSONB), fotos_recepcion (JSONB), fotos_trabajo (JSONB), total, fecha, creado_por |
| `caja` | id, tipo (ingreso/egreso), monto, descripcion, taller, fecha, vendedor |
| `crm` | id, num, placa, cliente, vehiculo, marca, modelo, taller, tecnico, ganancia_neta, capital, fecha |
| `herramientas` | id, nombre, codigo, estado, fecha_entrega, obs, trabajador |
| `vacaciones_saldo` | id, trabajador, dias_totales, dias_usados, fecha_inicio, fecha_recarga |
| `vacaciones_solicitudes` | id, trabajador, fecha_inicio, fecha_fin, dias, motivo, quien_cubre, estado, aprobado_por |

### Nuevas (crear con SQL en Admin → Configuración)
| Tabla | Uso |
|-------|-----|
| `config` | API Keys de IA y configuración del sistema |
| `asistencia` | Control de entrada/salida por turno |
| `acceso_especial` | Acceso de emergencia otorgado por Wilfredo |

---

## Módulos de IA

### Llamada a Claude desde browser

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    "anthropic-dangerous-direct-browser-access": "true"  // requerido para browser
  },
  body: JSON.stringify({
    model: "claude-opus-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: HERRAMIENTAS,
    messages: conversacion
  })
});
```

### Patrón de tool use (loop)

```javascript
while (iterations < MAX) {
  const resp = await llamarClaude(conversacion);
  if (resp.stop_reason === "tool_use") {
    // ejecutar herramientas, agregar resultados, continuar
    conversacion.push({ role: "assistant", content: resp.content });
    conversacion.push({ role: "user", content: toolResults });
  } else {
    // respuesta final
    break;
  }
}
```

### Llamada con imagen (visión/facturas)

```javascript
messages: [{
  role: "user",
  content: [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Data } },
    { type: "text", text: "Extrae los productos de esta factura..." }
  ]
}]
```

---

## Control de acceso por turno

Flujo en `index.html`:
1. Login exitoso → `verificarTurno(usuario)`
2. Si rol es `admin` o `encargado` → acceso directo (24/7)
3. Consulta `acceso_especial` → si activo y no vencido → acceso
4. Consulta `asistencia` → último registro del usuario
5. Si `tipo === "salida"` → mostrar pantalla `<Bloqueado/>`
6. Wilfredo desbloquea desde `wilfredo-ia.html` → llama `gestionar_acceso_turno`

---

## Pasos de OT

```javascript
const PASOS = [
  { n: 1, label: "Recepción",   color: "#64748b" },
  { n: 2, label: "Diagnóstico", color: "#60a5fa" },
  { n: 3, label: "Cotización",  color: "#a78bfa" },
  { n: 4, label: "Aprobación",  color: "#f59e0b" },
  { n: 5, label: "Ejecución",   color: "#f97316" },
  { n: 6, label: "Entrega",     color: "#16a34a" },
];
```

---

## Reglas de seguridad

1. **SOLO Wilfredo** (rol `admin`) puede borrar cualquier registro
2. Nunca agregar botones de borrado condicionados a `encargado`
3. El asistente de trabajo (`asistente-trabajo.html`) NO tiene herramientas de borrado
4. API Keys se guardan en Supabase tabla `config`, no hardcodeadas en el código

---

## WhatsApp Numbers

```javascript
const WA_MAP = {
  wilfredo: "59168167264",
  william:  "59160574920",
  diego:    "59171080637",
  evo:      "59164065567",
  adolfo:   "59174016189",
  joel:     "59174840206"
};
```

---

## Categorías de inventario

```javascript
const CATS_INV = ["Aceites","Lubricantes","Filtros","Líquidos","Repuestos mecánicos",
                  "Repuestos electrónicos","Accesorios","Prod. lavado","Herramientas","Insumos"];

const PREF_INV = {
  "Aceites":"AC", "Lubricantes":"LB", "Filtros":"FI", "Líquidos":"LQ",
  "Repuestos mecánicos":"RM", "Repuestos electrónicos":"RE",
  "Accesorios":"ACC", "Prod. lavado":"PL", "Herramientas":"HE", "Insumos":"IN"
};
```

---

## Commits y deploy

- Rama principal: `main`
- Push a `main` → Vercel despliega automáticamente en ~1 minuto
- URL de producción: https://servicar-sistema.vercel.app
