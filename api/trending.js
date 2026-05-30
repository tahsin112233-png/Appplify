// Server-side trending via Invidious /api/v1/trending
// Falls back to region-specific search if trending endpoint fails

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
  'https://yt.drgnz.club',
  'https://iv.melmac.space',
  'https://invidious.jing.rocks',
];

const REGION_NAMES = {
  BD:'Bangladesh', IN:'India', US:'United States', GB:'UK',
  PK:'Pakistan', ID:'Indonesia', TR:'Turkey', EG:'Egypt',
  SA:'Saudi Arabia', NG:'Nigeria', BR:'Brazil', MX:'Mexico',
  DE:'Germany', FR:'France', KR:'South Korea', JP:'Japan',
  PH:'Philippines', VN:'Vietnam', TH:'Thailand', RU:'Russia',
};

function formatDuration(secs) {
  if (!secs || isNaN(secs)) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = String(secs % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${m}:${s}`;
}

function mapVideo(v) {
  const id = v.videoId || v.id;
  if (!id) return null;
  const secs = v.lengthSeconds || 0;
  if (secs > 0 && secs < 60) return null; // skip shorts
  return {
    id,
    title: v.title || 'Unknown',
    author: (v.author || 'Unknown').replace(' - Topic', ''),
    duration: formatDuration(secs),
    type: 'video',
  };
}

async function tryFetch(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.invidious.io/'
      },
    });
    clearTimeout(timeoutId);
    
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
  
  if (req.method === 'OPTIONS') { 
    res.status(204).end(); 
    return; 
  }

  const region = (req.query.region || 'BD').toUpperCase();
  const regionName = REGION_NAMES[region] || 'Bangladesh';
  const items = [];
  const seen = new Set();
  const errors = [];

  const addItems = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const v of arr) {
      const mapped = mapVideo(v);
      if (mapped && !seen.has(mapped.id)) {
        seen.add(mapped.id);
        items.push(mapped);
      }
    }
  };

  try {
    // Strategy 1: Invidious trending API with region
    for (const base of INSTANCES) {
      if (items.length >= 10) break;
      try {
        const data = await tryFetch(`${base}/api/v1/trending?region=${region}&type=music`);
        if (Array.isArray(data) && data.length) { 
          addItems(data); 
          break; 
        }
      } catch (e) {
        errors.push(`${base} (music): ${e.message}`);
      }
      
      try {
        // Try without music filter
        const data = await tryFetch(`${base}/api/v1/trending?region=${region}`);
        if (Array.isArray(data) && data.length) { 
          addItems(data); 
          break; 
        }
      } catch (e) {
        errors.push(`${base} (trending): ${e.message}`);
      }
    }

    // Strategy 2: Search fallback — always works, region-specific
    if (items.length < 8) {
      const queries = [
        `trending music ${regionName} 2025`,
        `top hits ${regionName}`,
        'trending music worldwide',
      ];
      for (const q of queries) {
        if (items.length >= 16) break;
        for (const base of INSTANCES) {
          try {
            const params = new URLSearchParams({ 
              q, 
              type: 'video', 
              sort_by: 'relevance',
              fields: 'videoId,title,author,authorId,lengthSeconds'
            });
            const data = await tryFetch(`${base}/api/v1/search?${params}`);
            if (Array.isArray(data) && data.length) { 
              addItems(data); 
              break; 
            }
          } catch (e) {
            errors.push(`${base} (search "${q}"): ${e.message}`);
          }
        }
      }
    }

    // Fallback: return whatever we got, even if empty
    if (items.length === 0) {
      console.warn('Trending: All strategies failed. Errors:', errors);
      res.status(503).json({ 
        error: 'Trending service temporarily unavailable',
        details: errors.slice(0, 3),
        items: [] 
      });
      return;
    }

    res.status(200).json(items.slice(0, 20));
  } catch (err) {
    console.error('Trending handler error:', err.message);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message
    });
  }
}
