/* Cobblemon LivingDex V1.3 — online accounts, profiles, saves and leaderboards. */
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
  const generationName = n => ['','I','II','III','IV','V','VI','VII','VIII','IX'][Number(n)] || String(n);
  const localTrainingStats = () => { try { return JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}'); } catch { return {}; } };
  const dailyInfo = () => { const t=localTrainingStats(), d=t.__daily||{}; return {streak:Number(d.streak||0), bestStreak:Number(d.bestStreak||0), lastCompleted:d.lastCompleted||'', totalCompleted:Number(d.totalCompleted||0)}; };
  const dailyDateKeyForDb = () => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; };
  const localBadges = () => { try { const s=window.getCollectionStatsV14?.(); const ms=window.getMilestoneDefinitions?.(s||{}); return Array.isArray(ms)?ms.filter(x=>x.unlocked):[]; } catch { return []; } };
  const profileLocal = () => { try { return JSON.parse(localStorage.getItem('cobblemon-livingdex-profile') || 'null'); } catch { return null; } };
  const localPayload = () => ({
    state: window.state || {},
    favorites: window.favorites || {},
    notes: window.notes || {},
    team: window.team || [],
    training: (() => { try { return JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}'); } catch { return {}; } })(),
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
        try{const rt={...(s.training||{})},rs=rt.__settings||{};delete rt.__settings;localStorage.setItem('cobblemon-livingdex-training',JSON.stringify(rt));if(rs.theme)localStorage.setItem('livingdex-theme',rs.theme);}catch{}
      }
    }else{const ok=await saveOnline();if(!ok)return false;}
    loadedUserId=currentUser.id;
    window.render?.();window.renderProgressPlus?.();
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
    currentView='account';
    window.renderTopNav?.();
    profilePage();
  }

  function renderAccountState(){
    const current=$('#profileBtn'); if(!current)return;
    const b=current.cloneNode(true);
    current.replaceWith(b);
    b.type='button';
    b.removeAttribute('data-view');
    b.setAttribute('aria-label','Open profile');
    b.innerHTML=currentUser ? `☁ <span>${esc(profileLocal()?.trainerName||currentUser.email?.split('@')[0]||'Account')}</span>` : '👤 <span>Profile</span>';
    b.onclick=(e)=>{
      e.preventDefault();
      e.stopPropagation();
      openProfileView();
    };
  }

  function profilePage(){
    const p=profileLocal()||{};
    const all=typeof window.__getLivingDexEntries==='function'?window.__getLivingDexEntries().filter(e=>e.id):[];
    const main=all.filter(e=>e.box);
    const caught=all.filter(e=>window.state?.[e.id]).length;
    const favorites=Object.values(window.favorites||{}).filter(Boolean).length;
    const missing=Math.max(0,all.length-caught);
    const pct=all.length?Math.round(caught/all.length*100):0;
    const teamCount=Array.isArray(window.team)?window.team.length:0;
    const byBox={};main.forEach(e=>{if(!byBox[e.box])byBox[e.box]={total:0,caught:0};byBox[e.box].total++;if(window.state?.[e.id])byBox[e.box].caught++;});
    const boxesComplete=Object.values(byBox).filter(x=>x.total===x.caught&&x.total>0).length;
    const generations=Array.from({length:9},(_,i)=>i+1).map(g=>{const l=main.filter(e=>Number(e.generation)===g),c=l.filter(e=>window.state?.[e.id]).length;return {g,total:l.length,caught:c,p:l.length?Math.round(c/l.length*100):0};}).filter(x=>x.total);
    const daily=typeof window.__dailyDexEntry==='function'?window.__dailyDexEntry():null;
    try{window.touchDailyCompletion?.();}catch{}
    const ds=dailyInfo(), badges=localBadges(), ts=window.getTrainingSummaryV14?.()||{};
    const mainCaught=main.filter(e=>window.state?.[e.id]).length;
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page profile-page-v13"><div class="page-title"><div><div class="eyebrow">TRAINER PROFILE</div><h2>${esc(p.trainerName||'Trainer')}</h2><p>${currentUser?esc(currentUser.email||''):'Local profile — sign in to sync online.'}</p></div><div class="online-status ${currentUser?'connected':''}">${currentUser?'● Online':'○ Offline account'}</div></div><section class="profile-account-bar"><div><span class="eyebrow">ACCOUNT</span><h3>${currentUser?'Online account connected':'Local account'}</h3><p>${currentUser?esc(currentUser.email||''): 'Your collection is saved locally. Sign in to sync it across devices.'}</p></div><div class="online-actions profile-account-actions">${currentUser?'<button id="profileSignOutTop" class="secondary">Sign out</button>':'<button id="profileSignInTop" class="primary">Sign in</button><button id="profileSignUpTop" class="secondary">Create account</button>'}</div></section><section class="profile-stat-grid profile-stat-grid-eight"><div><b>${caught}</b><span>Total caught</span></div><div><b>${missing}</b><span>Missing</span></div><div><b>${pct}%</b><span>Complete</span></div><div><b>${favorites}</b><span>Favorites</span></div><div><b>${teamCount}/6</b><span>Team</span></div><div><b>${boxesComplete}</b><span>Full boxes</span></div><div class="stat-accent"><b>${ds.streak}</b><span>Daily streak</span></div><div><b>${badges.length}</b><span>Badges earned</span></div></section><section class="profile-progress-panel"><div class="section-heading"><div><span class="eyebrow">COLLECTION</span><h3>LivingDex progress</h3></div><strong>${caught} / ${all.length}</strong></div><div class="progress-track"><i style="width:${pct}%"></i></div>${daily?`<div class="profile-daily"><img src="${window.spritePath(daily)}" alt="${esc(daily.name)}"><div><span class="eyebrow">DAILY DEX</span><b>${esc(daily.name)}</b><small>${ds.lastCompleted===dailyDateKeyForDb()?'Completed today':'Current daily'}</small><small>🔥 ${ds.streak} day streak · Best ${ds.bestStreak}</small></div></div>`:''}</section><section class="profile-section"><div class="section-heading"><div><span class="eyebrow">BADGES</span><h3>Milestones earned</h3></div><span class="section-note">${badges.length} unlocked</span></div><div class="profile-badges">${badges.slice(0,8).map(m=>`<div class="mini-badge"><span>${esc(m.icon)}</span><b>${esc(m.name)}</b></div>`).join('')||'<div class="empty-panel">No badges earned yet.</div>'}</div></section><section class="profile-section"><div class="section-heading"><div><span class="eyebrow">TRAINING</span><h3>${esc(ts.rank||'Rookie')} Rank</h3></div><span class="section-note">${ts.accuracy||0}% accuracy</span></div><div class="training-profile-stats"><span>${ts.totalQuestions||0} questions</span><span>${ts.totalCorrect||0} correct</span><span>Best ${ts.bestScore||0}/10</span></div></section><section class="profile-section"><div class="section-heading"><div><span class="eyebrow">GENERATIONS</span><h3>Completion</h3></div></div><div class="profile-generation-list">${generations.map(g=>`<div class="profile-generation-row"><span>Generation ${generationName(g.g)}</span><div class="progress-track"><i style="width:${g.p}%"></i></div><strong>${g.p}%</strong></div>`).join('')}</div></section><div class="online-grid"><section class="team-panel"><span class="eyebrow">ACCOUNT</span><h3>${currentUser?'Connected':'Not connected'}</h3><p>${currentUser?'Your LivingDex can sync between devices.':'Your current collection remains local until you connect an account.'}</p><div class="online-actions">${currentUser?'<button id="editProfileOnline" class="primary">Edit Profile</button><button id="syncNow" class="secondary">Sync now</button><button id="logoutOnline" class="secondary">Sign out</button>':'<button id="loginOnline" class="primary">Sign in</button><button id="signupOnline" class="secondary">Create account</button>'}</div></section><section class="team-panel"><span class="eyebrow">PRIVACY</span><h3>Profile visibility</h3><label class="switch-row"><span>Show me in Players</span><input type="checkbox" id="showPlayers" ${p.showInPlayers!==false?'checked':''}></label><label class="switch-row"><span>Show on Leaderboard</span><input type="checkbox" id="showLeaderboard" ${p.showOnLeaderboard!==false?'checked':''}></label><label class="switch-row"><span>Show my team publicly</span><input type="checkbox" id="showTeam" ${p.showTeam!==false?'checked':''}></label></section></div></div>`;
    $('#profileSignInTop')?.addEventListener('click',()=>authModal('login'));$('#profileSignUpTop')?.addEventListener('click',()=>authModal('signup'));$('#profileSignOutTop')?.addEventListener('click',logout);$('#loginOnline')?.addEventListener('click',()=>authModal('login'));$('#signupOnline')?.addEventListener('click',()=>authModal('signup'));$('#editProfileOnline')?.addEventListener('click',()=>window.openProfileOptions?.());$('#logoutOnline')?.addEventListener('click',logout);$('#syncNow')?.addEventListener('click',async()=>{const ok=await saveOnline();alert(ok?'Synced.':'Sync failed — your local save was kept.');});
    ['showPlayers','showLeaderboard','showTeam'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{const key={showPlayers:'showInPlayers',showLeaderboard:'showOnLeaderboard',showTeam:'showTeam'}[id];const q=profileLocal()||{};q[key]=$('#'+id).checked;localStorage.setItem('cobblemon-livingdex-profile',JSON.stringify(q));localStorage.setItem('cobblemon-livingdex-local-dirty',String(Date.now()));queueSave();}));
  }

  async function playersPage(){
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page"><div class="page-title"><div><div class="eyebrow">COMMUNITY</div><h2>Players</h2><p>Find trainers who chose to make their profile discoverable.</p></div></div>${onlineNotice()}<div class="search player-search"><span>⌕</span><input id="playerSearch" placeholder="Search players..."></div><div id="playersList" class="players-list"><div class="empty-panel">Loading players…</div></div></div>`;
    if(!ONLINE){return;}
    const draw=async()=>{const q=($('#playerSearch')?.value||'').trim().toLowerCase();const [{data,error},{data:pubStats}]=await Promise.all([client.from('profiles').select('id,display_name,dex_name,favorite_pokemon,favorite_type,favorite_region,favorite_generation,show_team').eq('show_profile',true).eq('show_in_players',true).limit(100),client.from('player_public_stats').select('user_id,training').limit(100)]);const statsMap=new Map((pubStats||[]).map(x=>[x.user_id,x]));const list=(data||[]).filter(p=>!q||p.display_name.toLowerCase().includes(q)||p.dex_name.toLowerCase().includes(q));$('#playersList').innerHTML=error?`<div class="online-error">${esc(error.message)}</div>`:list.map(p=>{const st=statsMap.get(p.id)?.training||{},ds=st.__daily||{},keys=['who','type','evolution','pokedex','generation'];const badgeBase={caught:Object.values(statsMap.get(p.id)?.state||{}).filter(Boolean).length,total:0,mainCaught:0,mainTotal:0,favoriteCount:Object.values(statsMap.get(p.id)?.favorites||{}).filter(Boolean).length,fullBoxes:0,daily:{streak:Number(ds.streak||0),bestStreak:Number(ds.bestStreak||0)},training:{totalQuestions:keys.reduce((n,k)=>n+Number(st[k]?.questions||0),0),totalCorrect:keys.reduce((n,k)=>n+Number(st[k]?.correct||0),0),bestScore:keys.reduce((m,k)=>Math.max(m,Number(st[k]?.best||0)),0),perfectModes:keys.filter(k=>Number(st[k]?.best||0)>=10).length}};const badges=window.getMilestoneDefinitions?.(badgeBase)||[];return `<button class="player-card" data-player="${p.id}"><div class="player-avatar">${esc((p.display_name||'T').slice(0,1).toUpperCase())}</div><div><b>${esc(p.display_name)}</b><span>${esc(p.dex_name||'Dex')}</span><small>${esc([p.favorite_pokemon,p.favorite_type,p.favorite_region].filter(Boolean).join(' · ')||'Trainer')}</small><small>🔥 ${Number(ds.streak||0)} day streak · 🏅 ${badges.filter(x=>x.unlocked).length} badges</small></div></button>`;}).join('')||'<div class="empty-panel">No players found.</div>'; $$('#playersList .player-card').forEach(b=>b.onclick=()=>playerDetail(b.dataset.player));};
    $('#playerSearch').oninput=draw; await draw();
  }

  async function playerDetail(id){
    if(!ONLINE)return;
    const {data:p}=await client.from('profiles').select('id,display_name,dex_name,favorite_pokemon,favorite_type,favorite_region,favorite_generation,show_team').eq('id',id).maybeSingle();
    const {data:s}=await client.from('player_public_stats').select('state,favorites,team,training').eq('user_id',id).maybeSingle();
    if(!p)return;
    const caught=Object.values(s?.state||{}).filter(Boolean).length, fav=Object.values(s?.favorites||{}).filter(Boolean).length;
    const teamArr=Array.isArray(s?.team)?s.team:[];
    const publicTraining=s?.training||{}, pd=publicTraining.__daily||{}, modeKeys=['who','type','evolution','pokedex','generation'];
    const pq=modeKeys.reduce((n,k)=>n+Number(publicTraining[k]?.questions||0),0), pc=modeKeys.reduce((n,k)=>n+Number(publicTraining[k]?.correct||0),0), pb=modeKeys.reduce((m,k)=>Math.max(m,Number(publicTraining[k]?.best||0)),0);
    const publicStats=window.getCollectionStatsFromV14?.(s?.state||{},s?.favorites||{},publicTraining)||{caught,total:window.__getLivingDexEntries?.().length||0,mainCaught:caught,mainTotal:caught,favoriteCount:fav,fullBoxes:0,daily:{streak:Number(pd.streak||0),bestStreak:Number(pd.bestStreak||0)},training:{totalQuestions:pq,totalCorrect:pc,bestScore:pb,perfectModes:modeKeys.filter(k=>Number(publicTraining[k]?.best||0)>=10).length}};
    const publicBadges=window.getMilestoneDefinitions?.(publicStats)||[];
    openModal(`<button class="info-close" data-close>×</button><div class="eyebrow">PLAYER PROFILE</div><h2>${esc(p.display_name)}</h2><p>${esc(p.dex_name||'Dex')}</p><div class="online-stats online-stats-five"><div><b>${caught}</b><span>Caught</span></div><div><b>${fav}</b><span>Favorites</span></div><div><b>${pd.streak||0}</b><span>Daily streak</span></div><div><b>${pd.bestStreak||0}</b><span>Best streak</span></div><div><b>${publicBadges.filter(x=>x.unlocked).length}</b><span>Badges</span></div></div><div class="info-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">MILESTONES</span><h3>Badges</h3></div></div><div class="profile-badges public-profile-badges">${publicBadges.filter(x=>x.unlocked).map(m=>`<div class="mini-badge"><span>${esc(m.icon)}</span><b>${esc(m.name)}</b></div>`).join('')||'<div class="empty-panel">No badges earned yet.</div>'}</div></div><div class="info-grid"><div class="info-item"><b>Favorite Pokémon</b><span>${esc(p.favorite_pokemon||'—')}</span></div><div class="info-item"><b>Favorite type</b><span>${esc(p.favorite_type||'—')}</span></div><div class="info-item"><b>Favorite region</b><span>${esc(p.favorite_region||'—')}</span></div><div class="info-item"><b>Favorite generation</b><span>${p.favorite_generation?`Generation ${p.favorite_generation}`:'—'}</span></div></div>${p.show_team?`<div class="info-section"><h3>Team</h3><div class="public-team">${teamArr.map(id=>{const e=window.entryById?.(id);return e?`<div><img src="${window.spritePath(e)}"><span>${esc(e.name)}</span></div>`:`<div><span>${esc(id)}</span></div>`}).join('')||'<div class="empty-panel">No public team.</div>'}</div></div>`:''}`);
  }

  async function leaderboardPage(){
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page leaderboard-page"><div class="page-title"><div><div class="eyebrow">COMMUNITY</div><h2>Leaderboard</h2><p>Compete through collection and Daily Dex streaks.</p></div></div>${onlineNotice()}<div class="leaderboard-tabs"><button class="primary" data-lb="caught">Most Pokémon Caught</button><button class="secondary" data-lb="streak">Daily Streak</button></div><div id="leaderboardList"><div class="empty-panel">Loading leaderboard…</div></div></div>`;
    if(!ONLINE)return;
    const {data,error}=await client.from('leaderboard').select('*').limit(100);
    if(error){$('#leaderboardList').innerHTML=`<div class="online-error">${esc(error.message)}<br><small>The Daily Streak leaderboard needs the included V1.4 Supabase migration.</small></div>`;return;}
    let mode='caught';
    const draw=()=>{
      const sorted=[...(data||[])].sort((a,b)=>{
        const streakDiff=((Number(b.daily_streak)||0)-(Number(a.daily_streak)||0));
        const bestStreakDiff=((Number(b.best_daily_streak)||0)-(Number(a.best_daily_streak)||0));
        const caughtDiff=((Number(b.caught_count)||0)-(Number(a.caught_count)||0));
        return mode==='streak' ? (streakDiff || bestStreakDiff || caughtDiff) : (caughtDiff || streakDiff);
      });
      $('#leaderboardList').innerHTML=sorted.map((p,i)=>{const val=mode==='streak'?Number(p.daily_streak||0):Number(p.caught_count||0);return `<button class="leader-row"><span class="leader-rank">#${i+1}</span><span class="leader-name"><b>${esc(p.display_name)}</b><small>${esc(p.dex_name||'Dex')}</small></span><strong>${val}</strong><span>${mode==='streak'?'day streak':'caught'}</span></button>`;}).join('')||'<div class="empty-panel">No players have opted in yet.</div>';
    };
    $$('[data-lb]').forEach(b=>b.onclick=()=>{mode=b.dataset.lb;$$('[data-lb]').forEach(x=>x.className=x.dataset.lb===mode?'primary':'secondary');draw();});
    draw();
  }

  function installNav(){
    window.LivingDexNavigate=(target)=>{currentView=target;window.renderTopNav?.();window.renderView?.();window.scrollTo?.({top:0,behavior:'smooth'});};
    // app.js/v11.js keep `view` in a lexical variable, so window.view is not a
    // reliable source of truth. Keep the online navigation state here instead.
    // This also fixes the first-load bug where the page was blank until
    // LivingDex was clicked once. Use the shared navigation state declared
    // above so the profile button can switch the same state to `account`.
    window.renderTopNav=()=>{
      const items=[['dex','LivingDex'],['team','Team Builder'],['types','Type Information'],['training','Training'],['achievements','Progress'],['milestones','Milestones'],['players','Players'],['leaderboard','Leaderboard']];
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
    document.title='Cobblemon LivingDex — V1.4';
    // Install the local UI before any network request so Progress and the rest
    // of the application are immediately available even if auth is slow.
    installNav();
    renderAccountState();
    setInterval(watchLocalOnlineData,800);
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
  window.openProfileView=openProfileView;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();
