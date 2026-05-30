// Server-side proxy to Invidious search API
// Bypasses CORS (server→server) and YouTube datacenter blocking

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
  'https://yt.drgnz.club',
  'https://iv.melmac.space',
  'https://invidious.jing.rocks',
];

async function invidiousFetch(path, timeoutMs = 15000) {
  const errors = [];
  for (const base of INSTANCES) {
    try {
      const url = `${base}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.invidious.io/'
        },
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      if (data && !data.error) return data;
      errors.push(`${base}: Invalid response`);
    } catch (e) {
      errors.push(`${base}: ${e.message}`);
    }
  }
  const errorMsg = errors.length ? errors.join('; ') : 'All Invidious instances failed';
  throw new Error(errorMsg);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  
  if (req.method === 'OPTIONS') { 
    res.status(204).end(); 
    return; 
  }

  const q = (req.query.q || '').trim();
  if (!q) { 
    res.status(400).json({ error: 'Missing q parameter' }); 
    return; 
  }

  try {
    const params = new URLSearchParams({
      q,
      type: 'video',
      sort_by: 'relevance',
      fields: 'videoId,title,author,authorId,lengthSeconds',
    });
    
    const results = await invidiousFetch(`/api/v1/search?${params}`);
    
    const items = (Array.isArray(results) ? results : [])
      .filter(v => v.videoId && v.lengthSeconds > 60) // skip shorts
      .map(v => ({
        id: v.videoId,
        title: v.title || 'Unknown',
        author: (v.author || 'Unknown').replace(' - Topic', ''),
        duration: formatDuration(v.lengthSeconds),
        type: 'video',
      }))
      .slice(0, 20);

    if (items.length === 0) {
      res.status(200).json({ error: 'No results found', items: [] });
      return;
    }

    res.status(200).json(items);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(503).json({ 
      error: 'Search service temporarily unavailable',
      details: err.message 
    });
  }
}

function formatDuration(secs) {
  if (!secs || isNaN(secs)) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = String(secs % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${m}:${s}`;
}
