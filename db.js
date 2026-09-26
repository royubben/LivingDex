/* Cobblemon LivingDex V1.7.3 — trainer cards, badges, daily competition and history. */
(() => {
  const CFG = window.LIVINGDEX_SUPABASE || {};
  const ONLINE = !!(CFG.url && CFG.key && window.supabase);
  let client = null;
  let currentUser = null;
  let syncTimer = null;
  let syncInFlight = false;
  let syncAgain = false;
  let syncRevision = 0;
  let loadedUserId = null;
  let currentView = 'dex';

  if (ONLINE) client = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = (a,b) => b ? Math.round(Number(a||0) / Number(b) * 100) : 0;
  let entryMapCache=null;
  const entryMap = () => { if(entryMapCache) return entryMapCache; entryMapCache=new Map((window.__getLivingDexEntries?.()||[]).map(e=>[e.id,e])); return entryMapCache; };
  const resetEntryMap = () => { entryMapCache=null; };
  const generationName = n => ['','I','II','III','IV','V','VI','VII','VIII','IX'][Number(n)] || String(n);
  let cachedTrainingRaw=''; let cachedTrainingValue={};
  const localTrainingStats = () => { const raw=localStorage.getItem('cobblemon-livingdex-training') || '{}'; if(raw===cachedTrainingRaw) return cachedTrainingValue; cachedTrainingRaw=raw; try { cachedTrainingValue=JSON.parse(raw)||{}; } catch { cachedTrainingValue={}; } return cachedTrainingValue; };
  const dailyInfo = () => { const t=localTrainingStats(), d=t.__daily||{}; return {streak:Number(d.streak||0), bestStreak:Number(d.bestStreak||0), lastCompleted:d.lastCompleted||'', totalCompleted:Number(d.totalCompleted||0)}; };
  const dailyDateKeyForDb = () => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; };
  const localBadges = () => { try { const s=window.getCollectionStatsV14?.(); const ms=window.getMilestoneDefinitions?.(s||{}); return Array.isArray(ms)?ms.filter(x=>x.unlocked):[]; } catch { return []; } };
  const badgeMeta = () => { try { const a=window.getMilestoneDefinitions?.(window.getCollectionStatsV14?.()||{})||[]; return Array.isArray(a)?a:[]; } catch { return []; } };
  const featuredBadgesLocal = () => { try { return window.getFeaturedBadgesV17?.()||[]; } catch { return []; } };
  const profileMetaLocal = () => { try { return window.getProfileMetaV17?.()||{}; } catch { return {}; } };
  const catchHistoryLocal = () => { try { return window.getCatchHistoryV17?.()||[]; } catch { return []; } };
  const profileLocal = () => { try { return JSON.parse(localStorage.getItem('cobblemon-livingdex-profile') || 'null'); } catch { return null; } };
  const localPayload = () => ({
    state: window.state || {},
    favorites: window.favorites || {},
    notes: window.notes || {},
    team: window.team || [],
    training: (() => { try { const t=JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}'); t.__journey=window.journey||JSON.parse(localStorage.getItem('cobblemon-livingdex-journey')||'{\"version\":1,\"events\":[],\"owned\":{}}'); return t; } catch { return {__journey:window.journey||{version:1,events:[],owned:{}}}; } })(),
    settings: { theme: localStorage.getItem('livingdex-theme') || 'dark' },
  });

  function onlineNotice() {
    if (!ONLINE) return '<div class="online-setup"><b>Online features are not connected yet.</b><span>Create a Supabase project, run <code>supabase_schema.sql</code>, then put its Project URL and publishable/anon key in <code>db-config.js</code>.</span></div>';
    return '';
  }

  function openModal(html, cls='online-modal-wrap') {
    const old = document.getElementById('onlineModalWrap'); old?.remove();
    const wrap = document.createElement('div'); wrap.id='onlineModalWrap'; wrap.className=cls;
    wrap.innerHTML = `<div class="online-modal">${html}</div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => { if(e.target===wrap) wrap.remove(); });
    wrap.querySelector('[data-close]')?.addEventListener('click',()=>wrap.remove());
    return wrap;
  }

  function authModal(mode='login') {
    if (!ONLINE) return openModal(`<button class="info-close" data-close>×</button><div class="eyebrow">ONLINE ACCOUNT</div><h2>Connect your LivingDex</h2>${onlineNotice()}<div class="online-actions"><button class="primary" data-close>Close</button></div>`);
    const signup = mode==='signup';
    const w = openModal(`<button class="info-close" data-close>×</button><div class="eyebrow">TRAINER ACCOUNT</div><h2>${signup?'Create account':'Sign in'}</h2><p>${signup?'Create your online account to sync your LivingDex across devices.':'Sign in to load your online LivingDex.'}</p><label>Email<input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></label><label>Password<input id="authPassword" type="password" autocomplete="current-password" placeholder="••••••••"></label><div id="authError" class="online-error" hidden></div><div class="online-actions"><button id="authSubmit" class="primary">${signup?'Create account':'Sign in'}</button><button id="authSwitch" class="secondary">${signup?'Already have an account? Sign in':'Create an account'}</button></div>`);
    w.querySelector('#authSubmit').onclick=async()=>{
      const email=w.querySelector('#authEmail').value.trim(), password=w.querySelector('#authPassword').value;
      const err=w.querySelector('#authError'); err.hidden=true;
      if(!email||password.length<6){err.textContent='Enter a valid email and a password of at least 6 characters.';err.hidden=false;return;}
      const result=signup ? await client.auth.signUp({email,password}) : await client.auth.signInWithPassword({email,password});
      if(result.error){err.textContent=result.error.message;err.hidden=false;return;}
      if(signup && !result.data.session){err.textContent='Account created. Check your email to confirm the account, then sign in.';err.hidden=false;return;}
      w.remove(); await refreshSession(); await loadOnline(); renderAccountState();
    };
    w.querySelector('#authSwitch').onclick=()=>{w.remove();authModal(signup?'login':'signup');};
  }

  async function refreshSession(){ if(!ONLINE) return; const {data}=await client.auth.getSession(); currentUser=data?.session?.user||null; }

  async function loadOnline(){
    if(!ONLINE||!currentUser)return false;
    // A local change that has not synced is authoritative. Never overwrite it
    // with an older cloud snapshot.
    if(localStorage.getItem('cobblemon-livingdex-local-dirty')){
      const ok=await saveOnline();
      if(!ok)return false;
    }
    const {data:p,error:pe}=await client.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
    const {data:s,error:se}=await client.from('player_saves').select('*').eq('user_id',currentUser.id).maybeSingle();
    if(pe||se){console.warn('LivingDex online load failed',pe||se);return false;}
    if(p){
      const lp=profileLocal()||{};
      localStorage.setItem('cobblemon-livingdex-profile',JSON.stringify({...lp,...p,trainerName:p.display_name,assistantName:p.dex_name}));
    }
    if(s){
      const remoteTraining=s.training||{};
      const remoteEmpty=!Object.keys(s.state||{}).length&&!Object.keys(s.favorites||{}).length&&!Object.keys(s.notes||{}).length&&!(s.team||[]).length&&!Object.keys(remoteTraining).length;
      const local=localPayload();
      const localNonEmpty=Object.keys(local.state).length||Object.keys(local.favorites).length||Object.keys(local.notes).length||local.team.length||Object.keys(local.training).length||local.settings.theme!=='dark';
      if(remoteEmpty&&localNonEmpty){const ok=await saveOnline();if(!ok)return false;}
      else if(!localStorage.getItem('cobblemon-livingdex-local-dirty')){
        ['state','favorites','notes'].forEach(k=>{if(window[k]&&s[k]){Object.keys(window[k]).forEach(x=>delete window[k][x]);Object.assign(window[k],s[k]);}});
        if(Array.isArray(s.team)&&Array.isArray(window.team))window.team.splice(0,window.team.length,...s.team);
        window.invalidateCollectionStatsV17?.();
        try{const rt={...(s.training||{})},rs=rt.__settings||{},rj=rt.__journey;delete rt.__settings;delete rt.__journey;if(rj&&window.journey){Object.keys(window.journey).forEach(k=>delete window.journey[k]);Object.assign(window.journey,rj);localStorage.setItem('cobblemon-livingdex-journey',JSON.stringify(window.journey));}localStorage.setItem('cobblemon-livingdex-training',JSON.stringify(rt));if(rs.theme)localStorage.setItem('livingdex-theme',rs.theme);window.refreshTrainingStateV17?.();}catch{}
      }
    }else{const ok=await saveOnline();if(!ok)return false;}
    loadedUserId=currentUser.id;
    if(window.v2Navigate && window.renderV2Home){ window.renderTopNav?.(); window.renderView?.(); } else { window.render?.(); window.renderProgressPlus?.(); }
    return true;
  }

  async function saveOnline(){
    if(!ONLINE||!currentUser)return false;
    if(syncInFlight){syncAgain=true;return false;}
    syncInFlight=true;
    const dirtyAt=localStorage.getItem('cobblemon-livingdex-local-dirty');
    const revisionAt=++syncRevision;
    try{
      const payload=localPayload(),profile=profileLocal()||{},cloudTraining={...(payload.training||{}),__settings:payload.settings||{}},now=new Date().toISOString();
      const {error:pe}=await client.from('profiles').upsert({id:currentUser.id,display_name:profile.trainerName||profile.display_name||'Trainer',dex_name:profile.assistantName||profile.dex_name||'Dex',favorite_pokemon:profile.favoritePokemon||null,favorite_type:profile.favoriteType||null,favorite_region:profile.favoriteRegion||null,favorite_generation:profile.favoriteGeneration?Number(profile.favoriteGeneration):null,bio:profile.bio||null,show_profile:profile.showProfile!==false,show_in_players:profile.showInPlayers!==false,show_on_leaderboard:profile.showOnLeaderboard!==false,show_team:profile.showTeam!==false,updated_at:now});
      if(pe){console.warn('LivingDex online profile save failed',pe);return false;}
      const {error:se}=await client.from('player_saves').upsert({user_id:currentUser.id,state:payload.state,favorites:payload.favorites,notes:payload.notes,team:payload.team,training:cloudTraining,updated_at:now});
      if(se){console.warn('LivingDex online save failed',se);return false;}
      const dirtyNow=localStorage.getItem('cobblemon-livingdex-local-dirty');
      if(dirtyNow===dirtyAt && syncRevision===revisionAt){
        localStorage.removeItem('cobblemon-livingdex-local-dirty');
      }else{
        syncAgain=true;
      }
      return true;
    }finally{
      syncInFlight=false;
      if(syncAgain){syncAgain=false;queueSave();}
    }
  }
  function queueSave(){if(!currentUser)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>saveOnline(),350);}

  function localTraining(){ try { return JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}'); } catch { return {}; } }
  function localTheme(){ return localStorage.getItem('livingdex-theme') || 'dark'; }
  let lastTrainingSnapshot = JSON.stringify(localTraining());
  let lastThemeSnapshot = localTheme();
  function watchLocalOnlineData(){
    if(!currentUser) return;
    const t=JSON.stringify(localTraining());
    const th=localTheme();
    if(t!==lastTrainingSnapshot || th!==lastThemeSnapshot){
      lastTrainingSnapshot=t; lastThemeSnapshot=th; queueSave();
    }
  }

  async function logout(){if(ONLINE&&currentUser){clearTimeout(syncTimer);await saveOnline();await client.auth.signOut();}currentUser=null;loadedUserId=null;renderAccountState();}

  function openProfileView(){
    try{
      currentView='account';
      window.renderTopNav?.();
      window.renderView?.();
      if(!document.querySelector('.profile-page-v17')) profilePage();
      window.scrollTo?.({top:0,behavior:'smooth'});
    }catch(err){
      console.error('Profile navigation failed',err);
      try{profilePage();}catch{}
    }
  }

  function renderAccountState(){
    const current=$('#profileBtn'); if(!current)return;
    const b=current.cloneNode(true);
    current.replaceWith(b);
    b.type='button';
    b.removeAttribute('data-view');
    b.setAttribute('aria-label','Open profile');
    b.innerHTML=currentUser ? `☁ <span>${esc(profileLocal()?.trainerName||currentUser.email?.split('@')[0]||'Account')}</span>` : '👤 <span>Profile</span>';
    const openProfileFromButton=(e)=>{
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      currentView='account';
      window.renderTopNav?.();
      profilePage();
      window.scrollTo?.({top:0,behavior:'smooth'});
    };
    b.onclick=openProfileFromButton;
    b.onpointerup=openProfileFromButton;
    b.onkeydown=(e)=>{if(e.key==='Enter'||e.key===' '){openProfileFromButton(e);}};
  }

  function openFeaturedBadgeEditor(){
    const all=badgeMeta(), unlocked=all.filter(x=>x.unlocked), current=new Set(featuredBadgesLocal().filter(id=>unlocked.some(x=>x.id===id)));
    const w=openModal(`<button class="info-close" data-close>×</button><div class="eyebrow">TRAINER CARD</div><h2>Choose featured badges</h2><p>Select up to 5 unlocked badges to display on your Trainer Card and public profile.</p><div class="featured-badge-picker">${unlocked.map(m=>`<button class="featured-picker ${current.has(m.id)?'selected':''}" data-featured-id="${esc(m.id)}"><img src="${esc(m.asset)}" alt=""><span><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></span><i>${current.has(m.id)?'✓':''}</i></button>`).join('')||'<div class="empty-panel">Earn a badge first.</div>'}</div><div class="featured-picker-footer"><span id="featuredCount">${current.size}/5 selected</span><button id="saveFeaturedBadges" class="primary">Save selection</button></div>`);
    w.querySelectorAll('[data-featured-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.featuredId;if(current.has(id))current.delete(id);else if(current.size<5)current.add(id);else return; b.classList.toggle('selected',current.has(id));b.querySelector('i').textContent=current.has(id)?'✓':'';w.querySelector('#featuredCount').textContent=`${current.size}/5 selected`;});
    w.querySelector('#saveFeaturedBadges').onclick=()=>{window.setFeaturedBadgesV17?.([...current]);w.remove();profilePage();};
  }
  function renderTrainerCardHtml(p, stats, featured, isPublic=false){
    const featuredDefs=((window.getMilestoneDefinitions?.(stats)||milestoneDefinitions(stats)).filter(m=>featured.includes(m.id)&&(!isPublic||m.unlocked)));
    const favId=p.favoritePokemon||p.favorite_pokemon||''; const favEntry=favId?entryMap().get(favId):null;
    const favSprite=favEntry?`<img class="trainer-favorite-art" loading="lazy" decoding="async" src="${window.spritePath(favEntry)}" alt="${esc(favEntry.name)}">`:'';
    const meta=p.profileMeta||{}; const banner=meta.banner||p.banner||'aurora'; const ign=meta.ign||p.ign||''; const bio=meta.bio||p.bio||'';
    return `<section class="trainer-card-v17"><div class="trainer-card-banner banner-${esc(banner)}"><div class="trainer-card-banner-glow"></div><div class="trainer-card-title"><span class="eyebrow">TRAINER CARD</span><h2>${esc(p.trainerName||p.display_name||'Trainer')}</h2>${ign?`<p class="trainer-ign">IGN · ${esc(ign)}</p>`:''}<p>Trainer since ${esc(String(p.created_at||'2026').slice(0,4))}</p>${bio?`<div class="trainer-bio">${esc(bio)}</div>`:''}</div>${favSprite}</div><div class="trainer-card-stats"><div><b>${stats.caught}</b><span>Pokémon Caught</span></div><div><b>${pct(stats.caught,stats.total)}%</b><span>Complete</span></div><div><b>${stats.daily.streak}</b><span>Catch Calendar Streak</span></div><div><b>${stats.daily.bestStreak}</b><span>Best Catch Calendar Streak</span></div><div><b>${stats.training.rank}</b><span>Training Rank</span></div></div><div class="trainer-card-lower"><div class="trainer-favorites"><span class="eyebrow">FAVORITES</span><b>${esc(p.favoritePokemon||p.favorite_pokemon||'Choose a Pokémon')}</b><small>${esc(p.favoriteType||p.favorite_type||'Choose a type')} ${p.favoriteRegion||p.favorite_region?'· '+esc(p.favoriteRegion||p.favorite_region):''}</small></div><div class="trainer-featured"><div class="trainer-featured-head"><span class="eyebrow">FEATURED BADGES</span>${isPublic?'':`<button id="editFeaturedBadges" class="secondary">Edit</button>`}</div><div class="featured-badge-row">${featuredDefs.map(m=>`<div class="featured-badge-item"><img loading="lazy" decoding="async" src="${esc(m.asset)}" alt="${esc(m.name)}"><span>${esc(m.name)}</span></div>`).join('')||'<div class="empty-panel">No featured badges selected.</div>'}</div></div></div></section>`;
  }
  function openCatchHistoryModal(){
    const all=catchHistoryLocal(), entries=window.__getLivingDexEntries?.()||[];
    const rows=all.filter(a=>!!window.state?.[a.entryId]).map(a=>{const e=entryMap().get(a.entryId);const d=new Date(a.ts);return `<div class="history-row"><time>${esc(new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d))}<small>${esc(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))}</small></time><div>${e?`<img loading="lazy" decoding="async" src="${window.spritePath(e)}" alt="${esc(e.name)}"><b>${esc(e.name)}</b>`:`<b>${esc(a.name||a.entryId||'Pokémon')}</b>`}</div><span>Caught</span></div>`;}).join('')||'<div class="empty-panel">No catches recorded yet.</div>';
    openModal(`<button class="info-close" data-close>×</button><div class="eyebrow">COLLECTION HISTORY</div><h2>Catch History</h2><p>Your recorded Pokémon catches, newest first.</p><div class="history-list">${rows}</div>`,'online-modal-wrap history-modal-wrap');
  }
  function profilePage(){
    const p={...(profileLocal()||{}),profileMeta:profileMetaLocal()};
    const all=typeof window.__getLivingDexEntries==='function'?window.__getLivingDexEntries().filter(e=>e.id):[];
    const main=all.filter(e=>e.box);
    const caught=all.filter(e=>window.state?.[e.id]).length;
    const favorites=Object.values(window.favorites||{}).filter(Boolean).length;
    const missing=Math.max(0,all.length-caught);
    const teamCount=Array.isArray(window.team)?window.team.length:0;
    const byBox={};main.forEach(e=>{if(!byBox[e.box])byBox[e.box]={total:0,caught:0};byBox[e.box].total++;if(window.state?.[e.id])byBox[e.box].caught++;});
    const boxesComplete=Object.values(byBox).filter(x=>x.total===x.caught&&x.total>0).length;
    try{window.touchDailyCompletion?.();}catch{}
    const ds=dailyInfo(), badges=localBadges(), ts=window.getTrainingSummaryV14?.()||{}, s=window.getCollectionStatsV14?.()||{total:all.length,caught,missing,favoriteCount:favorites,fullBoxes:boxesComplete,daily:{streak:ds.streak,bestStreak:ds.bestStreak},training:ts};
    const featured=featuredBadgesLocal().filter(id=>badges.some(m=>m.id===id)).slice(0,5);
    const generations=(s.generations||[]).map(g=>`<div class="profile-generation-row"><span>Generation ${generationName(g.g)}</span><div class="progress-track"><i style="width:${g.p}%"></i></div><strong>${g.p}%</strong></div>`).join('');
    const catches=catchHistoryLocal().filter(a=>!!window.state?.[a.entryId]).slice(0,10).map(a=>{const e=entryMap().get(a.entryId);const d=new Date(a.ts);return `<div class="history-row compact"><time>${esc(new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short'}).format(d))}<small>${esc(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))}</small></time><div>${e?`<img loading="lazy" decoding="async" src="${window.spritePath(e)}" alt="${esc(e.name)}"><b>${esc(e.name)}</b>`:`<b>${esc(a.name||'Pokémon')}</b>`}</div><span>caught</span></div>`;}).join('')||'<div class="empty-panel">No catches recorded yet.</div>';
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page profile-page-v17"><div class="page-title profile-page-title-v17"><div><div class="eyebrow">TRAINER PROFILE</div><h2>${esc(p.trainerName||'Trainer')}</h2><p>${currentUser?esc(currentUser.email||''):'Local profile — sign in to sync online.'}</p></div><div class="profile-title-actions"><div class="online-status ${currentUser?'connected':''}">${currentUser?'● Online':'○ Offline account'}</div><button id="profileEditTop" class="primary profile-edit-top">Edit Profile</button></div></div>${renderTrainerCardHtml({...p,display_name:p.trainerName},s,featured)}<section class="profile-account-bar"><div><span class="eyebrow">ACCOUNT</span><h3>${currentUser?'Online account connected':'Local account'}</h3><p>${currentUser?esc(currentUser.email||''):'Your collection is saved locally. Sign in to sync it across devices.'}</p></div><div class="online-actions profile-account-actions">${currentUser?'<button id="profileSignOutTop" class="secondary">Sign out</button>':'<button id="profileSignInTop" class="primary">Sign in</button><button id="profileSignUpTop" class="secondary">Create account</button>'}</div></section><section class="profile-stat-grid profile-stat-grid-eight"><div><b>${caught}</b><span>Total caught</span></div><div><b>${missing}</b><span>Missing</span></div><div><b>${pct(caught,all.length)}%</b><span>Complete</span></div><div><b>${favorites}</b><span>Favorites</span></div><div><b>${teamCount}/6</b><span>Team</span></div><div><b>${boxesComplete}</b><span>Full boxes</span></div><div class="stat-accent"><b>${ds.streak}</b><span>Daily streak</span></div><div><b>${badges.length}</b><span>Badges earned</span></div></section><section class="profile-section"><div class="section-heading"><div><span class="eyebrow">BADGES</span><h3>Milestone Collection</h3></div><span class="section-note">${badges.length} unlocked</span></div><div class="profile-badges v17-badge-grid">${badgeMeta().map(m=>`<button class="profile-badge-tile ${m.unlocked?'unlocked':'locked'}" data-badge-id="${esc(m.id)}"><img loading="lazy" decoding="async" src="${esc(m.asset)}" alt="${esc(m.name)}"><b>${esc(m.name)}</b><small>${esc(m.unlocked?m.desc:'Locked')}</small></button>`).join('')}</div></section><section class="profile-section"><div class="section-heading"><div><span class="eyebrow">TRAINING</span><h3>${esc(ts.rank||'Rookie')} Rank</h3></div><span class="section-note">${ts.accuracy||0}% accuracy</span></div><div class="training-profile-stats"><span>${ts.totalQuestions||0} questions</span><span>${ts.totalCorrect||0} correct</span><span>${ts.totalSessions||0} sessions</span><span>${ts.perfectSessions||0} perfect sessions</span><span>${ts.fastAnswers||0} fast answers</span></div></section><section class="profile-section"><div class="section-heading"><div><span class="eyebrow">CATCH HISTORY</span><h3>Recent catches</h3></div><button id="viewAllCatchHistory" class="secondary">View all</button></div><div class="history-list history-list-short">${catches}</div></section><section class="profile-section"><div class="section-heading"><div><span class="eyebrow">GENERATIONS</span><h3>Completion</h3></div></div><div class="profile-generation-list">${generations}</div></section><div class="online-grid"><section class="team-panel"><span class="eyebrow">ACCOUNT</span><h3>${currentUser?'Connected':'Not connected'}</h3><p>${currentUser?'Your LivingDex can sync between devices.':'Your current collection remains local until you connect an account.'}</p><div class="online-actions">${currentUser?'<button id="editProfileOnline" class="primary">Edit Profile</button><button id="syncNow" class="secondary">Sync now</button><button id="logoutOnline" class="secondary">Sign out</button>':'<button id="loginOnline" class="primary">Sign in</button><button id="signupOnline" class="secondary">Create account</button>'}</div></section><section class="team-panel"><span class="eyebrow">PRIVACY</span><h3>Profile visibility</h3><label class="switch-row"><span>Show me in Players</span><input type="checkbox" id="showPlayers" ${p.showInPlayers!==false?'checked':''}></label><label class="switch-row"><span>Show on Leaderboard</span><input type="checkbox" id="showLeaderboard" ${p.showOnLeaderboard!==false?'checked':''}></label><label class="switch-row"><span>Show my team publicly</span><input type="checkbox" id="showTeam" ${p.showTeam!==false?'checked':''}></label></section></div></div>`;
    $('#editFeaturedBadges')?.addEventListener('click',openFeaturedBadgeEditor);$('#profileEditTop')?.addEventListener('click',()=>window.openProfileOptions?.());
    $('#profileSignInTop')?.addEventListener('click',()=>authModal('login'));$('#profileSignUpTop')?.addEventListener('click',()=>authModal('signup'));$('#profileSignOutTop')?.addEventListener('click',logout);$('#loginOnline')?.addEventListener('click',()=>authModal('login'));$('#signupOnline')?.addEventListener('click',()=>authModal('signup'));$('#editProfileOnline')?.addEventListener('click',()=>window.openProfileOptions?.());$('#logoutOnline')?.addEventListener('click',logout);$('#syncNow')?.addEventListener('click',async()=>{const ok=await saveOnline();alert(ok?'Synced.':'Sync failed — your local save was kept.');});$('#viewAllCatchHistory')?.addEventListener('click',openCatchHistoryModal);
    ['showPlayers','showLeaderboard','showTeam'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{const key={showPlayers:'showInPlayers',showLeaderboard:'showOnLeaderboard',showTeam:'showTeam'}[id];const q=profileLocal()||{};q[key]=$('#'+id).checked;localStorage.setItem('cobblemon-livingdex-profile',JSON.stringify(q));localStorage.setItem('cobblemon-livingdex-local-dirty',String(Date.now()));queueSave();}));
  }

  async function playersPage(){
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page players-page-v17"><div class="page-title"><div><div class="eyebrow">COMMUNITY</div><h2>Players</h2><p>Explore public trainers, their badges, streaks and teams.</p></div></div>${onlineNotice()}<div class="search player-search"><span>⌕</span><input id="playerSearch" placeholder="Search players..." autocomplete="off"></div><div id="playersList" class="players-list"><div class="empty-panel">Loading players…</div></div></div>`;
    if(!ONLINE)return;

    const listEl=$('#playersList');
    let playerProfiles=[], playerStatsMap=new Map();
    const draw=()=>{
      const q=($('#playerSearch')?.value||'').trim().toLowerCase();
      const list=playerProfiles.filter(p=>{
        const hay=[p.display_name,p.dex_name,p.favorite_pokemon,p.favorite_type,p.favorite_region].filter(Boolean).join(' ').toLowerCase();
        return !q||hay.includes(q);
      });
      listEl.innerHTML=list.map(p=>{
        const st=playerStatsMap.get(p.id)||{}, training=st.training||{}, ds=training.__daily||{}, keys=['who','type','evolution','pokedex','generation'];
        const totalQ=keys.reduce((n,k)=>n+Number(training[k]?.questions||0),0), totalC=keys.reduce((n,k)=>n+Number(training[k]?.correct||0),0);
        const badgeBase={caught:Object.values(st.state||{}).filter(Boolean).length,total:0,mainCaught:0,mainTotal:0,favoriteCount:Object.values(st.favorites||{}).filter(Boolean).length,fullBoxes:0,daily:{streak:Number(ds.streak||0),bestStreak:Number(ds.bestStreak||0)},training:{totalQuestions:totalQ,totalCorrect:totalC,bestScore:keys.reduce((m,k)=>Math.max(m,Number(training[k]?.best||0)),0),perfectModes:keys.filter(k=>Number(training[k]?.best||0)>=10).length,totalSessions:Number(training.__trainingSessions||Math.floor(totalQ/10)),perfectSessions:Number(training.__perfectSessions||0),fastAnswers:Number(training.__fastAnswers||0),modeSummary:Object.fromEntries(keys.map(k=>{const qq=Number(training[k]?.questions||0),cc=Number(training[k]?.correct||0);return[k,{questions:qq,correct:cc,accuracy:qq?Math.round(cc/qq*100):0,best:Number(training[k]?.best||0)}]}))}};
        const badges=(window.getMilestoneDefinitions?.(badgeBase)||[]).filter(x=>x.unlocked);
        const featured=(training.__profile?.featuredBadges||[]).slice(0,5).map(id=>badges.find(x=>x.id===id)).filter(Boolean);
        const caught=Object.values(st.state||{}).filter(Boolean).length;
        return `<article class="player-card player-card-v17" role="button" tabindex="0" data-player-id="${esc(p.id)}" onclick="window.openPlayerProfile?.('${esc(p.id)}')" onpointerup="window.openPlayerProfile?.('${esc(p.id)}')"><div class="player-avatar">${esc((p.display_name||'T').slice(0,1).toUpperCase())}</div><div class="player-card-copy"><div class="player-card-name-row"><b>${esc(p.display_name||'Trainer')}</b><span>${esc((playerStatsMap.get(p.id)?.training?.__profile?.ign)||'IGN not set')}</span></div><small>${esc([p.favorite_pokemon,p.favorite_type,p.favorite_region].filter(Boolean).join(' · ')||'Pokémon Trainer')}</small><div class="player-card-stats-mini"><span>◉ ${caught} caught</span><span>🔥 ${Number(ds.streak||0)} day streak</span><span>🏅 ${badges.length} badges</span></div><div class="player-featured-mini">${featured.map(m=>`<img loading="lazy" decoding="async" src="${esc(m.asset)}" alt="${esc(m.name)}">`).join('')}</div></div><span class="player-card-arrow">›</span></article>`;
      }).join('')||'<div class="empty-panel">No players found.</div>';
    };
    listEl.addEventListener('click',e=>{
      const card=e.target.closest('[data-player-id]');
      if(!card||!listEl.contains(card))return;
      e.preventDefault();e.stopPropagation();playerDetail(card.dataset.playerId);
    });
    listEl.addEventListener('keydown',e=>{
      if(e.key!=='Enter'&&e.key!==' ')return;
      const card=e.target.closest('[data-player-id]');
      if(!card)return;
      e.preventDefault();playerDetail(card.dataset.playerId);
    });
    let playerSearchTimer=0;
    $('#playerSearch').oninput=()=>{clearTimeout(playerSearchTimer);playerSearchTimer=setTimeout(draw,120);};
    const [profilesRes,statsRes]=await Promise.all([
      client.from('profiles').select('id,display_name,dex_name,favorite_pokemon,favorite_type,favorite_region,favorite_generation,show_team').eq('show_profile',true).eq('show_in_players',true).limit(100),
      client.from('player_public_stats').select('user_id,state,favorites,team,training').limit(100)
    ]);
    if(profilesRes.error||statsRes.error){listEl.innerHTML=`<div class="online-error">${esc((profilesRes.error||statsRes.error).message)}</div>`;return;}
    playerProfiles=profilesRes.data||[];
    playerStatsMap=new Map((statsRes.data||[]).map(x=>[x.user_id,x]));
    draw();
  }

  async function playerDetail(id){
    if(!ONLINE||!id)return;
    try{
    const [profileRes,statsRes]=await Promise.all([
      client.from('profiles').select('id,display_name,dex_name,favorite_pokemon,favorite_type,favorite_region,favorite_generation,show_team,created_at').eq('id',id).maybeSingle(),
      client.from('player_public_stats').select('state,favorites,team,training').eq('user_id',id).maybeSingle()
    ]);
    if(profileRes.error){openModal(`<button class="info-close" data-close>×</button><div class="online-error">${esc(profileRes.error.message)}</div>`);return;}
    const p=profileRes.data;if(!p){openModal(`<button class="info-close" data-close>×</button><div class="empty-panel">This player profile is no longer available.</div>`);return;}
    const s=statsRes.data||{};
    const publicTraining=s.training||{}, pd=publicTraining.__daily||{}, modeKeys=['who','type','evolution','pokedex','generation'];
    const pq=modeKeys.reduce((n,k)=>n+Number(publicTraining[k]?.questions||0),0), pc=modeKeys.reduce((n,k)=>n+Number(publicTraining[k]?.correct||0),0), pb=modeKeys.reduce((m,k)=>Math.max(m,Number(publicTraining[k]?.best||0)),0);
    const publicStats=window.getCollectionStatsFromV14?.(s.state||{},s.favorites||{},publicTraining)||{caught:Object.values(s.state||{}).filter(Boolean).length,total:window.__getLivingDexEntries?.().length||0,favoriteCount:Object.values(s.favorites||{}).filter(Boolean).length,fullBoxes:0,daily:{streak:Number(pd.streak||0),bestStreak:Number(pd.bestStreak||0)},training:{totalQuestions:pq,totalCorrect:pc,bestScore:pb,perfectModes:modeKeys.filter(k=>Number(publicTraining[k]?.best||0)>=10).length}};
    const publicBadges=window.getMilestoneDefinitions?.(publicStats)||[], earned=publicBadges.filter(x=>x.unlocked);
    const featured=Array.isArray(publicTraining.__profile?.featuredBadges)?publicTraining.__profile.featuredBadges:[];
    const teamArr=Array.isArray(s.team)?s.team:[];
    const p2={...p,trainerName:p.display_name,profileMeta:publicTraining.__profile||{}};
    const card=renderTrainerCardHtml(p2,publicStats,featured,true);
    const teamHtml=p.show_team?`<section class="public-profile-section"><div class="section-heading"><div><span class="eyebrow">TEAM</span><h3>Public Team</h3></div><span class="section-note">${teamArr.length}/6</span></div><div class="public-team public-team-v17">${teamArr.map(id=>{const e=entryMap().get(id);return e?`<article class="public-team-card"><img loading="lazy" decoding="async" src="${window.spritePath(e)}" alt="${esc(e.name)}"><b>${esc(e.name)}</b><span>${entryTypes(e).map(typeLabel).join(' / ')}</span></article>`:`<article class="public-team-card"><b>${esc(id)}</b></article>`}).join('')||'<div class="empty-panel">No public team.</div>'}</div></section>`:'';
    const badgeHtml=earned.map(m=>`<article class="public-badge-card"><img loading="lazy" decoding="async" src="${esc(m.asset)}" alt="${esc(m.name)}"><div><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div></article>`).join('')||'<div class="empty-panel">No badges earned yet.</div>';
    const profileCaught=Object.values(s.state||{}).filter(Boolean).length;
    openModal(`<button class="info-close" data-close>×</button><div class="public-player-modal"><div class="public-player-head"><div><span class="eyebrow">TRAINER PROFILE</span><h2>${esc(p.display_name||'Trainer')}</h2><p>${publicTraining.__profile?.ign?`IGN · ${esc(publicTraining.__profile.ign)} · `:''}Trainer since ${esc(String(p.created_at||'2026').slice(0,4))}</p></div><div class="public-player-head-stats"><span><b>${profileCaught}</b> caught</span><span><b>${Math.round((profileCaught/Math.max(1,publicStats.total||1))*100)}%</b> complete</span><span><b>🔥 ${Number(pd.streak||0)}</b> streak</span></div></div>${card}<section class="public-profile-section"><div class="section-heading"><div><span class="eyebrow">BADGES</span><h3>Earned Milestones</h3></div><span class="section-note">${earned.length} earned</span></div><div class="public-profile-badge-grid">${badgeHtml}</div></section>${teamHtml}</div>`,`online-modal-wrap player-profile-modal-wrap`);    }catch(err){openModal(`<button class="info-close" data-close>×</button><div class="online-error">Could not open this player profile: ${esc(err?.message||err||'Unknown error')}</div>`,'online-modal-wrap');}
  }

  async function leaderboardPage(){
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page leaderboard-page"><div class="page-title"><div><div class="eyebrow">COMMUNITY</div><h2>Leaderboard</h2><p>Collection, Daily Catch streaks and full Training runs.</p></div></div>${onlineNotice()}<div class="leaderboard-tabs"><button class="primary" data-lb="caught">Most Pokémon Caught</button><button class="secondary" data-lb="streak">Daily Catch Streak</button><button class="secondary" data-lb="best">Best Daily Catch Streak</button><button class="secondary" data-lb="training">Training Speed</button></div><div id="leaderboardList"><div class="empty-panel">Loading leaderboard…</div></div></div>`;
    if(!ONLINE)return;
    const [lbRes,profilesRes,statsRes]=await Promise.all([
      client.from('leaderboard').select('*').limit(100),
      client.from('profiles').select('id,display_name,dex_name,show_on_leaderboard').eq('show_profile',true).eq('show_on_leaderboard',true).limit(100),
      client.from('player_public_stats').select('user_id,training').limit(100)
    ]);
    if(lbRes.error){$('#leaderboardList').innerHTML=`<div class="online-error">${esc(lbRes.error.message)}</div>`;return;}
    let mode='caught';
    const trainingMap=new Map((statsRes.data||[]).map(x=>[x.user_id,x.training||{}]));
    const profileMap=new Map((profilesRes.data||[]).map(x=>[x.id,x]));
    const draw=()=>{
      if(mode==='training'){
        const rows=(profilesRes.data||[]).map(p=>{const t=trainingMap.get(p.id)||{};const best=Number(t.__bestSessionTimeMs||0);const sessions=Number(t.__trainingSessions||0);return {...p,best,sessions};}).filter(p=>p.best>0&&p.sessions>0).sort((a,b)=>a.best-b.best).slice(0,100);
        $('#leaderboardList').innerHTML=rows.map((p,i)=>`<div class="leader-row rank-${i+1} training-speed-row"><span class="leader-rank"><i>${i<3?['♛','◆','✦'][i]:'0'+String(i+1).padStart(2,'0')}</i><b>#${i+1}</b></span><span class="leader-name"><b>${esc(p.display_name||'Trainer')}</b><small>${esc((trainingMap.get(p.id)?.__profile?.ign)||'IGN not set')}</small></span><strong>${(p.best/1000).toFixed(2)}s</strong><span>best 10-question run</span></div>`).join('')||'<div class="empty-panel">No completed training runs yet.</div>';
        return;
      }
      const sorted=[...(lbRes.data||[])].sort((a,b)=>{
        const streakDiff=(Number(b.daily_streak)||0)-(Number(a.daily_streak)||0);
        const bestDiff=(Number(b.best_daily_streak)||0)-(Number(a.best_daily_streak)||0);
        const caughtDiff=(Number(b.caught_count)||0)-(Number(a.caught_count)||0);
        return mode==='best'?(bestDiff||streakDiff||caughtDiff):(mode==='streak'?(streakDiff||bestDiff||caughtDiff):(caughtDiff||streakDiff||bestDiff));
      });
      $('#leaderboardList').innerHTML=sorted.map((p,i)=>{const val=mode==='best'?Number(p.best_daily_streak||0):mode==='streak'?Number(p.daily_streak||0):Number(p.caught_count||0);return `<div class="leader-row rank-${i+1}"><span class="leader-rank"><i>${i<3?['♛','◆','✦'][i]:'0'+String(i+1).padStart(2,'0')}</i><b>#${i+1}</b></span><span class="leader-name"><b>${esc(p.display_name||'Trainer')}</b><small>${esc((trainingMap.get(p.id)?.__profile?.ign)||'IGN not set')}</small></span><strong>${val}</strong><span>${mode==='best'?'best daily catch streak':mode==='streak'?'daily catch streak':'caught'}</span></div>`;}).join('')||'<div class="empty-panel">No players have opted in yet.</div>';
    };
    $$('[data-lb]').forEach(b=>b.onclick=()=>{mode=b.dataset.lb;$$('[data-lb]').forEach(x=>x.className=x.dataset.lb===mode?'primary':'secondary');draw();});
    draw();
  }

  let globalActivityCache=null, globalActivityCacheAt=0;
  async function getGlobalActivity(){
    if(!ONLINE||!client)return [];
    const now=Date.now();
    if(globalActivityCache&&now-globalActivityCacheAt<30000)return globalActivityCache.slice();
    const [profilesRes,statsRes]=await Promise.all([
      client.from('profiles').select('id,display_name').eq('show_profile',true).limit(100),
      client.from('player_public_stats').select('user_id,training').limit(100)
    ]);
    if(profilesRes.error||statsRes.error) throw (profilesRes.error||statsRes.error);
    const names=new Map((profilesRes.data||[]).map(p=>[p.id,p.display_name||'Trainer']));
    const rows=[];
    for(const item of (statsRes.data||[])){
      const trainerName=names.get(item.user_id);
      if(!trainerName)continue;
      const activity=Array.isArray(item.training?.__activity)?item.training.__activity:[];
      for(const a of activity){if(a&&a.type)rows.push({...a,trainerName});}
    }
    rows.sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
    globalActivityCache=rows.slice(0,100); globalActivityCacheAt=now;
    return globalActivityCache.slice();
  }
  window.getGlobalActivityV17=getGlobalActivity;

  function installNav(){
    // V2 owns navigation when the Trainer OS layer is present. This file loads
    // after v11.js, so never let the legacy V1 router overwrite the V2 router.
    if(window.v2Navigate && window.renderV2Home){
      window.renderPlayers=playersPage;
      window.renderLeaderboard=leaderboardPage;
      window.LivingDexNavigate=(target)=>window.v2Navigate(target);
      window.__LIVINGDEX_DB_NAV_ACTIVE=true;
      // V2 is the owning router. The legacy app may have rendered the Dex first;
      // after the DB layer is ready, explicitly restore the intended V2 landing page.
      window.v2Navigate('home');
      return;
    }
    window.LivingDexNavigate=(target)=>{currentView=target;window.renderTopNav?.();window.renderView?.();window.scrollTo?.({top:0,behavior:'smooth'});};
    // app.js/v11.js keep `view` in a lexical variable, so window.view is not a
    // reliable source of truth. Keep the online navigation state here instead.
    // This also fixes the first-load bug where the page was blank until
    // LivingDex was clicked once. Use the shared navigation state declared
    // above so the profile button can switch the same state to `account`.
    window.renderTopNav=()=>{
      const items=[['dex','LivingDex'],['daily','Catch Calendar'],['team','Team Builder'],['types','Type Knowledge'],['training','Training'],['achievements','Progress'],['milestones','Milestones'],['players','Players'],['leaderboard','Leaderboard']];
      $('#topNav').innerHTML=items.map(([k,n])=>`<button class="top-nav-btn ${currentView===k?'active':''}" data-view="${k}">${n}</button>`).join('');
      $$('.top-nav-btn').forEach(b=>b.onclick=async()=>{
        window.closeInfo?.();
        currentView=b.dataset.view;
        window.renderTopNav();
        window.renderView();
      });
    };
    window.renderView=()=>{
      if(currentView==='dex'){window.renderDex();return;}
      $('#dexView').hidden=true;
      $('#view').hidden=false;
      if(currentView==='team')window.renderTeam();
      else if(currentView==='types')window.renderTypeKnowledge();
      else if(currentView==='training')window.renderTraining();
      else if(currentView==='daily')window.renderDailyDex?.();
      else if(currentView==='achievements')((window.renderProgressV13||window.renderProgressPlus)?.());
      else if(currentView==='milestones')window.renderMilestones?.();
      else if(currentView==='players')playersPage();
      else if(currentView==='leaderboard')leaderboardPage();
      else if(currentView==='account')profilePage();
    };
    window.renderTopNav();
    window.renderView();
  }

  async function boot(){
    document.title='Cobblemon LivingDex — V1.7.7';
    // Install the local UI before any network request so Progress and the rest
    // of the application are immediately available even if auth is slow.
    installNav();
    renderAccountState();
    // Final profile navigation guard: app.js has its own profile handler.
    // Capture this click first so the profile action always opens the account page.
    document.addEventListener('click',(e)=>{
      const b=e.target.closest?.('#profileBtn');
      if(b){
        e.preventDefault();
        e.stopImmediatePropagation();
        openProfileView();
        return;
      }
      const player=e.target.closest?.('.player-card-v17[data-player-id]');
      if(player){
        e.preventDefault();
        e.stopImmediatePropagation();
        playerDetail(player.dataset.playerId);
      }
    },true);
    document.addEventListener('keydown',(e)=>{
      if(e.key!=='Enter'&&e.key!==' ')return;
      const player=e.target.closest?.('.player-card-v17[data-player-id]');
      if(!player)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      playerDetail(player.dataset.playerId);
    },true);
    window.__LIVINGDEX_DB_NAV_ACTIVE=true;
    const localWatchTick=()=>{ if(document.visibilityState==='visible') watchLocalOnlineData(); };
    localWatchTick();
    setInterval(localWatchTick,5000);
    document.addEventListener('visibilitychange',localWatchTick,{passive:true});
    if(!ONLINE)return;
    await refreshSession();
    if(currentUser)await loadOnline();
    client.auth.onAuthStateChange((event,session)=>{
      const nextUser=session?.user||null,changed=nextUser?.id!==currentUser?.id;
      currentUser=nextUser;renderAccountState();
      if(document.querySelector('.profile-page-v13')) profilePage();
      if(currentUser&&(changed||event==='SIGNED_IN'))setTimeout(()=>loadOnline(),0);
      if(!currentUser)loadedUserId=null;
    });
  }
  window.LivingDexOnline={get client(){return client},get user(){return currentUser},isOnline:()=>ONLINE,sync:saveOnline,queueSave,login:()=>authModal('login'),signup:()=>authModal('signup'),logout};
  window.openProfileView=openProfileView; window.openPlayerProfile=(id)=>playerDetail(id);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();
