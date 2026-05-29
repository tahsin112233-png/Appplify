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
    const suggestions = await yt.getSearchSuggestions(q);
    res.status(200).json(Array.isArray(suggestions) ? suggestions.slice(0, 8) : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
