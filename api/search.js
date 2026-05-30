import { Innertube, UniversalCache } from 'youtubei.js';

async function getYT() {
  return Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
  });
}

function extractVideo(node) {
  try {
    const raw = node?.as ? node.as() : node;
    const id = raw?.id || raw?.video_id || raw?.videoId;
    if (!id || typeof id !== 'string' || id.length !== 11) return null;
    const title = raw?.title?.text || raw?.title?.toString?.() || '';
    if (!title) return null;
    const author = (
      raw?.author?.name || raw?.author?.toString?.() ||
      raw?.short_byline_text?.toString?.() || ''
    ).replace(' - Topic', '').trim();
    const duration = raw?.duration?.text || raw?.duration?.toString?.() || '';
    const secs = raw?.duration?.seconds || 0;
    if (secs > 0 && secs < 60) return null; // skip shorts
    return { id, title, author, duration, type: 'video' };
  } catch { return null; }
}

function extractFromResults(results) {
  const items = [];
  const seen = new Set();
  const arr = results?.results || results?.videos || results?.items || [];
  for (const node of arr) {
    try {
      // Direct video node
      const v = extractVideo(node);
      if (v && !seen.has(v.id)) { seen.add(v.id); items.push(v); continue; }
      // Wrapped in content
      if (node?.content) {
        const v2 = extractVideo(node.content);
        if (v2 && !seen.has(v2.id)) { seen.add(v2.id); items.push(v2); }
      }
    } catch {}
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  const filter = req.query.filter || req.query.f || 'all';
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }

  try {
    const yt = await getYT();
    let items = [];

    // Music search for song/artist/album filters
    if (filter === 'song' || filter === 'artist' || filter === 'album') {
      try {
        const r = await yt.music.search(q, { type: filter === 'song' ? 'song' : filter === 'artist' ? 'artist' : 'album' });
        const shelf = r?.songs || r?.artists || r?.albums || r;
        const contents = shelf?.contents || shelf?.results || [];
        for (const node of contents) {
          try {
            const raw = node?.as ? node.as() : node;
            const id = raw?.id || raw?.video_id;
            if (!id || id.length !== 11) continue;
            const title = raw?.title?.toString?.() || raw?.name?.toString?.() || '';
            if (!title) continue;
            const author = (raw?.artists?.[0]?.name || raw?.author?.name || '').replace(' - Topic', '');
            const duration = raw?.duration?.text || '';
            items.push({ id, title, author, duration, type: 'song' });
          } catch {}
        }
      } catch (e) {
        console.warn('[search] music search failed, falling back:', e.message);
      }
    }

    // Standard YouTube search (default + fallback)
    if (items.length === 0) {
      const r = await yt.search(q, { type: 'video', sort_by: 'relevance' });
      items = extractFromResults(r);
    }

    return res.status(200).json(items.slice(0, 20));
  } catch (err) {
    console.error('[search]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
