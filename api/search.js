// Server-side proxy to Invidious search API
// Bypasses CORS (server→server) and YouTube datacenter blocking

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
  'https://yt.drgnz.club',
  'https://iv.melmac.space',
  'https://invidious.jing.rocks',
];

async function invidiousFetch(path, timeoutMs = 8000) {
  for (const base of INSTANCES) {
    try {
      const url = `${base}${path}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && !data.error) return data;
    } catch {}
  }
  throw new Error('All Invidious instances failed');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }

  try {
    const params = new URLSearchParams({
      q,
      type: 'video',
      sort_by: 'relevance',
      fields: 'videoId,title,author,authorId,lengthSeconds',
    });
    
    const results = await invidiousFetch(`/api/v1/search?${params}`);
    
    const items = (Array.isArray(results) ? results : [])
      .filter(v => v.videoId && v.lengthSeconds > 60) // skip shorts
      .map(v => ({
        id: v.videoId,
        title: v.title || 'Unknown',
        author: (v.author || 'Unknown').replace(' - Topic', ''),
        duration: formatDuration(v.lengthSeconds),
        type: 'video',
      }))
      .slice(0, 20);

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function formatDuration(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = String(secs % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${m}:${s}`;
}
