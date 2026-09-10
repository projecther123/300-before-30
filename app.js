const SUPABASE_URL = 'https://crksxddqawpglqqjnrnd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_xSU_tMsLI8k1lZ6X-fHQKg_EBUkD7fg';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const CATS = [
  'Once-in-a-Lifetime / Major Experiences',
  'Trips & Travel',
  'Short Trips & Days Out',
  'Activities, Events & Nights Out',
  'Everyday / Easy Wins',
  'Life Milestones'
];
const ICONS = {
  'Once-in-a-Lifetime / Major Experiences':'☆',
  'Trips & Travel':'✈',
  'Short Trips & Days Out':'▣',
  'Activities, Events & Nights Out':'◇',
  'Everyday / Easy Wins':'⌂',
  'Life Milestones':'♜'
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let currentUser = null;
let currentUsername = null;
let state = { goals:[], view:'cards', status:'all', category:'All', search:'' };

async function boot(){
  CATS.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('#editCategory').appendChild(o);
  });
  bind();
  showLoading('Opening your list…');

  const { data:{ session } } = await db.auth.getSession();
  if (!session?.user) {
    hideLoading();
    showOnboarding();
    return;
  }

  currentUser = session.user;
  const { data: profile, error } = await db
    .from('profiles')
    .select('username')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) console.error(error);
  if (!profile) {
    hideLoading();
    showOnboarding();
    return;
  }

  currentUsername = profile.username;
  await loadApp();
}

function showLoading(text='Loading…'){
  $('#loadingText').textContent = text;
  $('#loading').classList.remove('hidden');
}
function hideLoading(){ $('#loading').classList.add('hidden'); }
function showError(message){
  $('#toast').textContent = message;
  $('#toast').classList.remove('hidden');
  clearTimeout(showError.timer);
  showError.timer = setTimeout(()=>$('#toast').classList.add('hidden'), 4500);
}

async function ensureAnonymousUser(){
  const { data:{ session } } = await db.auth.getSession();
  if (session?.user) { currentUser = session.user; return session.user; }
  const { data, error } = await db.auth.signInAnonymously();
  if (error) throw error;
  currentUser = data.user;
  return data.user;
}

async function createProfile(username){
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
    $('#usernameHelp').textContent = 'Use 3–30 letters, numbers or underscores.';
    return;
  }
  const btn = $('#profileForm button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Creating your list…';
  try {
    await ensureAnonymousUser();
    const { error } = await db.rpc('create_profile_and_list', { chosen_username: clean });
    if (error) throw error;
    currentUsername = clean;
    await loadApp();
  } catch (err) {
    console.error(err);
    const m = String(err?.message || '');
    $('#usernameHelp').textContent = m.toLowerCase().includes('duplicate') || m.toLowerCase().includes('unique')
      ? 'That username is already taken. Try another.'
      : 'Couldn’t create that profile. Please try again.';
  } finally {
    btn.disabled = false; btn.textContent = 'Create my list';
  }
}

async function loadApp(){
  showLoading('Loading your 300…');
  const [{ data: goals, error: goalsError }, { data: subs, error: subsError }] = await Promise.all([
    db.from('user_experiences').select('*').order('position', { ascending:true }),
    db.from('user_subgoals').select('*').order('position', { ascending:true })
  ]);
  if (goalsError || subsError) {
    console.error(goalsError || subsError);
    hideLoading(); showError('Couldn’t load your list.'); return;
  }
  const subsByGoal = new Map();
  (subs || []).forEach(s => {
    if (!subsByGoal.has(s.user_experience_id)) subsByGoal.set(s.user_experience_id, []);
    subsByGoal.get(s.user_experience_id).push({ id:s.id, title:s.title, completed:s.completed, position:s.position });
  });
  state.goals = (goals || []).map(g => ({
    id:g.id,
    masterId:g.master_experience_id,
    position:g.position,
    title:g.title,
    category:g.category,
    type:g.goal_type,
    target:g.target_value,
    current:g.current_value,
    completed:g.completed,
    isCustom:g.is_custom,
    subgoals:subsByGoal.get(g.id) || []
  }));
  $('#onboarding').classList.add('hidden');
  $('#app').classList.remove('hidden');
  hideLoading();
  renderAll();
}

function stats(goals=state.goals){
  const done = goals.filter(g=>goalDone(g)).length;
  const total = goals.length;
  const pct = total ? Math.round(done/total*100) : 0;
  return {done,total,pct,remaining:total-done};
}
function goalDone(g){
  if(g.type==='counter') return (+g.current||0) >= (+g.target||0);
  if(g.type==='checklist') return !!g.subgoals?.length && g.subgoals.every(s=>s.completed);
  return !!g.completed;
}
function renderAll(){ renderHome(); renderList(); renderMe(); }

const CAT_SHORT = {
  'Once-in-a-Lifetime / Major Experiences':'Major Experiences',
  'Trips & Travel':'Trips & Travel',
  'Short Trips & Days Out':'Days Out',
  'Activities, Events & Nights Out':'Activities & Nights Out',
  'Everyday / Easy Wins':'Everyday Easy Wins',
  'Life Milestones':'Life Milestones'
};
const FILTER_SHORT = {
  'Once-in-a-Lifetime / Major Experiences':'Major',
  'Trips & Travel':'Travel',
  'Short Trips & Days Out':'Days Out',
  'Activities, Events & Nights Out':'Activities',
  'Everyday / Easy Wins':'Easy Wins',
  'Life Milestones':'Milestones'
};

const CATEGORY_IMAGES = {
  'Once-in-a-Lifetime / Major Experiences':'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=82',
  'Trips & Travel':'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=82',
  'Short Trips & Days Out':'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=82',
  'Activities, Events & Nights Out':'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1000&q=82',
  'Everyday / Easy Wins':'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=82',
  'Life Milestones':'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1000&q=82'
};

function renderHome(){
  const s=stats();
  $('#homePct').textContent=s.pct+'%';
  $('#homeCount').innerHTML=`${s.done} of ${s.total}<br>completed`;
  $('.ring').style.setProperty('--p',s.pct);
  $('#categoryGrid').innerHTML=CATS.map(c=>{
    const gs=state.goals.filter(g=>g.category===c), cs=stats(gs);
    return `<button class="category-card" data-cat="${escapeHtml(c)}" style="--cat-image:url('${CATEGORY_IMAGES[c]}')">
      <span class="cat-icon">${ICONS[c]}</span>
      <strong>${escapeHtml(CAT_SHORT[c]||c)}</strong>
      <div class="cat-stat"><b>${cs.done} of ${cs.total}</b><span>${cs.pct}%</span></div>
      <span class="cat-progress"><i style="width:${cs.pct}%"></i></span>
    </button>`;
  }).join('');
  $$('.category-card').forEach(b=>b.onclick=()=>{ state.category=b.dataset.cat; switchTab('list'); renderList(); });
  const explore=$('#exploreAll'); if(explore) explore.onclick=()=>{ state.category='All'; switchTab('list'); renderList(); };
}

const IMAGE_OVERRIDES = {
  1:'helicopter flight',2:'skydiving parachute',3:'zipline adventure',4:'bungee jumping',5:'solo backpacker mountain trail golden hour',6:'remote work abroad laptop city',7:'northern lights aurora snowy lake cabin',8:'drive in cinema cars',9:'beautiful beach camping tent sunset ocean',10:'swimming alpine lake',
  11:'sunrise sunset landscape',12:'natural hot spring',13:'american bar cocktail usa',14:'swimming dolphins ocean',15:'great barrier reef scuba diving',16:'new years fireworks city',17:'surfing ocean wave',18:'adult dance class studio',19:'vineyard wine grapes',20:'cruise ship sea',
  21:'karaoke bar microphone',22:'paragliding mountains',23:'holiday volunteering charity',24:'water skiing lake',25:'south america travel peru',26:'eurovision concert stage',27:'business class airplane cabin',28:'floating lantern festival',29:'cooking class kitchen',30:'cocktail making class',
  31:'world map travel dart',32:'conference ted talk stage',33:'television studio audience',34:'live band concert',35:'opera house theatre',36:'koala australia',37:'grape stomping wine festival',38:'white water rafting',39:'international festival crowd',40:'casino roulette',
  41:'oktoberfest munich',42:'friends road trip car',43:'bible book reading',44:'paintball outdoor',45:'laser tag arena',46:'seven wonders world travel',47:'hot air balloon',48:'meteor shower stars',49:'digital detox nature',50:'ice swimming winter',
  51:'ancestry dna genealogy',52:'waterfall swimming',53:'colour run race',54:'pottery class ceramics',55:'playing instrument piano',56:'seaplane lake',57:'horse riding mountains',58:'blind date restaurant',59:'solo dining restaurant travel',60:'frog legs food',
  61:'champagne sabrage bottle',62:'cigar lounge',63:'first aid training',64:'pole dancing class',65:'race car track',66:'champagne breakfast',67:'submarine underwater',68:'limousine city night',69:'japanese tea ceremony',70:'europe christmas market',
  71:'amazon rainforest river',72:'seven continents world map',73:'small italian village',74:'palace versailles france',75:'jerusalem old city',76:'st patricks day dublin',77:'london double decker bus',78:'designer handbag luxury',79:'10k running race',80:'mother daughter holiday',
  81:'self defence class',82:'motorbike ride road',83:'homemade bread baking',84:'facial spa skincare',85:'spa weekend hotel',86:'pull up gym',87:'yoga retreat',88:'public speaking stage',89:'romantic comedy movie cinema',90:'blood donation',
  91:'classic novels books',92:'classic movies cinema',93:'comedy show standup',94:'first date fun',95:'michelin star restaurant',96:'luxury sports car test drive',97:'horse racing grandstand',98:'formal event couple date',99:'mechanical bull rodeo',100:'cliff jumping sea',
  101:'psychic tarot reading',102:'circus tent performance',103:'venice canals gondola',104:'courtroom trial',105:'long city walk steps',106:'passport travel countries',107:'volcano hiking',108:'ice hockey game',109:'india taj mahal travel',110:'fish pedicure spa',
  111:'outdoor rock climbing',112:'strictly ballroom dance blackpool',113:'parasailing beach',114:'tropical island nation',115:'adult sports team',116:'giant panda',117:'wedding party bridesmaids',118:'war and peace book',119:'language learning conversation',120:'voting polling station',
  121:'art gallery event',122:'dinner party table',123:'self improvement book',124:'investing stocks finance',125:'sports betting ticket',126:'scuba certification diving',127:'baby shower party',128:'usa road trip states map',129:'buy first car',130:'flowers gift friend',
  131:'surprise party balloons',132:'school alumni volunteering',133:'school reunion friends',134:'snowdon mountain wales',135:'edinburgh fringe festival',136:'escalator underground',137:'all inclusive resort pool',138:'guinness dublin pub',139:'dead sea floating',140:'dog sledding snow',
  141:'orcas norway ocean',142:'route 66 road trip',143:'vegetable garden harvest',144:'magic trick cards',145:'charity donation giving',146:'salary negotiation office',147:'dancing in rain',148:'via ferrata mountain',149:'sandboarding dunes',150:'solo holiday travel',
  151:'business travel airport laptop',152:'glastonbury festival',153:'stonehenge england',154:'film set extra actor',155:'scottish highlands road trip',156:'seven sisters cliffs england',157:'punting cambridge river',158:'henley royal regatta rowing',159:'notting hill carnival london',160:'shakespeares globe theatre',
  161:'cheese rolling hill race',162:'twickenham rugby england',163:'uk parliament house commons',164:'perfume fragrance bottles',165:'hypnosis stage',166:'family recipe cooking',167:'handstand yoga',168:'constellations night sky',169:'auction house bidding',170:'galapagos islands wildlife',
  171:'flowers bouquet self gift',172:'solo dinner restaurant uk',173:'shooting star night sky',174:'fairground prize carnival',175:'birthday cake baking',176:'houseplant indoor plant',177:'asking someone on date',178:'conga line party',179:'peaceful protest march',180:'poetry reading microphone',
  181:'hotel room upgrade luxury',182:'burlesque cabaret show',183:'art painting gallery home',184:'public lecture auditorium',185:'leaving job office box',186:'guest speaker conference',187:'finger whistle',188:'tailored suit fitting',189:'curling sport ice',190:'fringe haircut salon',
  191:'thames river boat london',192:'living alone apartment',193:'life drawing class studio',194:'moonwalk dance',195:'murder mystery dinner',196:'womens football match stadium',197:'chinatown london night food',198:'renaissance fair costume',199:'haunted house ghost',200:'professional makeup artist',
  201:'formal event hair styling',202:'world darts championship ally pally',203:'ronnie scotts jazz club london',204:'campervan travel road',205:'glacier walking crampons',206:'pyramids giza egypt',207:'patagonia hiking mountains',208:'rio carnival brazil',209:'seance candles table',210:'central asia silk road',
  211:'goodwood festival cars england',212:'trapeze circus class',213:'midnight sun arctic',214:'conker championships england',215:'hundred acre wood forest',216:'snail racing village',217:'yo yo trick',218:'lock picking practice',219:'home brewing beer',220:'luxury dining train',
  221:'tasting menu fine dining',222:'glacier express switzerland train',223:'regular local cafe coffee',224:'sleeper train cabin',225:'earth oven food cooking',226:'balloon animal',227:'vip concert passes',228:'manta ray diving',229:'night skiing lights',230:'friends ski trip',
  231:'theme park roller coaster adult',232:'champagne afternoon tea',233:'eating competition food',234:'apiary beekeeper bees',235:'religious service church ceremony',236:'classical music concert orchestra',237:'magic show theatre',238:'sloth wild rainforest',239:'flower arranging bouquet',240:'longleat safari england',
  241:'dog show competition',242:'collectors convention expo',243:'parkrun runners park',244:'bingo night hall',245:'london tube final stop explore',246:'cracking egg one handed',247:'stone skimming lake',248:'paper aeroplane flying',249:'kite flying field',250:'2p coin pusher seaside arcade',
  251:'car boot sale england',252:'town council meeting chamber',253:'daisy chain flowers',254:'pub leaderboard darts',255:'homemade lemonade',256:'wild owl forest',257:'souffle baking',258:'boomerang throwing',259:'house of cards playing cards',260:'model rocket launch',
  261:'rickshaw driving city',262:'monster truck race',263:'village duck race river',264:'competition judge clipboard',265:'formal hat event fascinator',266:'cat cafe',267:'avocado plant seed',268:'istanbul bosphorus europe asia walk',269:'film location travel',270:'great migration serengeti wildebeest',
  271:'punch and judy seaside',272:'local theatre production stage',273:'arctic circle sign',274:'butterfly migration monarch',275:'yurt camping',276:'krampus parade austria',277:'hotel room service breakfast',278:'hotel minibar',279:'neighbours chatting home',280:'christmas abroad tropical',
  281:'viewing party friends tv',282:'olympics stadium',283:'friends moving house boxes',284:'crystal glasses table',285:'movie marathon trilogy',286:'matinee theatre',287:'putting up shelf diy',288:'adult climbing tree',289:'prague beer pint',290:'book signing author',
  291:'braille reading fingers',292:'ice fishing frozen lake',293:'lake bled church bell slovenia',294:'netherlands tulip fields',295:'bran castle romania dracula',296:'scafell pike lake district',297:'ben nevis scotland',298:'kilimanjaro mountain africa',299:'wimbledon centre court tennis',300:'long friendship friends celebration'
};

function imageQueryForGoal(g){
  const p=Number(g.position||0);
  if(IMAGE_OVERRIDES[p]) return IMAGE_OVERRIDES[p];
  return String(g.title||'bucket list experience')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\b(go|take|see|visit|attend|learn|do|have|get|make|be|become|try|watch|read|buy|ride|drink|eat|stay|spend|own|help|start|throw|build|celebrate)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function fallbackForCategory(category){
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Trips & Travel'];
}

// Goal imagery: every experience resolves from its OWN curated search phrase.
// Openverse is keyless, so we can search photograph results directly in the browser.
// Results are cached per experience and duplicates are deliberately avoided.
const IMAGE_CACHE_KEY = 'bb30-image-cache-v10-server';
let imageCache = {};
try { imageCache = JSON.parse(localStorage.getItem(IMAGE_CACHE_KEY) || '{}') || {}; } catch(e) { imageCache = {}; }
const claimedImages = new Set(Object.values(imageCache).filter(Boolean));
const imageQueue = [];
let activeImageRequests = 0;
const MAX_IMAGE_REQUESTS = 3;

function persistImageCache(){
  try { localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageCache)); } catch(e) {}
}

function cachedImageForGoal(g){
  return imageCache[String(g.position||g.id||'')] || '';
}

function openverseQueryForGoal(g){
  const curated = imageQueryForGoal(g);
  const categoryHints = {
    'Once-in-a-Lifetime / Major Experiences':'scenic adventure golden hour',
    'Trips & Travel':'beautiful travel destination editorial',
    'Short Trips & Days Out':'charming destination scenic editorial',
    'Activities, Events & Nights Out':'stylish lifestyle experience editorial',
    'Everyday / Easy Wins':'beautiful lifestyle natural light',
    'Life Milestones':'aspirational lifestyle natural light'
  };
  return `${curated} ${categoryHints[g.category]||''}`.trim();
}

function imageCandidateScore(hit, query){
  if(!hit || hit.watermarked) return -999;
  const url = hit.thumbnail || hit.url;
  if(!url || /\.svg(?:\?|$)/i.test(url)) return -999;
  let score = 0;
  const w = Number(hit.width)||0, h = Number(hit.height)||0;
  if(w >= 1800 || h >= 1800) score += 7;
  else if(w >= 1200 || h >= 1200) score += 5;
  else if(w >= 800 || h >= 800) score += 2;
  if(w && h){
    const ratio = w/h;
    if(ratio >= .62 && ratio <= 1.08) score += 6;
    else if(ratio >= .48 && ratio <= 1.35) score += 3;
  }
  const tags=(hit.tags||[]).map(t=>t?.name||t).join(' ');
  const hay = `${hit.title||''} ${tags}`.toLowerCase();
  const bad=/infographic|diagram|screenshot|logo|poster|flyer|brochure|map|chart|graph|text|signage|document|scan|illustration|drawing|vector|clipart|advert|template|menu|book cover/;
  if(bad.test(hay)) score -= 18;
  const good=/travel|landscape|mountain|coast|ocean|sunset|sunrise|adventure|outdoor|nature|city|architecture|vacation|holiday|scenic|sky|forest|lake|beach|night|light/;
  if(good.test(hay)) score += 3;
  const words = String(query).toLowerCase().split(/\s+/).filter(w=>w.length>3 && !['beautiful','scenic','editorial','lifestyle','natural','light','golden','hour','travel','adventure','stylish','aspirational','destination','experience'].includes(w));
  const matches=words.slice(0,6).filter(w=>hay.includes(w)).length;
  score += matches * 5;
  if(matches===0) score -= 10;
  if(hit.source==='stocksnap') score += 9;
  if(hit.source==='flickr') score += 2;
  if(hit.source==='wikimedia') score -= 2;
  return score;
}

async function fetchOpenverseImage(g){
  const q = openverseQueryForGoal(g);
  const p = Number(g.position || 0);
  // Same-origin Vercel function: avoids mobile-browser CORS failures from Openverse.
  return {
    primary:`/api/image?q=${encodeURIComponent(q)}&p=${encodeURIComponent(p)}`,
    fallback:''
  };
}

function applyResolvedImage(img, source){
  if(!img) return;
  const primary = typeof source==='string' ? source : (source?.primary || source?.fallback || '');
  const fallback = typeof source==='string' ? '' : (source?.fallback || '');

  if(!primary){
    img.dataset.resolved='1';
    return;
  }

  img.onload = ()=>{
    img.classList.add('is-loaded');
    img.closest('.goal-card')?.classList.add('has-photo');
    img.dataset.resolved='1';
  };

  img.onerror = ()=>{
    if(fallback && img.dataset.fallbackTried!=='1'){
      img.dataset.fallbackTried='1';
      img.src=fallback;
      return;
    }
    img.removeAttribute('src');
    img.classList.remove('is-loaded');
    img.dataset.resolved='1';
  };

  img.src = primary;
}

async function runImageJob(job){
  const {img,g,key} = job;
  try{
    if(imageCache[key]) return applyResolvedImage(img,imageCache[key]);
    const source = await fetchOpenverseImage(g);
    if(source?.primary || source?.fallback){
      const cacheValue = source.primary || source.fallback;
      imageCache[key]=cacheValue;
      claimedImages.add(cacheValue);
      persistImageCache();
      applyResolvedImage(img,source);
    } else {
      img.dataset.resolved='1';
    }
  }catch(e){
    console.warn('Image lookup failed for', g.title, e);
    img.dataset.resolved='1';
  }
}

function pumpImageQueue(){
  while(activeImageRequests < MAX_IMAGE_REQUESTS && imageQueue.length){
    const job=imageQueue.shift();
    if(!job?.img?.isConnected) continue;
    activeImageRequests++;
    runImageJob(job).finally(()=>{activeImageRequests--;pumpImageQueue();});
  }
}

function resolveGoalImage(img){
  if(!img || img.dataset.queued==='1' || img.dataset.resolved==='1') return;
  const id = img.closest('.goal-card')?.dataset.id;
  const g = state.goals.find(x=>String(x.id)===String(id));
  if(!g) return;
  const key=String(g.position||g.id||'');
  if(imageCache[key]) return applyResolvedImage(img,imageCache[key]);
  img.dataset.queued='1';
  imageQueue.push({img,g,key});
  pumpImageQueue();
}

function wireGoalImages(){
  const imgs=[...document.querySelectorAll('.goal-photo')];
  if(!('IntersectionObserver' in window)){ imgs.slice(0,16).forEach(resolveGoalImage); return; }
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){ resolveGoalImage(entry.target); io.unobserve(entry.target); }
    });
  },{rootMargin:'700px 0px'});
  imgs.forEach(img=>io.observe(img));
}

function renderList(){
  const s=stats();
  $('#listStats').textContent=`${s.done} of ${s.total} · ${s.pct}% complete`;
  $('#categoryFilters').innerHTML=['All',...CATS].map(c=>`<button class="${state.category===c?'active':''}" data-cat="${escapeHtml(c)}">${c==='All'?'All':ICONS[c]+' '+escapeHtml(FILTER_SHORT[c]||c)}</button>`).join('');
  $$('#categoryFilters button').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;renderList()});
  const goals=state.goals.filter(g=>(state.category==='All'||g.category===state.category)&&(state.status==='all'||(state.status==='done')===goalDone(g))&&g.title.toLowerCase().includes(state.search.toLowerCase()));
  const wrap=$('#goals');
  wrap.className=state.view==='cards'?'cards':'rows';
  wrap.innerHTML=goals.map(g=>`<article class="goal-card" data-id="${g.id}">
    <img class="goal-photo${cachedImageForGoal(g)?' is-loaded':''}" loading="lazy" decoding="async" ${cachedImageForGoal(g)?`src="${cachedImageForGoal(g)}"`:''} alt="${escapeHtml(g.title)}" onerror="this.removeAttribute('src');this.classList.remove('is-loaded')">
    <span class="goal-num">${String(g.position||'').padStart(3,'0')}</span>
    <div class="goal-shade"></div>
    <div class="goal-card-copy">
      <div class="card-title">${escapeHtml(g.title)}</div>
      <div class="meta">${escapeHtml((CAT_SHORT[g.category]||g.category).toUpperCase())}</div>
    </div>
    <button class="tick ${goalDone(g)?'done':''}" data-tick="${g.id}" aria-label="Toggle completion">${goalDone(g)?'✓':''}</button>
    <span class="row-more">⋯</span>
  </article>`).join('');
  $$('.goal-card').forEach(c=>c.onclick=e=>{if(e.target.closest('[data-tick]'))return;openGoal(c.dataset.id)});
  $$('[data-tick]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleGoal(b.dataset.tick)});
  wireGoalImages();
}

async function toggleGoal(id){
  const g=state.goals.find(x=>x.id===id);
  if(g.type!=='standard') return openGoal(id);
  const next=!g.completed;
  g.completed=next; renderAll();
  const { error } = await db.from('user_experiences').update({ completed:next }).eq('id',id);
  if(error){g.completed=!next;renderAll();showError('That change didn’t save.');}
}

function openGoal(id){
  const g=state.goals.find(x=>x.id===id); if(!g)return;
  let body=`<div class="goal-num">${g.position||''}</div><div class="goal-title">${escapeHtml(g.title)}</div><div class="goal-cat">${ICONS[g.category]||'◇'} ${escapeHtml(g.category)}</div>`;
  if(g.type==='standard') body+=`<button class="complete-btn" id="modalComplete">${goalDone(g)?'✓ Completed — tap to undo':'✓ Mark as complete'}</button>`;
  if(g.type==='counter') body+=`<div class="counter"><button id="minus">−</button><input id="counterInput" type="number" min="0" max="${g.target}" value="${g.current||0}"><button id="plus">＋</button></div><div style="text-align:center">of ${g.target}</div>`;
  if(g.type==='checklist') body+=(g.subgoals||[]).map((s,i)=>`<label class="subgoal"><input type="checkbox" data-sub="${i}" ${s.completed?'checked':''}> ${escapeHtml(s.title)}</label>`).join('');
  body+=`<div class="goal-actions"><button id="editGoal">Edit</button><button id="deleteFromSheet">Delete</button></div>`;
  $('#goalContent').innerHTML=body; $('#goalModal').classList.remove('hidden');
  $('#modalComplete')?.addEventListener('click',()=>toggleGoal(id).then(()=>openGoal(id)));
  $('#minus')?.addEventListener('click',()=>setCounter(g,Math.max(0,(+g.current||0)-1)));
  $('#plus')?.addEventListener('click',()=>setCounter(g,Math.min(g.target,(+g.current||0)+1)));
  $('#counterInput')?.addEventListener('change',e=>setCounter(g,Math.max(0,Math.min(g.target,+e.target.value||0))));
  $$('[data-sub]').forEach(x=>x.onchange=()=>setSubgoal(g,+x.dataset.sub,x.checked));
  $('#editGoal').onclick=()=>openEdit(g);
  $('#deleteFromSheet').onclick=()=>deleteGoal(g);
}

async function setCounter(g,value){
  g.current=value; g.completed=value>=g.target; renderAll(); openGoal(g.id);
  const { error }=await db.from('user_experiences').update({current_value:value,completed:g.completed}).eq('id',g.id);
  if(error) showError('Counter didn’t save.');
}
async function setSubgoal(g,index,checked){
  const s=g.subgoals[index]; s.completed=checked;
  g.completed=g.subgoals.every(x=>x.completed); renderAll(); openGoal(g.id);
  const [a,b]=await Promise.all([
    db.from('user_subgoals').update({completed:checked}).eq('id',s.id),
    db.from('user_experiences').update({completed:g.completed}).eq('id',g.id)
  ]);
  if(a.error||b.error) showError('Checklist change didn’t save.');
}

function renderMe(){
  const s=stats(); const name=currentUsername||'profile';
  $('#profileName').textContent='@'+name;
  $('#avatar').textContent=name.slice(0,2).toUpperCase();
  $('#mePct').textContent=s.pct+'%';
  $('#meDone').textContent=s.done+' completed';
  $('#meRemaining').textContent=s.remaining+' remaining';
  $('#meTotal').textContent=s.total+' total';
}

function openEdit(g=null){
  $('#goalModal').classList.add('hidden'); $('#editModal').classList.remove('hidden');
  $('#editHeading').textContent=g?'Edit experience':'Add a new experience';
  $('#editId').value=g?.id||''; $('#editTitle').value=g?.title||''; $('#editCategory').value=g?.category||CATS[0];
  $('#deleteGoalBtn').classList.toggle('hidden',!g);
}
function switchTab(id){
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id));
  $$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
}
function showOnboarding(){ $('#onboarding').classList.remove('hidden'); $('#app').classList.add('hidden'); }

async function saveEditedGoal(){
  const id=$('#editId').value, title=$('#editTitle').value.trim(), category=$('#editCategory').value;
  if(!title)return;
  if(id){
    const g=state.goals.find(x=>x.id===id); const old={title:g.title,category:g.category};
    g.title=title;g.category=category; $('#editModal').classList.add('hidden');renderAll();
    const {error}=await db.from('user_experiences').update({title,category}).eq('id',id);
    if(error){Object.assign(g,old);renderAll();showError('Edit didn’t save.');}
  } else {
    const nextPosition=Math.max(0,...state.goals.map(g=>+g.position||0))+1;
    const {data,error}=await db.from('user_experiences').insert({
      user_id:currentUser.id, master_experience_id:null, position:nextPosition, title, category,
      goal_type:'standard', target_value:null, current_value:0, completed:false, is_custom:true
    }).select().single();
    if(error){showError('Couldn’t add that experience.');return;}
    state.goals.push({id:data.id,masterId:null,position:data.position,title:data.title,category:data.category,type:'standard',target:null,current:0,completed:false,isCustom:true,subgoals:[]});
    $('#editModal').classList.add('hidden');renderAll();
  }
}

async function deleteGoal(g){
  if(!confirm('Delete this experience from your list?')) return;
  const before=[...state.goals]; state.goals=state.goals.filter(x=>x.id!==g.id);
  $('#goalModal').classList.add('hidden'); $('#editModal').classList.add('hidden'); renderAll();
  const {error}=await db.from('user_experiences').delete().eq('id',g.id);
  if(error){state.goals=before;renderAll();showError('Delete didn’t save.');}
}

async function resetToMaster(){
  if(!confirm('Reset your list to the original 300? Your ticks, edits and custom goals will be erased.'))return;
  showLoading('Resetting your list…');
  try{
    const [{data:master,error:mErr},{data:masterSubs,error:sErr}]=await Promise.all([
      db.from('master_experiences').select('*').order('position'),
      db.from('master_subgoals').select('*').order('position')
    ]);
    if(mErr||sErr)throw(mErr||sErr);
    const del=await db.from('user_experiences').delete().eq('user_id',currentUser.id); if(del.error)throw del.error;
    const payload=master.map(m=>({user_id:currentUser.id,master_experience_id:m.id,position:m.position,title:m.title,category:m.category,goal_type:m.goal_type,target_value:m.target_value,current_value:0,completed:false,is_custom:false}));
    const {data:newGoals,error:iErr}=await db.from('user_experiences').insert(payload).select('id,master_experience_id'); if(iErr)throw iErr;
    const idByMaster=new Map(newGoals.map(g=>[g.master_experience_id,g.id]));
    const subPayload=(masterSubs||[]).map(s=>({user_experience_id:idByMaster.get(s.master_experience_id),user_id:currentUser.id,position:s.position,title:s.title,completed:false})).filter(x=>x.user_experience_id);
    if(subPayload.length){const {error:ssErr}=await db.from('user_subgoals').insert(subPayload);if(ssErr)throw ssErr;}
    await loadApp();
  }catch(err){console.error(err);hideLoading();showError('Reset failed. Your current list may need reloading.');await loadApp();}
}

async function startAnotherProfile(){
  if(!confirm('Start a different profile on this device? Anonymous profiles cannot currently be recovered after signing out.'))return;
  await db.auth.signOut(); currentUser=null;currentUsername=null;state.goals=[];showOnboarding();
}

async function deleteProfile(){
  if(!confirm('Delete this profile and all of its list data? This cannot be undone.'))return;
  showLoading('Deleting profile…');
  try{
    await db.from('user_experiences').delete().eq('user_id',currentUser.id);
    const {error}=await db.from('profiles').delete().eq('id',currentUser.id); if(error)throw error;
    await db.auth.signOut(); currentUser=null;currentUsername=null;state.goals=[];hideLoading();showOnboarding();
  }catch(err){console.error(err);hideLoading();showError('Couldn’t delete the profile.');}
}

function exportList(){
  const blob=new Blob([JSON.stringify({username:currentUsername,exportedAt:new Date().toISOString(),goals:state.goals},null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`300-before-30-${currentUsername}.json`;a.click();URL.revokeObjectURL(a.href);
}

function bind(){
  $('#profileForm').onsubmit=e=>{e.preventDefault();createProfile($('#usernameInput').value)};
  $$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
  $$('nav button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('#searchBtn').onclick=()=>$('#searchInput').classList.toggle('hidden');
  $('#searchInput').oninput=e=>{state.search=e.target.value;renderList()};
  $$('[data-status]').forEach(b=>b.onclick=()=>{state.status=b.dataset.status;$$('[data-status]').forEach(x=>x.classList.toggle('active',x===b));renderList()});
  $$('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;$$('[data-view]').forEach(x=>x.classList.toggle('active',x===b));renderList()});
  $('#addGoal').onclick=()=>openEdit();
  $('#editForm').onsubmit=e=>{e.preventDefault();saveEditedGoal()};
  $('#deleteGoalBtn').onclick=()=>{const g=state.goals.find(x=>x.id===$('#editId').value);if(g)deleteGoal(g)};
  $('#exportBtn').onclick=exportList;
  $('#switchProfile').onclick=startAnotherProfile;
  $('#resetBtn').onclick=resetToMaster;
  $('#deleteProfile').onclick=deleteProfile;
}

function escapeHtml(v=''){
  return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

boot();
