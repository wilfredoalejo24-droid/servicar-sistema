// Webhook de Meta WhatsApp Business API
// GET  /api/whatsapp  → verificación del webhook
// POST /api/whatsapp  → recibe mensajes entrantes

const SUPA_URL = "https://epirsbudngwbxgcsryvv.supabase.co";
const SUPA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwaXJzYnVkbmd3YnhnY3NyeXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAzNjM0OSwiZXhwIjoyMDk2NjEyMzQ5fQ.9SDQYGONsVp5NJW7oFnOAV1G--jXCjjbVC9m1b8OGrM";

const WA_TOKEN =
  "EAARlX3vlebsBRi7Gxu4VLE7Inn6Na5fHuWZC0H5Cz5WFYL2tNZCLBno4o6A3iELQch5ahwCkEN0APSYRRSFue3m4jSurR72cksk2pAIscMWfPheE7RQbMdtZBp9ZAPzr4zKkLU6DESs3oTIv7dRClJLiFWCPeT0pLMQjRCPTW5yV1U7gQtNZBQ2mbMfjipgRnCkIZAiZASYelRL7DB7mcKnvxI4wn5eqvybZB5s3ALPYreZBAGxjpogzkvADPUt3TWxAXeayAm6S0NhCxmlZBU1Jgc";
const PHONE_NUMBER_ID = "1137973286071898";
const WILFREDO_WA = "59168167264";

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
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: texto },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
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

  // Busca en OTs históricas (incluyendo entregadas)
  const ots = await sbGet(
    `ots?order=id.desc&limit=1&select=id&or=(tel.ilike.${encodeURIComponent("%" + limpio)},tel.ilike.${encodeURIComponent("%" + conPrefijo)})`
  );
  // Si no hay historial, es cliente nuevo
  return !ots || ots.length === 0;
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

    // Meta exige respuesta 200 inmediata
    res.status(200).json({ ok: true });

    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) return;

      const msg = messages[0];
      const from = msg.from; // número del remitente con código de país
      const tipo = msg.type;

      // Solo procesamos texto por ahora
      if (tipo !== "text") {
        await enviarWA(
          from,
          "Hola! Solo puedo responder mensajes de texto por el momento. Escribe tu placa o nombre para consultar el estado de tu vehículo. 🔧"
        );
        return;
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
        return;
      }

      // ── Detectar si es cliente nuevo o antiguo sin OT activa ──
      const esNuevo = await esTelNuevo(from);

      if (esNuevo) {
        await enviarWA(
          from,
          `Hola! 👋 Bienvenido a *Servi Car Platinium*.\nNo encontré un vehículo registrado con tu número.\n\nSi querés traer tu auto al taller, comunicate con nosotros:\n📞 *+${WILFREDO_WA}*\n\nEstamos en Viacha, La Paz. 🔧`
        );
      } else {
        // Cliente antiguo pero sin OT activa actualmente
        await enviarWA(
          from,
          `Hola! 👋 Revisé nuestro sistema y no tenés ningún vehículo activo en el taller en este momento.\n\nSi querés agendar un servicio o tenés alguna consulta, escribinos al:\n📞 *+${WILFREDO_WA}*\n\n_Gracias por confiar en Servi Car Platinium_ 🚗`
        );
      }
    } catch (e) {
      console.error("WhatsApp webhook error:", e.message);
      // No relanzamos — ya enviamos 200 a Meta
    }

    return;
  }

  return res.status(405).json({ error: "Método no permitido" });
}
