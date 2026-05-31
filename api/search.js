// Scrapes youtube.com/results directly — works from Vercel (YouTube serves HTML to all IPs)
// Same approach used by Streamora (streamora.netlify.app)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q' });

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!r.ok) throw new Error(`YouTube returned ${r.status}`);
    const html = await r.text();

    // Extract ytInitialData JSON from the page
    const match = html.match(/var ytInitialData\s*=\s*({.+?});\s*<\/script>/s) ||
                  html.match(/ytInitialData\s*=\s*({.+?});\s*(?:var|window|<\/script>)/s);
    if (!match) throw new Error('Could not extract search data from YouTube');

    const data = JSON.parse(match[1]);
    const contents = data?.contents
      ?.twoColumnSearchResultsRenderer
      ?.primaryContents
      ?.sectionListRenderer
      ?.contents || [];

    const videos = contents
      .flatMap(c => c?.itemSectionRenderer?.contents || [])
      .filter(item => item?.videoRenderer?.videoId)
      .map(item => {
        const v = item.videoRenderer;
        const dur = v.lengthText?.simpleText || '';
        // Skip live streams and shorts (duration < ~1min)
        if (v.badges?.some(b => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW')) return null;
        return {
          id: v.videoId,
          title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'Unknown',
          author: v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || '',
          duration: dur,
          type: 'video',
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    if (!videos.length) throw new Error('No videos found in YouTube response');
    return res.status(200).json(videos);

  } catch (e) {
    console.error('[search] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
