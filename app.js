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

function renderHome(){
  const s=stats();
  $('#homePct').textContent=s.pct+'%';
  $('#homeCount').innerHTML=`${s.done} of ${s.total}<br>completed`;
  $('.ring').style.setProperty('--p',s.pct);
  $('#categoryGrid').innerHTML=CATS.map(c=>{
    const gs=state.goals.filter(g=>g.category===c), cs=stats(gs);
    return `<button class="category-card" data-cat="${escapeHtml(c)}">
      <span class="cat-icon">${ICONS[c]}</span>
      <strong>${escapeHtml(CAT_SHORT[c]||c)}</strong>
      <small>${cs.done} of ${cs.total} &nbsp; ${cs.pct}%</small>
      <span class="cat-progress"><i style="width:${cs.pct}%"></i></span>
    </button>`;
  }).join('');
  $$('.category-card').forEach(b=>b.onclick=()=>{ state.category=b.dataset.cat; switchTab('list'); renderList(); });
}

function visualClass(g,i){
  if (state.view==='rows') return '';
  const p=Number(g.position||i+1);
  if ([1,7,15,25,38,56,57,71,107,139,140,141,142,170,205,207,213,228,238,270,273,274,298].includes(p)) return `photo v${(p%4)+1}`;
  if (p%7===0) return 'dark';
  if (p%3===0) return 'editorial';
  if (i%5===0) return `photo v${(i%4)+1}`;
  return '';
}

function renderList(){
  const s=stats();
  $('#listStats').textContent=`${s.done} of ${s.total} · ${s.pct}% complete`;
  $('#categoryFilters').innerHTML=['All',...CATS].map(c=>`<button class="${state.category===c?'active':''}" data-cat="${escapeHtml(c)}">${c==='All'?'All':ICONS[c]+' '+escapeHtml(FILTER_SHORT[c]||c)}</button>`).join('');
  $$('#categoryFilters button').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;renderList()});
  const goals=state.goals.filter(g=>(state.category==='All'||g.category===state.category)&&(state.status==='all'||(state.status==='done')===goalDone(g))&&g.title.toLowerCase().includes(state.search.toLowerCase()));
  const wrap=$('#goals');
  wrap.className=state.view==='cards'?'cards':'rows';
  wrap.innerHTML=goals.map((g,i)=>`<article class="goal-card ${visualClass(g,i)}" data-id="${g.id}">
    <span class="goal-num">${g.position||''}</span>
    <div class="card-title">${escapeHtml(g.title)}</div>
    <div class="meta">${ICONS[g.category]||'◇'} ${escapeHtml((CAT_SHORT[g.category]||g.category).toUpperCase())}</div>
    <button class="tick ${goalDone(g)?'done':''}" data-tick="${g.id}" aria-label="Toggle completion">${goalDone(g)?'✓':''}</button>
    <span class="row-more">⋯</span>
  </article>`).join('');
  $$('.goal-card').forEach(c=>c.onclick=e=>{if(e.target.closest('[data-tick]'))return;openGoal(c.dataset.id)});
  $$('[data-tick]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleGoal(b.dataset.tick)});
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
