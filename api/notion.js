// Vercel serverless function — proxy para Notion API (evita CORS del browser)
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, token, data } = req.body || {};
  if (!token)  return res.status(400).json({ error: "Missing token" });
  if (!action) return res.status(400).json({ error: "Missing action" });

  const HDR = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  try {
    let url, method = "GET", body;

    switch (action) {
      case "test":
        url = "https://api.notion.com/v1/users/me";
        break;
      case "create_page":
        url    = "https://api.notion.com/v1/pages";
        method = "POST";
        body   = JSON.stringify(data);
        break;
      case "append_block":
        url    = `https://api.notion.com/v1/blocks/${data.block_id}/children`;
        method = "PATCH";
        body   = JSON.stringify({ children: data.children });
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const opts = { method, headers: HDR };
    if (body) opts.body = body;

    const r    = await fetch(url, opts);
    const json = await r.json().catch(() => ({}));
    return res.status(r.status).json(json);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
