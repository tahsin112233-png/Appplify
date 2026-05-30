// Server-side proxy: fetches audio stream URL from Invidious
// Returns direct audio URL that the browser <audio> element plays
// This solves: YouTube blocking Vercel IPs, CORS issues, youtubei.js cold starts

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
  'https://yt.drgnz.club',
  'https://iv.melmac.space',
  'https://invidious.jing.rocks',
  'https://invidious.nerdvpn.de',
];

function formatDuration(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = String(secs % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${m}:${s}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const id = (req.query.id || '').trim();
  if (!id || id.length !== 11) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  for (const base of INSTANCES) {
    try {
      const url = `${base}/api/v1/videos/${id}?fields=title,author,lengthSeconds,adaptiveFormats`;
      const r = await fetch(url, {
        signal: AbortSignal.timeout(9000),
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });

      if (!r.ok) continue;
      const data = await r.json();
      if (data?.error || !data?.adaptiveFormats) continue;

      // Get best audio stream
      const audioStreams = (data.adaptiveFormats || [])
        .filter(f => f.type?.startsWith('audio/') && f.url)
        .sort((a, b) => parseInt(b.bitrate || 0) - parseInt(a.bitrate || 0));

      if (!audioStreams.length) continue;

      // Pick medium quality (index 1) - less likely to be rate limited than highest
      const picked = audioStreams[Math.min(1, audioStreams.length - 1)];

      return res.status(200).json({
        id,
        title: data.title || 'Unknown',
        author: (data.author || 'Unknown').replace(' - Topic', ''),
        duration: data.lengthSeconds || 0,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        audioUrl: picked.url,
        instance: base, // for debugging
      });

    } catch (e) {
      console.warn('[stream]', base, 'failed:', e.message);
    }
  }

  return res.status(500).json({
    error: 'Could not fetch audio stream. All sources failed.',
  });
}
