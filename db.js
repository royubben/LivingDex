/* Cobblemon LivingDex V1.2 — online accounts, profiles, saves and leaderboards. */
(() => {
  const CFG = window.LIVINGDEX_SUPABASE || {};
  const ONLINE = !!(CFG.url && CFG.key && window.supabase);
  let client = null;
  let currentUser = null;
  let syncTimer = null;

  if (ONLINE) client = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const profileLocal = () => { try { return JSON.parse(localStorage.getItem('cobblemon-livingdex-profile') || 'null'); } catch { return null; } };
  const localPayload = () => ({
    state: window.state || {},
    favorites: window.favorites || {},
    notes: window.notes || {},
    team: window.team || [],
    training: (() => { try { return JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}'); } catch { return {}; } })(),
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
    if(!ONLINE||!currentUser) return;
    const {data: p, error: pe}=await client.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
    const {data: s, error: se}=await client.from('player_saves').select('*').eq('user_id',currentUser.id).maybeSingle();
    if(pe||se){console.warn('LivingDex online load failed',pe||se);return;}
    if(p){ const lp=profileLocal()||{}; localStorage.setItem('cobblemon-livingdex-profile',JSON.stringify({...lp,...p,trainerName:p.display_name,assistantName:p.dex_name})); }
    if(s){
      const local=localPayload();
      const remoteEmpty=!Object.keys(s.state||{}).length && !Object.keys(s.favorites||{}).length && !(s.team||[]).length;
      if(remoteEmpty && (Object.keys(local.state).length || Object.keys(local.favorites).length || local.team.length)){ await saveOnline(); return; }
      ['state','favorites','notes'].forEach(k=>{ if(window[k] && s[k]){Object.keys(window[k]).forEach(x=>delete window[k][x]);Object.assign(window[k],s[k]);} });
      if(Array.isArray(s.team)&&Array.isArray(window.team)){window.team.splice(0,window.team.length,...s.team);}
      try { localStorage.setItem('cobblemon-livingdex-training',JSON.stringify(s.training||{})); } catch {}
      window.saveAll?.();
    }
    window.render?.(); window.renderProgressPlus?.();
  }

  async function saveOnline(){
    if(!ONLINE||!currentUser) return;
    const payload=localPayload();
    const profile=profileLocal()||{};
    const {error: pe}=await client.from('profiles').upsert({
      id:currentUser.id, display_name:profile.trainerName||profile.display_name||'Trainer', dex_name:profile.assistantName||profile.dex_name||'Dex',
      favorite_pokemon:profile.favoritePokemon||null, favorite_type:profile.favoriteType||null, favorite_region:profile.favoriteRegion||null,
      favorite_generation:profile.favoriteGeneration?Number(profile.favoriteGeneration):null, bio:profile.bio||null,
      show_profile:profile.showProfile!==false, show_in_players:profile.showInPlayers!==false,
      show_on_leaderboard:profile.showOnLeaderboard!==false, show_team:profile.showTeam!==false, updated_at:new Date().toISOString()
    });
    const {error: se}=await client.from('player_saves').upsert({user_id:currentUser.id,...payload,updated_at:new Date().toISOString()});
    if(pe||se) console.warn('LivingDex online save failed',pe||se);
  }

  function queueSave(){ if(!currentUser)return; clearTimeout(syncTimer); syncTimer=setTimeout(saveOnline,700); }

  async function logout(){ if(ONLINE) await client.auth.signOut(); currentUser=null; renderAccountState(); }

  function renderAccountState(){
    const b=$('#profileBtn'); if(!b)return;
    b.innerHTML=currentUser ? `☁ <span>${esc(profileLocal()?.trainerName||currentUser.email?.split('@')[0]||'Account')}</span>` : '👤 <span>Profile</span>';
  }

  function profilePage(){
    const p=profileLocal()||{};
    $('#dexView').hidden=true; $('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page"><div class="page-title"><div><div class="eyebrow">ONLINE TRAINER</div><h2>${esc(p.trainerName||'Trainer')}</h2><p>${currentUser?esc(currentUser.email||''):'Local profile — sign in to sync online.'}</p></div><div class="online-status ${currentUser?'connected':''}">${currentUser?'● Online':'○ Offline account'}</div></div>${onlineNotice()}<div class="online-grid"><section class="team-panel"><span class="eyebrow">ACCOUNT</span><h3>${currentUser?'Connected':'Not connected'}</h3><p>${currentUser?'Your LivingDex can sync between devices.':'Your current collection remains local until you connect an account.'}</p><div class="online-actions">${currentUser?'<button id="syncNow" class="primary">Sync now</button><button id="logoutOnline" class="secondary">Sign out</button>':'<button id="loginOnline" class="primary">Sign in</button><button id="signupOnline" class="secondary">Create account</button>'}</div></section><section class="team-panel"><span class="eyebrow">PRIVACY</span><h3>Profile visibility</h3><label class="switch-row"><span>Show me in Players</span><input type="checkbox" id="showPlayers" ${p.showInPlayers!==false?'checked':''}></label><label class="switch-row"><span>Show on Leaderboard</span><input type="checkbox" id="showLeaderboard" ${p.showOnLeaderboard!==false?'checked':''}></label><label class="switch-row"><span>Show my team publicly</span><input type="checkbox" id="showTeam" ${p.showTeam!==false?'checked':''}></label></section></div></div>`;
    $('#loginOnline')?.addEventListener('click',()=>authModal('login')); $('#signupOnline')?.addEventListener('click',()=>authModal('signup')); $('#logoutOnline')?.addEventListener('click',logout); $('#syncNow')?.addEventListener('click',async()=>{await saveOnline();alert('Synced.');});
    ['showPlayers','showLeaderboard','showTeam'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{const key={showPlayers:'showInPlayers',showLeaderboard:'showOnLeaderboard',showTeam:'showTeam'}[id];const q=profileLocal()||{};q[key]=$('#'+id).checked;localStorage.setItem('cobblemon-livingdex-profile',JSON.stringify(q));saveOnline();}));
  }

  async function playersPage(){
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page"><div class="page-title"><div><div class="eyebrow">COMMUNITY</div><h2>Players</h2><p>Find trainers who chose to make their profile discoverable.</p></div></div>${onlineNotice()}<div class="search player-search"><span>⌕</span><input id="playerSearch" placeholder="Search players..."></div><div id="playersList" class="players-list"><div class="empty-panel">Loading players…</div></div></div>`;
    if(!ONLINE){return;}
    const draw=async()=>{const q=($('#playerSearch')?.value||'').trim().toLowerCase();const {data,error}=await client.from('profiles').select('id,display_name,dex_name,favorite_pokemon,favorite_type,favorite_region,favorite_generation,show_team').eq('show_profile',true).eq('show_in_players',true).limit(100);const list=(data||[]).filter(p=>!q||p.display_name.toLowerCase().includes(q)||p.dex_name.toLowerCase().includes(q));$('#playersList').innerHTML=error?`<div class="online-error">${esc(error.message)}</div>`:list.map(p=>`<button class="player-card" data-player="${p.id}"><div class="player-avatar">${esc((p.display_name||'T').slice(0,1).toUpperCase())}</div><div><b>${esc(p.display_name)}</b><span>${esc(p.dex_name||'Dex')}</span><small>${esc([p.favorite_pokemon,p.favorite_type,p.favorite_region].filter(Boolean).join(' · ')||'Trainer')}</small></div></button>`).join('')||'<div class="empty-panel">No players found.</div>'; $$('#playersList .player-card').forEach(b=>b.onclick=()=>playerDetail(b.dataset.player));};
    $('#playerSearch').oninput=draw; await draw();
  }

  async function playerDetail(id){
    if(!ONLINE)return;
    const {data:p}=await client.from('profiles').select('id,display_name,dex_name,favorite_pokemon,favorite_type,favorite_region,favorite_generation,show_team').eq('id',id).maybeSingle();
    const {data:s}=await client.from('player_public_stats').select('state,favorites,team,training').eq('user_id',id).maybeSingle();
    if(!p)return;
    const caught=Object.values(s?.state||{}).filter(Boolean).length, fav=Object.values(s?.favorites||{}).filter(Boolean).length;
    const teamArr=Array.isArray(s?.team)?s.team:[];
    openModal(`<button class="info-close" data-close>×</button><div class="eyebrow">PLAYER PROFILE</div><h2>${esc(p.display_name)}</h2><p>${esc(p.dex_name||'Dex')}</p><div class="online-stats"><div><b>${caught}</b><span>Caught</span></div><div><b>${fav}</b><span>Favorites</span></div><div><b>${esc(String(s?.training?.bestScore||0))}</b><span>Best training</span></div></div><div class="info-grid"><div class="info-item"><b>Favorite Pokémon</b><span>${esc(p.favorite_pokemon||'—')}</span></div><div class="info-item"><b>Favorite type</b><span>${esc(p.favorite_type||'—')}</span></div><div class="info-item"><b>Favorite region</b><span>${esc(p.favorite_region||'—')}</span></div><div class="info-item"><b>Favorite generation</b><span>${p.favorite_generation?`Generation ${p.favorite_generation}`:'—'}</span></div></div>${p.show_team?`<div class="info-section"><h3>Team</h3><div class="public-team">${teamArr.map(id=>{const e=window.entryById?.(id);return e?`<div><img src="${window.spritePath(e)}"><span>${esc(e.name)}</span></div>`:`<div><span>${esc(id)}</span></div>`}).join('')||'<div class="empty-panel">No public team.</div>'}</div></div>`:''}`);
  }

  async function leaderboardPage(){
    $('#dexView').hidden=true;$('#view').hidden=false;
    $('#view').innerHTML=`<div class="page-card online-page"><div class="page-title"><div><div class="eyebrow">COMMUNITY</div><h2>Leaderboard</h2><p>Objective collection and training statistics from players who opted in.</p></div></div>${onlineNotice()}<div class="leaderboard-tabs"><button class="primary" data-lb="caught">LivingDex</button><button class="secondary" data-lb="training">Training</button><button class="secondary" data-lb="favorites">Favorites</button></div><div id="leaderboardList"><div class="empty-panel">Loading leaderboard…</div></div></div>`;
    if(!ONLINE)return;
    const {data,error}=await client.from('leaderboard').select('*').limit(100); if(error){$('#leaderboardList').innerHTML=`<div class="online-error">${esc(error.message)}</div>`;return;}
    const draw=(mode)=>{const sorted=[...(data||[])].sort((a,b)=>mode==='training'?(b.best_training_score-a.best_training_score||b.best_training_accuracy-a.best_training_accuracy):mode==='favorites'?(b.favorite_count-a.favorite_count||b.caught_count-a.caught_count):(b.caught_count-a.caught_count||b.best_training_score-a.best_training_score));$('#leaderboardList').innerHTML=sorted.map((p,i)=>`<button class="leader-row"><span class="leader-rank">#${i+1}</span><span class="leader-name"><b>${esc(p.display_name)}</b><small>${esc(p.dex_name||'Dex')}</small></span><strong>${mode==='training'?esc(String(p.best_training_score)):mode==='favorites'?esc(String(p.favorite_count)):esc(String(p.caught_count))}</strong><span>${mode==='training'?'best score':mode==='favorites'?'favorites':'caught'}</span></button>`).join('')||'<div class="empty-panel">No players have opted in yet.</div>';};
    draw('caught'); $$('#view [data-lb]').forEach(b=>b.onclick=()=>{ $$('#view [data-lb]').forEach(x=>x.className='secondary');b.className='primary';draw(b.dataset.lb); });
  }

  function installNav(){
    // app.js/v11.js keep `view` in a lexical variable, so window.view is not a
    // reliable source of truth. Keep the online navigation state here instead.
    // This also fixes the first-load bug where the page was blank until
    // LivingDex was clicked once.
    let currentView='dex';
    window.renderTopNav=()=>{
      const items=[['dex','LivingDex'],['team','Team Builder'],['types','Type Information'],['training','Training'],['achievements','Progress'],['players','Players'],['leaderboard','Leaderboard']];
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
      else if(currentView==='achievements')window.renderProgressPlus();
      else if(currentView==='players')playersPage();
      else if(currentView==='leaderboard')leaderboardPage();
      else if(currentView==='account')profilePage();
    };
    window.renderTopNav();
    window.renderView();
  }

  async function boot(){
    document.title='Cobblemon LivingDex — V1.2 BETA 2';
    await refreshSession();
    if(ONLINE){ client.auth.onAuthStateChange(async(_event,session)=>{ currentUser=session?.user||null; renderAccountState(); if(currentUser) await loadOnline(); }); }
    const oldSaveAll=window.saveAll;
    if(oldSaveAll){window.saveAll=()=>{oldSaveAll();queueSave();};}
    installNav(); renderAccountState();
    $('#profileBtn')?.addEventListener('click',(e)=>{e.stopPropagation();profilePage();window.view='account';});
    // Rebind after v11's profile button handler by replacing the node once.
    const pb=$('#profileBtn'); if(pb){const clone=pb.cloneNode(true);pb.replaceWith(clone);clone.onclick=(e)=>{e.stopPropagation();profilePage();};}
  }
  window.LivingDexOnline={get client(){return client},get user(){return currentUser},isOnline:()=>ONLINE,sync:saveOnline,login:()=>authModal('login'),signup:()=>authModal('signup'),logout};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();
