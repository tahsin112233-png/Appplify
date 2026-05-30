// Trending via Invidious /api/v1/trending
const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://yt.artemislena.eu',
  'https://iv.melmac.space',
  'https://invidious.nerdvpn.de',
];

const REGION_NAMES = {
  BD:'Bangladesh',IN:'India',US:'United States',GB:'UK',PK:'Pakistan',
  ID:'Indonesia',TR:'Turkey',EG:'Egypt',SA:'Saudi Arabia',NG:'Nigeria',
  BR:'Brazil',MX:'Mexico',DE:'Germany',FR:'France',KR:'South Korea',
  JP:'Japan',PH:'Philippines',VN:'Vietnam',TH:'Thailand',RU:'Russia',
};

function fmtDur(s) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const region = (req.query.region || 'BD').toUpperCase();
  const seen = new Set();
  const items = [];

  const addVideos = (arr) => {
    for (const v of (arr || [])) {
      const id = v.videoId || v.id;
      if (!id || seen.has(id) || (v.lengthSeconds > 0 && v.lengthSeconds < 60)) continue;
      seen.add(id);
      items.push({ id, title: v.title || '', author: (v.author || '').replace(' - Topic',''), duration: fmtDur(v.lengthSeconds), type: 'video' });
    }
  };

  // Try trending endpoint for this region
  for (const base of INSTANCES) {
    if (items.length >= 10) break;
    try {
      const r = await fetch(`${base}/api/v1/trending?region=${region}&type=music`, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) { addVideos(d); break; } }
    } catch {}
    try {
      const r = await fetch(`${base}/api/v1/trending?region=${region}`, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) { addVideos(d); break; } }
    } catch {}
  }

  // Fallback: search for regional trending music
  if (items.length < 8) {
    const name = REGION_NAMES[region] || region;
    for (const q of [`trending music ${name} 2025`, `top hits ${name}`]) {
      if (items.length >= 16) break;
      for (const base of INSTANCES) {
        try {
          const r = await fetch(`${base}/api/v1/search?${new URLSearchParams({q, type:'video', sort_by:'relevance'})}`, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) { addVideos(d); break; } }
        } catch {}
      }
    }
  }

  return res.status(200).json(items.slice(0, 20));
}
