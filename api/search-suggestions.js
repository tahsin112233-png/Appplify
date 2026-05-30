import { Innertube, UniversalCache } from 'youtubei.js';

async function getYT() {
  return Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }

  try {
    const yt = await getYT();
    const suggestions = await yt.getSearchSuggestions(q);
    // v17 returns string[] or SearchSuggestion[]
    const result = Array.isArray(suggestions)
      ? suggestions.map(s => typeof s === 'string' ? s : s?.suggestion?.toString?.() || s?.toString?.() || '').filter(Boolean)
      : [];
    return res.status(200).json(result.slice(0, 8));
  } catch (err) {
    return res.status(200).json([]); // suggestions failing silently is fine
  }
}
