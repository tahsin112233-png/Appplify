// Search suggestions via Invidious
const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://yt.artemislena.eu',
  'https://iv.melmac.space',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) return res.status(200).json([]);

  for (const base of INSTANCES) {
    try {
      const r = await fetch(`${base}/api/v1/search/suggestions?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) continue;
      const d = await r.json();
      if (d?.suggestions?.length) return res.status(200).json(d.suggestions.slice(0, 8));
    } catch {}
  }
  return res.status(200).json([]);
}
