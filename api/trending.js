// Scrapes YouTube search for regional trending music
// Direct trending page scraping is fragile; search is reliable

const REGION_NAMES = {
  BD:'Bangladesh',IN:'India',US:'United States',GB:'UK',PK:'Pakistan',
  ID:'Indonesia',TR:'Turkey',EG:'Egypt',SA:'Saudi Arabia',NG:'Nigeria',
  BR:'Brazil',MX:'Mexico',DE:'Germany',FR:'France',KR:'South Korea',
  JP:'Japan',PH:'Philippines',VN:'Vietnam',TH:'Thailand',RU:'Russia',
};

function extractVideos(html) {
  // Try multiple regex patterns for ytInitialData (YouTube changes this format)
  const patterns = [
    /var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s,
    /ytInitialData\s*=\s*(\{.+?\});\s*(?:var |window\.|<\/script>)/s,
    /"ytInitialData"\s*,\s*(\{.+?\})\s*\)/s,
  ];
  
  let data = null;
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      try { data = JSON.parse(m[1]); break; } catch {}
    }
  }
  if (!data) return [];

  const results = [];
  const seen = new Set();

  // Walk the entire data tree looking for videoRenderer nodes
  function walk(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 15) return;
    
    // Found a video
    if (obj.videoId && obj.title) {
      const id = obj.videoId;
      if (!seen.has(id)) {
        seen.add(id);
        const title = obj.title?.runs?.[0]?.text || obj.title?.simpleText || '';
        const author = obj.ownerText?.runs?.[0]?.text || obj.shortBylineText?.runs?.[0]?.text || '';
        const duration = obj.lengthText?.simpleText || obj.lengthText?.runs?.[0]?.text || '';
        const isLive = obj.badges?.some(b => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW');
        if (title && !isLive) results.push({ id, title, author, duration, type: 'video' });
      }
      return;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item, depth + 1);
    } else {
      for (const key of Object.keys(obj)) {
        if (['thumbnail', 'trackingParams', 'accessibility', 'style', 'icon'].includes(key)) continue;
        walk(obj[key], depth + 1);
      }
    }
  }

  walk(data);
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const region = (req.query.region || 'BD').toUpperCase();
  const name = REGION_NAMES[region] || 'Bangladesh';

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  // Try multiple search queries — first one to return results wins
  const queries = [
    `trending music ${name} 2025`,
    `new music ${name} 2025`,
    `top songs ${name}`,
    `popular music ${name}`,
  ];

  for (const q of queries) {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers });
      if (!r.ok) continue;
      const html = await r.text();
      const videos = extractVideos(html);
      if (videos.length >= 5) {
        console.log(`[trending] got ${videos.length} videos for "${q}"`);
        return res.status(200).json(videos.slice(0, 20));
      }
    } catch (e) {
      console.warn('[trending] query failed:', q, e.message);
    }
  }

  // Last resort: return empty so moods still show
  console.error('[trending] all queries failed');
  return res.status(200).json([]);
}
