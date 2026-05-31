// YouTube autocomplete suggestions — public endpoint, no blocking
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) return res.status(200).json([]);

  try {
    const url = `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const text = await r.text();
    // Response is JSONP: window.google.ac.h(["query",["s1","s2",...]])
    const match = text.match(/\[.*?\[(.+?)\],/s);
    if (!match) return res.status(200).json([]);
    const suggestions = JSON.parse(`[${match[1]}]`)
      .map(s => Array.isArray(s) ? s[0] : s)
      .filter(s => typeof s === 'string')
      .slice(0, 8);
    return res.status(200).json(suggestions);
  } catch (e) {
    return res.status(200).json([]);
  }
}
