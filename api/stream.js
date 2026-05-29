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

  const id = req.query.id || '';
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

  try {
    const yt = await getYT();
    const info = await yt.getBasicInfo(id, 'IOS'); // IOS client gives direct URLs

    const title = info.basic_info?.title || 'Unknown';
    const author = (info.basic_info?.author || 'Unknown').replace(' - Topic', '');
    const duration = info.basic_info?.duration || 0;
    const thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    // Get best audio stream
    const formats = info.streaming_data?.adaptive_formats || [];
    const audioFormats = formats
      .filter(f => f.mime_type?.includes('audio'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Pick medium quality (index 1) to balance quality vs rate limits
    const picked = audioFormats[Math.min(1, audioFormats.length - 1)];

    if (!picked?.url) {
      // Fallback: try formats array
      const fallback = (info.streaming_data?.formats || [])
        .filter(f => f.mime_type?.includes('audio') || f.mime_type?.includes('video'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (!fallback?.url) throw new Error('No playable stream found');
      return res.status(200).json({ id, title, author, duration, thumbnail, audioUrl: fallback.url });
    }

    res.status(200).json({ id, title, author, duration, thumbnail, audioUrl: picked.url });
  } catch (err) {
    console.error('Stream error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
