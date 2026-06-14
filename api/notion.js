export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, token, data } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token requerido' });
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };

  try {
    let url, method, body;

    if (action === 'test') {
      url = 'https://api.notion.com/v1/users/me';
      method = 'GET';
    } else if (action === 'create_page') {
      url = 'https://api.notion.com/v1/pages';
      method = 'POST';
      body = JSON.stringify(data);
    } else if (action === 'append_block') {
      url = `https://api.notion.com/v1/blocks/${data.id}/children`;
      method = 'PATCH';
      body = JSON.stringify(data.children);
    } else {
      return res.status(400).json({ error: 'Acción no válida' });
    }

    const response = await fetch(url, { method, headers, body });
    const result = await response.json();

    return res.status(response.status).json(result);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
