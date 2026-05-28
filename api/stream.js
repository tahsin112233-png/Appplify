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
    const id = req.query.id || '';
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    const yt = await Innertube.create();
    const info = await yt.getBasicInfo(id);

    if (!info) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const title = info.basic_info.title || 'Unknown';
    const author = info.basic_info.author || 'Unknown';
    const duration = info.basic_info.duration || 0;

    // Get audio format
    let audioUrl = null;
    let audioFormats = [];

    try {
      const formats = info.streaming_data?.adaptive_formats || info.streaming_data?.formats || [];
      audioFormats = formats.filter(f => {
        const mime = f.mime_type || '';
        return mime.includes('audio');
      }).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (audioFormats.length > 0) {
        // Pick medium quality to avoid rate limits
        const pick = audioFormats[Math.min(1, audioFormats.length - 1)];
        audioUrl = pick.url;
      }
    } catch {}

    // Fallback: try to get any format
    if (!audioUrl) {
      try {
        const allFormats = info.streaming_data?.formats || [];
        if (allFormats.length > 0) {
          audioUrl = allFormats[0].url;
        }
      } catch {}
    }

    res.status(200).json({
      id,
      title,
      author,
      duration,
      audioUrl,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
