// POST /api/notificar-listo
// Body: { placa, cliente, marca, modelo, taller, tel, estimado_entrega }
// Retorna mensaje WhatsApp formateado + link directo

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { placa, cliente, marca, modelo, taller, tel, estimado_entrega } = req.body || {};

  if (!placa && !cliente) {
    return res.status(400).json({ error: "Se requiere placa o cliente" });
  }

  const nombre = (cliente || "cliente").split(" ")[0];
  const auto = `${marca || ""} ${modelo || ""}`.trim() || "vehículo";
  const tallerNombre = taller || "Servi Car Platinium";
  const estimado = estimado_entrega ? `\nPuedes pasar ${estimado_entrega}.` : "";

  const mensaje = `Hola ${nombre}! Tu ${auto} ${placa ? `(${placa})` : ""} ya está listo en ${tallerNombre}.${estimado}\nPuedes pasar a recogerlo cuando gustes 🔧\nCualquier consulta: 59168167264`;

  const telLimpio = tel ? "591" + tel.replace(/\D/g, "").replace(/^591/, "") : null;
  const waLink = telLimpio
    ? `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`
    : null;

  return res.status(200).json({
    ok: true,
    mensaje,
    whatsapp_link: waLink,
    tel: telLimpio || "Sin teléfono registrado",
  });
}
