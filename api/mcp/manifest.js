export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  return res.status(200).json({
    name: "Servi Car Platinium API",
    version: "1.0.0",
    description: "Consulta el estado de vehículos en reparación en Servi Car Platinium",
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
  });
}
