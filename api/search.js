// Search via Invidious API - server side proxy (no CORS issues, no YouTube blocking)
const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://yt.artemislena.eu',
  'https://iv.melmac.space',
  'https://invidious.nerdvpn.de',
];

function fmtDur(s) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q' });

  const errors = [];
  for (const base of INSTANCES) {
    try {
      const url = `${base}/api/v1/search?${new URLSearchParams({ q, type: 'video', sort_by: 'relevance' })}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { errors.push(`${base}: HTTP ${r.status}`); continue; }
      const data = await r.json();
      if (!Array.isArray(data)) { errors.push(`${base}: not array`); continue; }
      
      const items = data
        .filter(v => v.videoId && (v.lengthSeconds || 0) > 60)
        .map(v => ({ id: v.videoId, title: v.title || '', author: (v.author || '').replace(' - Topic',''), duration: fmtDur(v.lengthSeconds), type: 'video' }))
        .slice(0, 20);
      
      if (!items.length) { errors.push(`${base}: 0 results`); continue; }
      return res.status(200).json(items);
    } catch (e) { errors.push(`${base}: ${e.message}`); }
  }
  
  console.error('[search] all failed:', errors);
  return res.status(500).json({ error: 'All search sources failed', details: errors });
}
