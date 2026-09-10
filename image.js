const BAD = [
  'cat','cats','dog','dogs','statue','sculpture','monument','logo','icon','diagram',
  'infographic','poster','screenshot','drawing','illustration','clipart','sign',
  'advertisement','advertising','text','meme','cartoon','figurine','toy'
];

const ALLOW_BAD_IF_QUERY_HAS = new Set([
  'dog','dogs','cat','cats','statue','sculpture','monument','illustration','drawing','toy'
]);

function words(s=''){
  return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(Boolean);
}
function overlap(query, hit){
  const q = new Set(words(query).filter(w=>w.length>2));
  const hay = words([
    hit.title, hit.description,
    ...(Array.isArray(hit.tags)?hit.tags.map(t=>typeof t==='string'?t:(t?.name||'')):[])
  ].join(' '));
  let n=0;
  for(const w of hay) if(q.has(w)) n++;
  return n;
}
function badPenalty(query, hit){
  const qset=new Set(words(query));
  const hay=words([
    hit.title, hit.description,
    ...(Array.isArray(hit.tags)?hit.tags.map(t=>typeof t==='string'?t:(t?.name||'')):[])
  ].join(' '));
  let p=0;
  for(const bad of BAD){
    if(hay.includes(bad) && !(qset.has(bad) || ALLOW_BAD_IF_QUERY_HAS.has(bad) && qset.has(bad))) p+=12;
  }
  return p;
}
function score(query, hit){
  const width=Number(hit.width||0), height=Number(hit.height||0);
  const area=Math.min(width*height/1000000,12);
  const quality=(width>=1000 && height>=700?6:0)+(width>=1600?3:0);
  const rel=overlap(query,hit)*8;
  const sourceBonus=(hit.source==='flickr'?2:0);
  return rel+area+quality+sourceBonus-badPenalty(query,hit);
}

export default async function handler(req,res){
  const q=String(req.query.q||'').trim();
  const p=Math.abs(parseInt(req.query.p||'1',10)||1);
  if(!q) return res.status(400).send('missing q');

  try{
    const params=new URLSearchParams({
      q,
      page_size:'50',
      mature:'false'
    });

    const r=await fetch(`https://api.openverse.org/v1/images/?${params}`,{
      headers:{accept:'application/json','user-agent':'300-before-30/1.0'}
    });
    if(!r.ok) return res.status(502).send('image search failed');

    const data=await r.json();
    const results=(Array.isArray(data.results)?data.results:[])
      .filter(h=>{
        const u=h.thumbnail||h.url;
        if(!u || h.watermarked) return false;
        const w=Number(h.width||0), hh=Number(h.height||0);
        return !w || !hh || (w>=800 && hh>=600);
      })
      .map(h=>({h,s:score(q,h)}))
      .sort((a,b)=>b.s-a.s);

    if(!results.length) return res.status(404).send('no image');

    // Deterministic variety among only the top relevant candidates.
    const top=results.slice(0,Math.min(6,results.length));
    const chosen=top[p % top.length].h;
    const url=String(chosen.url||chosen.thumbnail||'').replace(/^http:/,'https:');
    if(!url) return res.status(404).send('no image');

    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    return res.redirect(302,url);
  }catch(err){
    console.error(err);
    return res.status(500).send('image error');
  }
}
