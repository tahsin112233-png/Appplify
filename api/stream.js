import { Innertube, UniversalCache } from 'youtubei.js';

// CRITICAL: Do NOT set retrieve_player:false — streaming_data requires the player
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

  const id = (req.query.id || '').trim();
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

  try {
    const yt = await getYT();

    // IOS client gives direct URLs (no signature deciphering needed)
    // Try multiple clients in order until one gives audio streams
    const clients = ['IOS', 'ANDROID', 'TV_EMBEDDED', 'WEB'];
    let audioUrl = null;
    let title = 'Unknown', author = 'Unknown', duration = 0;

    for (const client of clients) {
      try {
        const info = await yt.getBasicInfo(id, client);
        title = info.basic_info?.title || title;
        author = (info.basic_info?.author || author).replace(' - Topic', '');
        duration = info.basic_info?.duration || duration;

        const adaptive = info.streaming_data?.adaptive_formats || [];
        const regular = info.streaming_data?.formats || [];

        const audioStreams = [...adaptive, ...regular]
          .filter(f => f.mime_type?.startsWith('audio/') && f.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        if (audioStreams.length > 0) {
          // Index 1 = medium quality — index 0 is highest and often rate limited
          audioUrl = audioStreams[Math.min(1, audioStreams.length - 1)].url;
          console.log('[stream] got audio via', client, 'formats:', audioStreams.length);
          break;
        }
      } catch (e) {
        console.warn('[stream]', client, 'failed:', e.message);
      }
    }

    if (!audioUrl) {
      return res.status(500).json({
        error: 'No audio stream found. Video may be age-restricted or unavailable.'
      });
    }

    return res.status(200).json({
      id, title, author, duration,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      audioUrl,
    });

  } catch (err) {
    console.error('[stream] fatal:', id, err.message);
    return res.status(500).json({ error: err.message });
  }
}
