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
    const music = req.query.music === 'true' || req.query.music === '1';

    if (!q) {
      res.status(400).json({ error: 'Missing q' });
      return;
    }

    const suggestions = await yt.getSearchSuggestions(q, {
      client: music ? 'YTMUSIC' : 'WEB'
    });

    res.status(200).json(Array.isArray(suggestions) ? suggestions : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
