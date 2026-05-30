import { Innertube, UniversalCache } from 'youtubei.js';

async function getYT() {
  return Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
  });
}

const REGION_NAMES = {
  BD:'Bangladesh', IN:'India', US:'United States', GB:'UK',
  PK:'Pakistan', ID:'Indonesia', TR:'Turkey', EG:'Egypt',
  SA:'Saudi Arabia', NG:'Nigeria', BR:'Brazil', MX:'Mexico',
  DE:'Germany', FR:'France', KR:'South Korea', JP:'Japan',
  PH:'Philippines', VN:'Vietnam', TH:'Thailand', RU:'Russia',
};

// Safely extract a video item from any youtubei.js node shape
function extractVideo(node) {
  try {
    const raw = node?.as ? node.as() : node;

    // Try all known ID fields
    const id = raw?.id || raw?.video_id || raw?.videoId;
    if (!id || typeof id !== 'string' || id.length !== 11) return null;

    // Try all known title fields
    const title =
      raw?.title?.text ||
      raw?.title?.toString?.() ||
      raw?.headline?.text ||
      raw?.headline?.toString?.() ||
      '';
    if (!title) return null;

    // Try all known author fields
    const author = (
      raw?.author?.name ||
      raw?.author?.toString?.() ||
      raw?.short_byline_text?.toString?.() ||
      raw?.byline?.toString?.() ||
      ''
    ).replace(' - Topic', '').replace(/^@/, '').trim();

    const duration =
      raw?.duration?.text ||
      raw?.duration?.simpleText ||
      raw?.duration?.toString?.() ||
      '';

    // Filter out shorts (duration usually < 1 min or no duration)
    const secs = raw?.duration?.seconds || 0;
    if (secs > 0 && secs < 60) return null;

    return { id, title, author, duration, type: 'video' };
  } catch { return null; }
}

// Walk any object recursively looking for video nodes — handles all tab structures
function walkForVideos(obj, depth = 0, seen = new Set()) {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  const results = [];

  // Try to extract as a video directly
  const v = extractVideo(obj);
  if (v && !seen.has(v.id)) {
    seen.add(v.id);
    results.push(v);
  }

  // Walk arrays
  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...walkForVideos(item, depth + 1, seen));
    }
    return results;
  }

  // Walk known content keys
  const keys = ['contents', 'items', 'results', 'videos', 'tabs', 'header',
                 'content', 'sections', 'sub_menu', 'body'];
  for (const key of keys) {
    if (obj[key]) {
      results.push(...walkForVideos(obj[key], depth + 1, seen));
    }
  }

  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const region = (req.query.region || 'BD').toUpperCase();
  const regionName = REGION_NAMES[region] || region;

  try {
    const yt = await getYT();
    let items = [];
    const seen = new Set();

    // Strategy 1: YouTube Music trending/charts — most reliable for music
    try {
      const explore = await yt.music.getExplore();
      items = walkForVideos(explore, 0, seen);
      console.log('[trending] music explore:', items.length);
    } catch (e) {
      console.warn('[trending] music explore failed:', e.message);
    }

    // Strategy 2: YouTube trending page
    if (items.length < 5) {
      try {
        const trending = await yt.getTrending();
        const fromTrending = walkForVideos(trending, 0, seen);
        items.push(...fromTrending);
        console.log('[trending] getTrending added:', fromTrending.length);
      } catch (e) {
        console.warn('[trending] getTrending failed:', e.message);
      }
    }

    // Strategy 3: Region-specific search — always reliable
    if (items.length < 8) {
      const queries = [
        `trending music ${regionName} 2025`,
        `top hits ${regionName} 2025`,
        `popular songs ${regionName}`,
      ];
      for (const q of queries) {
        if (items.length >= 16) break;
        try {
          const r = await yt.search(q, { type: 'video', sort_by: 'relevance' });
          const fromSearch = walkForVideos(r, 0, seen);
          items.push(...fromSearch);
          console.log(`[trending] search "${q}":`, fromSearch.length);
        } catch (e) {
          console.warn('[trending] search failed:', e.message);
        }
      }
    }

    console.log('[trending] total items:', items.length);
    return res.status(200).json(items.slice(0, 20));

  } catch (err) {
    console.error('[trending] fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
