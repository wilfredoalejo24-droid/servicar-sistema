const SUPA_URL = "https://epirsbudngwbxgcsryvv.supabase.co";
const SUPA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwaXJzYnVkbmd3YnhnY3NyeXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAzNjM0OSwiZXhwIjoyMDk2NjEyMzQ5fQ.9SDQYGONsVp5NJW7oFnOAV1G--jXCjjbVC9m1b8OGrM";

const PASO_LABELS = {
  1: "En recepción",
  2: "En diagnóstico",
  3: "En cotización",
  4: "Esperando aprobación del cliente",
  5: "En reparación",
  6: "Listo para entrega",
};

const MCP_MANIFEST = {
  name: "Servi Car Platinium API",
  version: "1.0.0",
  tools: [
    {
      name: "consultar_estado_vehiculo",
      description:
        "Consulta el estado actual de un vehículo en Servi Car Platinium por su placa o nombre del cliente",
      parameters: {
        type: "object",
        properties: {
          placa: {
            type: "string",
            description: "Placa del vehículo a consultar (ej: ABC123 o 1478 AAA)",
          },
          nombre: {
            type: "string",
            description: "Nombre del cliente (búsqueda parcial)",
          },
        },
      },
    },
  ],
};

async function consultarVehiculo({ placa, nombre }) {
  if (!placa && !nombre) {
    return "Por favor indicá la placa del vehículo o el nombre del cliente para consultar.";
  }

  let query = `${SUPA_URL}/rest/v1/ots?estado=neq.Entregada&order=id.desc&limit=5&select=id,num,placa,cliente,marca,modelo,anio,tecnico,taller,paso,estado,servicios,estimado_entrega,fecha`;

  if (placa) {
    const placaUp = placa.trim().toUpperCase();
    const placaNoSpace = placaUp.replace(/\s+/g, "");
    if (placaNoSpace !== placaUp) {
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
    return "Hubo un error consultando la base de datos. Intenta de nuevo en un momento.";
  }

  const ots = await r.json();

  if (!ots || ots.length === 0) {
    return placa
      ? "No encontré ningún vehículo activo con esa placa. ¿Está bien escrita?"
      : "No encontré un vehículo activo con ese nombre. Si dejaste tu auto hace poco, intenta en unos minutos.";
  }

  const ot = ots[0];
  const nombreCliente = ot.cliente?.split(" ")[0] || "cliente";
  const auto = `${ot.marca || ""} ${ot.modelo || ""} ${ot.anio || ""}`.trim() || "vehículo";
  const estado = PASO_LABELS[ot.paso] || ot.estado || "en proceso";
  const tecnico = ot.tecnico || "nuestro técnico";
  const taller = ot.taller || "nuestro taller";
  const estimado = ot.estimado_entrega ? ` Estimado de entrega: ${ot.estimado_entrega}.` : "";
  const paso = ot.paso || 1;

  if (paso <= 2)
    return `Hola ${nombreCliente}! Tu ${auto} (placa ${ot.placa}) está en ${taller} siendo revisado por ${tecnico}. Estado: ${estado}.${estimado} Te avisamos cuando tengamos el diagnóstico 🔍`;
  if (paso === 3 || paso === 4)
    return `Hola ${nombreCliente}! Ya tenemos la cotización de tu ${auto} (placa ${ot.placa}). Estado: ${estado}.${estimado} Espera nuestra confirmación 📋`;
  if (paso === 5)
    return `Hola ${nombreCliente}! Tu ${auto} (placa ${ot.placa}) está siendo reparado por ${tecnico} en ${taller}. Estado: ${estado}.${estimado} Ya casi está listo 🔧`;
  if (paso >= 6)
    return `Hola ${nombreCliente}! Tu ${auto} (placa ${ot.placa}) ya está listo en Servi Car Platinium. Puedes pasar a recogerlo cuando gustes 🚗✅`;
  return `Hola ${nombreCliente}! Tu vehículo (placa ${ot.placa}) está en proceso. Estado: ${estado}. Te contactamos pronto.`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Descubrimiento MCP
  if (req.method === "GET") {
    return res.status(200).json(MCP_MANIFEST);
  }

  // Ejecutar herramienta
  if (req.method === "POST") {
    const { tool, parameters } = req.body || {};

    if (!tool) {
      return res.status(400).json({ error: "Falta el campo 'tool'" });
    }

    if (tool === "consultar_estado_vehiculo") {
      try {
        const result = await consultarVehiculo(parameters || {});
        return res.status(200).json({ result });
      } catch (e) {
        console.error("MCP error:", e.message);
        return res.status(500).json({ error: "Error interno: " + e.message });
      }
    }

    return res.status(404).json({ error: `Herramienta '${tool}' no encontrada` });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
