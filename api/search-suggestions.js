// Server-side search suggestions via Invidious

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
  'https://iv.melmac.space',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) { return res.status(200).json([]); }

  for (const base of INSTANCES) {
    try {
      const url = `${base}/api/v1/search/suggestions?q=${encodeURIComponent(q)}`;
      const r = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });
      if (!r.ok) continue;
      const data = await r.json();
      const suggestions = data?.suggestions || [];
      if (suggestions.length) {
        return res.status(200).json(suggestions.slice(0, 8));
      }
    } catch {}
  }

  return res.status(200).json([]); // fail silently — suggestions are optional
}
