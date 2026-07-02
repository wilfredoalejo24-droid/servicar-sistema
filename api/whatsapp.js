// Webhook de Meta WhatsApp Business API
// GET  /api/whatsapp  → verificación del webhook
// POST /api/whatsapp  → recibe mensajes entrantes

const SUPA_URL = "https://epirsbudngwbxgcsryvv.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Token de acceso WhatsApp — leído desde variable de entorno
const WA_TOKEN_FALLBACK = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = "1171710759363489";
const WILFREDO_WA = "59168167264";

// Cache del token para no consultar Supabase en cada request
let _waToken = null;
async function getWaToken() {
  if (_waToken) return _waToken;
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/config?clave=eq.whatsapp_token&select=valor&limit=1`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    if (r.ok) {
      const data = await r.json();
      if (data?.[0]?.valor) {
        _waToken = data[0].valor;
        return _waToken;
      }
    }
  } catch (_) {}
  return WA_TOKEN_FALLBACK;
}

// Token de verificación — debe coincidir con el que configurés en Meta
const VERIFY_TOKEN = "serviCarPlatinium2026";

const PASO_LABELS = {
  1: "en recepción",
  2: "en diagnóstico",
  3: "en cotización",
  4: "esperando aprobación",
  5: "en reparación",
  6: "listo para entrega",
};

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!r.ok) return null;
  return r.json();
}

async function enviarWA(to, texto) {
  const token = await getWaToken();
  if (!token) {
    console.error("enviarWA: token de WhatsApp no configurado");
    return false;
  }
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: texto },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return r.ok;
}

async function buscarOTPorTelefono(telefono) {
  // Normaliza: quita prefijo 591 si existe, busca con y sin prefijo
  const limpio = telefono.replace(/^\+?591/, "").replace(/\D/g, "");
  const conPrefijo = "591" + limpio;

  const ots = await sbGet(
    `ots?estado=neq.Entregada&order=id.desc&limit=1&select=id,num,placa,cliente,marca,modelo,anio,tecnico,taller,paso,estado,estimado_entrega,fecha&or=(tel.ilike.${encodeURIComponent("%" + limpio)},tel.ilike.${encodeURIComponent("%" + conPrefijo)})`
  );
  return ots && ots.length > 0 ? ots[0] : null;
}

async function esTelNuevo(telefono) {
  const limpio = telefono.replace(/^\+?591/, "").replace(/\D/g, "");
  const conPrefijo = "591" + limpio;
  // Columna tel existe en ambas tablas (ots y crm)
  const filtro = `or=(tel.ilike.${encodeURIComponent("%" + limpio)},tel.ilike.${encodeURIComponent("%" + conPrefijo)})`;

  // 1. Busca en ots históricas (incluyendo entregadas)
  const ots = await sbGet(`ots?${filtro}&limit=1&select=id`);
  if (ots && ots.length > 0) return false;

  // 2. Busca en crm (servicios completados y facturados)
  const crm = await sbGet(`crm?${filtro}&limit=1&select=id`);
  if (crm && crm.length > 0) return false;

  return true; // No aparece en ots ni crm → cliente nuevo
}

function mensajeEstado(ot) {
  const nombre = ot.cliente?.split(" ")[0] || "cliente";
  const auto = `${ot.marca || ""} ${ot.modelo || ""} ${ot.anio || ""}`.trim() || "vehículo";
  const placa = ot.placa || "";
  const tecnico = ot.tecnico || "nuestro técnico";
  const taller = ot.taller || "Servi Car Platinium";
  const estimado = ot.estimado_entrega ? `\n📅 Estimado de entrega: *${ot.estimado_entrega}*` : "";
  const paso = ot.paso || 1;
  const estadoLabel = PASO_LABELS[paso] || ot.estado || "en proceso";

  if (paso <= 2)
    return `Hola ${nombre}! 👋\nTu *${auto}* (placa ${placa}) está *${estadoLabel}* con ${tecnico} en ${taller}.${estimado}\nTe avisamos cuando tengamos el diagnóstico. 🔍`;
  if (paso === 3 || paso === 4)
    return `Hola ${nombre}! 👋\nTu *${auto}* (placa ${placa}) está *${estadoLabel}*.${estimado}\nEn cuanto apruebes la cotización comenzamos la reparación. 📋`;
  if (paso === 5)
    return `Hola ${nombre}! 👋\nTu *${auto}* (placa ${placa}) está *${estadoLabel}* por ${tecnico} en ${taller}.${estimado}\nYa casi está listo! 🔧`;
  if (paso >= 6)
    return `Hola ${nombre}! 🎉\nTu *${auto}* (placa ${placa}) ya está *listo* en *${taller}*.\nPuedes pasar a recogerlo cuando gustes. 🚗✅`;
  return `Hola ${nombre}! Tu vehículo (${placa}) está en proceso. Estado: *${estadoLabel}*.`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ─── Verificación del webhook (Meta lo llama una vez al configurar) ───
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verificado");
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Token inválido" });
  }

  // ─── Recepción de mensajes ───
  if (req.method === "POST") {
    const body = req.body;

    if (!SUPA_KEY) {
      return res.status(500).json({ ok: false, error: "Servicio no disponible. Configuración incompleta." });
    }

    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        return res.status(200).json({ ok: true });
      }

      const msg = messages[0];
      const from = msg.from; // número del remitente con código de país (ej: 59176119747)
      const tipo = msg.type;

      // Solo procesamos texto por ahora
      if (tipo !== "text") {
        await enviarWA(
          from,
          "Hola! Solo puedo responder mensajes de texto por el momento. Escribí tu placa o nombre para consultar el estado de tu vehículo. 🔧"
        );
        return res.status(200).json({ ok: true });
      }

      const textoEntrada = msg.text?.body?.trim() || "";

      // ── Notificar a Wilfredo ──
      const horaBolivia = new Date().toLocaleString("es-BO", {
        timeZone: "America/La_Paz",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      await enviarWA(
        WILFREDO_WA,
        `📲 *Nuevo mensaje WhatsApp*\n👤 De: +${from}\n🕐 ${horaBolivia}\n💬 "${textoEntrada}"`
      );

      // ── Buscar OT activa del remitente ──
      const ot = await buscarOTPorTelefono(from);

      if (ot) {
        // Cliente conocido con OT activa
        await enviarWA(from, mensajeEstado(ot));
        return res.status(200).json({ ok: true });
      }

      // ── Detectar si es cliente nuevo o antiguo sin OT activa ──
      // Busca en ots históricas Y en crm (servicios completados)
      const esNuevo = await esTelNuevo(from);

      if (esNuevo) {
        await enviarWA(
          from,
          `Hola! 👋 Bienvenido a *Servi Car Platinium*.\nNo encontré un vehículo registrado con tu número.\n\nSi querés traer tu auto al taller, comunicate con nosotros:\n📞 *+${WILFREDO_WA}*\n\nEstamos en Viacha, La Paz. 🔧`
        );
      } else {
        // Cliente antiguo (aparece en ots o crm) pero sin OT activa actualmente
        await enviarWA(
          from,
          `Hola! 👋 Revisé nuestro sistema y no tenés ningún vehículo activo en el taller en este momento.\n\nSi querés agendar un servicio o tenés alguna consulta, escribinos al:\n📞 *+${WILFREDO_WA}*\n\n_Gracias por confiar en Servi Car Platinium_ 🚗`
        );
      }
    } catch (e) {
      console.error("WhatsApp webhook error:", e.message);
    }

    // Meta exige siempre un 200 — se envía después de completar todo el procesamiento
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
