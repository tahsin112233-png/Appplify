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

  const region = req.query.region || 'BD';
  try {
    const yt = await getYT();
    const trending = await yt.getTrending();
    const items = [];
    // getTrending returns sections — flatten them
    const sections = trending.sections || trending.results || [];
    for (const section of sections) {
      const contents = section.contents || section.items || [];
      for (const item of contents) {
        try {
          if (!item.id) continue;
          items.push({
            id: item.id,
            title: item.title?.toString() || item.title || 'Unknown',
            author: (item.author?.name || item.author?.toString() || 'Unknown').replace(' - Topic', ''),
            duration: item.duration?.text?.toString() || '',
            type: 'video'
          });
        } catch {}
      }
    }
    // If no results from trending, fallback to search
    if (!items.length) {
      const regionNames = { BD:'Bangladesh',IN:'India',US:'United States',GB:'UK',PK:'Pakistan',ID:'Indonesia',TR:'Turkey',EG:'Egypt',SA:'Saudi Arabia',NG:'Nigeria',BR:'Brazil',MX:'Mexico',DE:'Germany',FR:'France',KR:'Korea',JP:'Japan' };
      const name = regionNames[region] || region;
      const r = await yt.search(`trending music ${name} 2025`, { type: 'video' });
      for (const item of r?.results || []) {
        try { if(item.id) items.push({ id:item.id, title:item.title?.toString()||'', author:(item.author?.name||'').replace(' - Topic',''), duration:item.duration?.text?.toString()||'', type:'video' }); } catch {}
      }
    }
    res.status(200).json(items.slice(0, 20));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
