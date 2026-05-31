// Scrapes youtube.com/feed/trending — works from Vercel
// For region-specific: uses YouTube's hl/gl params

const REGION_CODES = {
  BD:'BD',IN:'IN',US:'US',GB:'GB',PK:'PK',ID:'ID',TR:'TR',EG:'EG',
  SA:'SA',NG:'NG',BR:'BR',MX:'MX',DE:'DE',FR:'FR',KR:'KR',JP:'JP',
  PH:'PH',VN:'VN',TH:'TH',RU:'RU',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const region = (req.query.region || 'BD').toUpperCase();
  const gl = REGION_CODES[region] || 'BD';

  try {
    const url = `https://www.youtube.com/feed/trending?bp=4gINGgt5dG1hX2NoYXJ0cw%3D%3D&gl=${gl}`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!r.ok) throw new Error(`YouTube returned ${r.status}`);
    const html = await r.text();

    const match = html.match(/var ytInitialData\s*=\s*({.+?});\s*<\/script>/s) ||
                  html.match(/ytInitialData\s*=\s*({.+?});\s*(?:var|window|<\/script>)/s);
    if (!match) throw new Error('Could not extract trending data');

    const data = JSON.parse(match[1]);

    // Trending page has a different structure — walk through tabs and sections
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    const items = [];
    const seen = new Set();

    for (const tab of tabs) {
      const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const section of sections) {
        const contents = section?.itemSectionRenderer?.contents ||
                         section?.shelfRenderer?.content?.expandedShelfContentsRenderer?.items || [];
        for (const item of contents) {
          const v = item?.videoRenderer || item?.richItemRenderer?.content?.videoRenderer;
          if (!v?.videoId || seen.has(v.videoId)) continue;
          if (v.badges?.some(b => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW')) continue;
          seen.add(v.videoId);
          items.push({
            id: v.videoId,
            title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'Unknown',
            author: v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || '',
            duration: v.lengthText?.simpleText || '',
            type: 'video',
          });
        }
      }
    }

    // Also check richGridRenderer (used in newer YT layout)
    const richGrid = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.richGridRenderer?.contents || [];
    for (const item of richGrid) {
      const v = item?.richItemRenderer?.content?.videoRenderer;
      if (!v?.videoId || seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      items.push({
        id: v.videoId,
        title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'Unknown',
        author: v.ownerText?.runs?.[0]?.text || '',
        duration: v.lengthText?.simpleText || '',
        type: 'video',
      });
    }

    if (items.length > 0) {
      return res.status(200).json(items.slice(0, 20));
    }

    // Fallback: search for trending music in the region
    throw new Error('No trending items extracted, using search fallback');

  } catch (e) {
    console.warn('[trending] scrape failed:', e.message, '— using search fallback');

    // Search fallback — always works
    try {
      const REGION_NAMES = {
        BD:'Bangladesh',IN:'India',US:'United States',GB:'UK',PK:'Pakistan',
        ID:'Indonesia',TR:'Turkey',EG:'Egypt',SA:'Saudi Arabia',NG:'Nigeria',
        BR:'Brazil',MX:'Mexico',DE:'Germany',FR:'France',KR:'South Korea',
        JP:'Japan',PH:'Philippines',VN:'Vietnam',TH:'Thailand',RU:'Russia',
      };
      const name = REGION_NAMES[region] || region;
      const q = `trending music ${name} 2025`;
      const url2 = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const r2 = await fetch(url2, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' },
      });
      const html2 = await r2.text();
      const m2 = html2.match(/var ytInitialData\s*=\s*({.+?});\s*<\/script>/s) || html2.match(/ytInitialData\s*=\s*({.+?});\s*(?:var|window|<\/script>)/s);
      if (!m2) throw new Error('no data');
      const d2 = JSON.parse(m2[1]);
      const contents2 = d2?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      const fallbackItems = contents2
        .flatMap(c => c?.itemSectionRenderer?.contents || [])
        .filter(item => item?.videoRenderer?.videoId)
        .map(item => {
          const v = item.videoRenderer;
          return { id: v.videoId, title: v.title?.runs?.[0]?.text || 'Unknown', author: v.ownerText?.runs?.[0]?.text || '', duration: v.lengthText?.simpleText || '', type: 'video' };
        })
        .slice(0, 20);
      return res.status(200).json(fallbackItems);
    } catch (e2) {
      console.error('[trending] fallback also failed:', e2.message);
      return res.status(200).json([]); // return empty array so home shows moods at least
    }
  }
}
