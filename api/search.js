import { Innertube, UniversalCache } from 'youtubei.js';

let _yt = null;
async function getYT() {
  if (!_yt) _yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
  return _yt;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.query.q || '';
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }

  try {
    const yt = await getYT();
    const results = await yt.search(q, { type: 'video', sort_by: 'relevance' });
    const items = [];
    for (const item of results?.results || []) {
      try {
        if (!item.id) continue;
        const dur = item.duration?.seconds;
        if (dur && dur < 60) continue; // skip shorts
        items.push({
          id: item.id,
          title: item.title?.toString() || item.title || 'Unknown',
          author: item.author?.name || item.author?.toString() || 'Unknown',
          duration: item.duration?.text?.toString() || '',
          type: 'video'
        });
      } catch {}
    }
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
