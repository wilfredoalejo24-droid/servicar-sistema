// Vercel cron — informe semanal automático a Notion (cada domingo 22:00 Bolivia = lunes 02:00 UTC)
const SUPA_URL    = "https://epirsbudngwbxgcsryvv.supabase.co";
const SUPA_KEY    = "sb_publishable_zsqvMzJMc80Ypf3UQqs-SA_IrV-XIGc";
const NOTION_VER  = "2022-06-28";
const PAGE_WEEKLY = "37d0581972d181c2a056e9dc618d87eb";

// Formato d/m/yyyy igual que hoy() en el frontend (es-BO)
function fechaBolivia(d) {
  const b = new Date(d.getTime() - 4 * 60 * 60 * 1000); // UTC-4
  return `${b.getUTCDate()}/${b.getUTCMonth() + 1}/${b.getUTCFullYear()}`;
}

function getUltimosSieteDias() {
  const now = new Date();
  const dias = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dias.push(fechaBolivia(d));
  }
  return dias; // [ayer, anteayer, ..., hace 7 días]
}

async function supaGet(tabla, params = "") {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${tabla}?${params}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    return r.ok ? r.json() : [];
  } catch { return []; }
}

const fmt = n => `Bs. ${parseFloat(n || 0).toFixed(2)}`;

module.exports = async function handler(req, res) {
  // Vercel protege crons automáticamente en producción;
  // en local se puede llamar libremente para probar.
  try {
    // 1. Obtener Notion API key desde Supabase config
    const cfg = await supaGet("config", "clave=eq.notion_api_key&select=valor");
    const notionKey = Array.isArray(cfg) ? cfg[0]?.valor : null;
    if (!notionKey) {
      return res.status(200).json({ ok: false, msg: "Sin Notion API key en config" });
    }

    // 2. Calcular fechas de la semana pasada
    const dias = getUltimosSieteDias();
    const inicio = dias[6];
    const fin    = dias[0];

    // 3. Movimientos de caja de la semana
    const movs = await supaGet("caja", `fecha=in.(${dias.join(",")})&select=tipo,subtipo,monto`);
    const mArr = Array.isArray(movs) ? movs : [];
    const ganancia = mArr.filter(m => m.tipo === "ingreso" && m.subtipo === "ganancia_neta").reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    const capital  = mArr.filter(m => m.tipo === "ingreso" && m.subtipo === "capital_tienda").reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    const gastos   = mArr.filter(m => m.tipo === "egreso").reduce((s, m) => s + parseFloat(m.monto || 0), 0);

    // 4. OTs entregadas en la semana
    const ots = await supaGet("ots", `estado=eq.Entregada&fecha_entrega=in.(${dias.join(",")})&select=id,placa,total`);
    const otArr = Array.isArray(ots) ? ots : [];
    const totalOTs = otArr.reduce((s, o) => s + parseFloat(o.total || 0), 0);

    // 5. Stock bajo
    const inv = await supaGet("inventario", "select=nom,stock,min&order=stock.asc&limit=10");
    const bajos = (Array.isArray(inv) ? inv : []).filter(i => (i.stock || 0) <= (i.min || 2));

    // 6. Crear página en Notion
    const titulo = `Informe Semanal ${inicio} al ${fin}`;
    const filas = [
      ["Período",               `${inicio} — ${fin}`],
      ["Ganancia neta (MO)",    fmt(ganancia)],
      ["Capital (repuestos)",   fmt(capital)],
      ["Gastos de la semana",   fmt(gastos)],
      ["NETO DE LA SEMANA",     fmt(ganancia + capital - gastos)],
      ["OTs entregadas",        String(otArr.length)],
      ["Total recaudado OTs",   fmt(totalOTs)],
      ["Movimientos de caja",   String(mArr.length)],
      ["Productos stock bajo",  String(bajos.length)],
      ...(bajos.slice(0, 5).map(i => [`  • ${i.nom}`, `Stock: ${i.stock} (mín: ${i.min || 2})`])),
      ["Generado automáticamente", new Date().toISOString()],
    ];

    const r = await fetch("https://api.notion.com/v1/pages", {
      method:  "POST",
      headers: { Authorization: `Bearer ${notionKey}`, "Notion-Version": NOTION_VER, "Content-Type": "application/json" },
      body: JSON.stringify({
        parent:     { page_id: PAGE_WEEKLY },
        properties: { title: { title: [{ text: { content: titulo } }] } },
        children: filas.map(([label, val]) => ({
          object: "block", type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: `${label}: ${val}` } }] },
        })),
      }),
    });

    const rj = await r.json().catch(() => ({}));
    return res.status(200).json({ ok: r.ok, page: rj.id, title: titulo });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
