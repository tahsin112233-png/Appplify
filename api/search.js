import { Innertube } from 'youtubei.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const yt = await Innertube.create();
    const q = req.query.q || '';

    if (!q) {
      res.status(400).json({ error: 'Missing q' });
      return;
    }

    const results = await yt.search(q, { type: 'video' });

    const items = [];
    if (results && results.results) {
      for (const item of results.results) {
        if (item.type === 'Video' || item.type === 'Movie' || item.type === 'MusicVideo') {
          items.push({
            id: item.id,
            title: item.title?.text || item.title || 'Unknown',
            author: item.author?.name || item.author || 'Unknown',
            duration: item.duration?.text || item.duration || '',
            type: 'video'
          });
        }
      }
    }

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
