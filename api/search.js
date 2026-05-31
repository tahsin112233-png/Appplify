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
      // Build URL string directly — avoids any internal url.parse() issues
      const encoded = encodeURIComponent(q);
      const url = `${base}/api/v1/search?q=${encoded}&type=video&sort_by=relevance`;
      
      const r = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });

      if (!r.ok) { errors.push(`${base}: HTTP ${r.status}`); continue; }
      
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) { errors.push(`${base}: empty`); continue; }

      const items = data
        .filter(v => {
          if (!v.videoId) return false;
          // Only skip if we KNOW it's a short (lengthSeconds present AND under 60s)
          if (v.lengthSeconds && v.lengthSeconds < 60) return false;
          return true;
        })
        .map(v => ({
          id: v.videoId,
          title: v.title || 'Unknown',
          author: (v.author || '').replace(' - Topic', ''),
          duration: fmtDur(v.lengthSeconds),
          type: 'video',
        }))
        .slice(0, 20);

      if (!items.length) { errors.push(`${base}: filtered to 0`); continue; }

      return res.status(200).json(items);
    } catch (e) {
      errors.push(`${base}: ${e.message}`);
    }
  }

  console.error('[search] all instances failed:', JSON.stringify(errors));
  return res.status(500).json({ error: 'Search unavailable', details: errors });
}
