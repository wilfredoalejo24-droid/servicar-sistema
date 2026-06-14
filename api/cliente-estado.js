// API pública — ChatGPT agent consulta estado de vehículo
// GET /api/cliente-estado?placa=ABC123
// GET /api/cliente-estado?nombre=Juan
const SUPA_URL = "https://epirsbudngwbxgcsryvv.supabase.co";
const SUPA_KEY = "sb_publishable_zsqvMzJMc80Ypf3UQqs-SA_IrV-XIGc";

const PASO_LABELS = {
  1: "En recepción",
  2: "En diagnóstico",
  3: "En cotización",
  4: "Esperando aprobación del cliente",
  5: "En reparación",
  6: "Listo para entrega",
};

function mensajeCliente(ot) {
  const nombre = ot.cliente?.split(" ")[0] || "cliente";
  const auto = `${ot.marca || ""} ${ot.modelo || ""}`.trim() || "vehículo";
  const placa = ot.placa || "";
  const tecnico = ot.tecnico || "nuestro técnico";
  const taller = ot.taller || "el taller";
  const estimado = ot.estimado_entrega ? ` Estimado de entrega: ${ot.estimado_entrega}.` : "";
  const paso = ot.paso || 1;

  if (paso <= 2)
    return `Hola ${nombre}! Tu ${auto} (${placa}) está en ${taller} siendo revisado por ${tecnico}. Te avisamos cuando tengamos el diagnóstico 🔍`;
  if (paso === 3 || paso === 4)
    return `Hola ${nombre}! Ya tenemos la cotización de tu ${auto} (${placa}).${estimado} Espera nuestra confirmación 📋`;
  if (paso === 5)
    return `Hola ${nombre}! Tu ${auto} (${placa}) está siendo reparado por ${tecnico} en ${taller}.${estimado} Ya casi está listo 🔧`;
  if (paso >= 6)
    return `Hola ${nombre}! Tu ${auto} (${placa}) ya está listo en Servi Car Platinium. Puedes pasar a recogerlo cuando gustes 🚗✅`;
  return `Hola ${nombre}! Tu vehículo está en proceso. Te contactamos pronto.`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { placa, nombre } = req.query || {};

  if (!placa && !nombre) {
    return res.status(400).json({
      encontrado: false,
      mensaje: "Proporciona ?placa=ABC123 o ?nombre=Juan",
    });
  }

  try {
    let query = `${SUPA_URL}/rest/v1/ots?estado=neq.Entregada&order=id.desc&limit=5&select=id,num,placa,cliente,marca,modelo,anio,tecnico,taller,paso,estado,procedimientos,estimado_entrega,fecha`;

    if (placa) {
      const placaUp = placa.trim().toUpperCase();
      const placaNoSpace = placaUp.replace(/\s+/g, "");
      if (placaNoSpace !== placaUp) {
        // Input has spaces — search both "1478 AAA" and "1478AAA"
        query += `&or=(placa.ilike.${encodeURIComponent(placaUp)},placa.ilike.${encodeURIComponent(placaNoSpace)})`;
      } else {
        query += `&placa=ilike.${encodeURIComponent(placaUp)}`;
      }
    } else {
      query += `&cliente=ilike.${encodeURIComponent("%" + nombre.trim() + "%")}`;
    }

    const r = await fetch(query, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });

    if (!r.ok) {
      return res.status(502).json({ encontrado: false, mensaje: "Error consultando base de datos" });
    }

    const ots = await r.json();

    if (!ots || ots.length === 0) {
      return res.status(200).json({
        encontrado: false,
        mensaje: placa
          ? "No encontramos ningún vehículo activo con esa placa. ¿Está bien escrita?"
          : "No encontramos un vehículo activo con ese nombre. Si dejaste tu auto hace poco, intenta en unos minutos.",
      });
    }

    const ot = ots[0];
    const servicios = (ot.procedimientos || []).map((p) => p.nombre).join(", ") || "—";

    return res.status(200).json({
      encontrado: true,
      ot_numero: ot.num || ot.id,
      cliente: ot.cliente || "—",
      placa: ot.placa || "—",
      vehiculo: `${ot.marca || ""} ${ot.modelo || ""} ${ot.anio || ""}`.trim() || "—",
      estado: PASO_LABELS[ot.paso] || ot.estado || "—",
      paso: ot.paso || 1,
      servicio: servicios,
      tecnico: ot.tecnico || "—",
      taller: ot.taller || "—",
      fecha_entrada: ot.fecha || "—",
      estimado_entrega: ot.estimado_entrega || "Sin estimado aún",
      mensaje_cliente: mensajeCliente(ot),
    });
  } catch (e) {
    return res.status(500).json({ encontrado: false, mensaje: "Error interno", error: e.message });
  }
}
