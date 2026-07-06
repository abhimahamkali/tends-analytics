const BASE  = 'appk6C18dNxzJvss7';
const CAFES = 'tblzyyZTGMH7b7meW';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return res.status(500).json({ error: 'No AIRTABLE_PAT' });

  const name = String((req.body || {}).name || '').trim();
  if (!name) return res.status(400).json({ error: 'Cafe name is required' });
  if (name.length > 60) return res.status(400).json({ error: 'Cafe name is too long' });

  const headers = { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' };

  // Check for an existing cafe with the same name (case-insensitive) so we never create duplicates.
  const listRes  = await fetch(`https://api.airtable.com/v0/${BASE}/${CAFES}?pageSize=100`, { headers });
  const listJson = await listRes.json();
  const existing = (listJson.records || []).find(
    r => (r.fields['Name'] || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    return res.status(200).json({ ok: true, name: existing.fields['Name'], duplicate: true });
  }

  const createRes = await fetch(`https://api.airtable.com/v0/${BASE}/${CAFES}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      records: [{ fields: { 'Name': name, 'Added At': new Date().toISOString() } }],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('Airtable create cafe failed', createRes.status, errText);
    return res.status(502).json({ error: 'airtable write failed' });
  }

  return res.status(200).json({ ok: true, name });
}
