export default async function handler(req, res) {
  try {
    const qRaw = String(req.query?.q || 'beautiful travel experience').slice(0, 180);
    const position = Math.max(0, Number(req.query?.p || 0));
    const q = `${qRaw} scenic beautiful photography`; 

    const params = new URLSearchParams({ q, page_size: '24', mature: 'false' });
    const search = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
      headers: { accept: 'application/json', 'user-agent': '300-before-30/1.0' }
    });
    if (!search.ok) throw new Error(`Openverse ${search.status}`);
    const data = await search.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    const bad = /infographic|diagram|screenshot|logo|poster|flyer|brochure|chart|graph|text|document|scan|illustration|drawing|vector|clipart|advert|template|menu|book cover/i;
    const good = /travel|landscape|mountain|coast|ocean|sunset|sunrise|adventure|outdoor|nature|city|architecture|vacation|holiday|scenic|sky|forest|lake|beach|night|light|aerial|photography/i;
    const queryWords = qRaw.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 8);

    const ranked = results.map((hit, idx) => {
      const url = hit?.thumbnail || hit?.url || '';
      if (!url || hit?.watermarked || /\.svg(?:\?|$)/i.test(url)) return { hit, score: -9999, idx };
      let score = 0;
      const w = Number(hit.width)||0, h = Number(hit.height)||0;
      if (w >= 1600 || h >= 1600) score += 8; else if (w >= 1000 || h >= 1000) score += 5; else if (w >= 700 || h >= 700) score += 2;
      if (w && h) {
        const r = w/h;
        if (r >= .55 && r <= 1.25) score += 6;
        else if (r >= .42 && r <= 1.5) score += 3;
      }
      const tags = (hit.tags||[]).map(t => t?.name || t).join(' ');
      const hay = `${hit.title||''} ${tags}`.toLowerCase();
      if (bad.test(hay)) score -= 30;
      if (good.test(hay)) score += 4;
      score += queryWords.filter(wd => hay.includes(wd)).length * 7;
      if (hit.source === 'stocksnap') score += 14;
      if (hit.source === 'flickr') score += 2;
      if (hit.source === 'wikimedia') score -= 4;
      return { hit, score, idx };
    }).filter(x => x.score > -1000).sort((a,b) => b.score-a.score || a.idx-b.idx);

    if (!ranked.length) return res.status(404).send('No image');

    // Pick from the best few, deterministically, so visually similar goals don't all repeat.
    const top = ranked.slice(0, Math.min(5, ranked.length));
    const chosen = top[position % top.length]?.hit || ranked[0].hit;
    const candidates = [chosen.thumbnail, chosen.url].filter(Boolean);

    let imageResponse = null;
    for (const candidate of candidates) {
      try {
        const r = await fetch(String(candidate).replace(/^http:/,'https:'), {
          headers: { 'user-agent':'Mozilla/5.0 300-before-30-image-proxy' },
          redirect:'follow'
        });
        if (r.ok && String(r.headers.get('content-type')||'').startsWith('image/')) {
          imageResponse = r;
          break;
        }
      } catch (_) {}
    }
    if (!imageResponse) return res.status(404).send('Image unavailable');

    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    res.setHeader('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).send(bytes);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Image lookup failed');
  }
}
