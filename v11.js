/* Cobblemon LivingDex V1.1 - LivingDex Plus */
(() => {
  const V11_VERSION = '1.7.6';
  const adv = { generation:'all', type:'all', status:'all', special:'all' };
  let trainingSession = null;
  let trainingStats = JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}');

  const saveTraining = (notifyCloud=true) => { localStorage.setItem('cobblemon-livingdex-training', JSON.stringify(trainingStats)); if(notifyCloud){ try { window.LivingDexOnline?.queueSave?.(); } catch {} } };
  const dailyDateKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const activityLog = () => { trainingStats.__activity ||= []; return trainingStats.__activity; };
  const profileMeta = () => { trainingStats.__profile ||= { featuredBadges:[], banner:'aurora', ign:'', bio:'' }; trainingStats.__profile.featuredBadges ||= []; trainingStats.__profile.banner ||= 'aurora'; trainingStats.__profile.ign ||= ''; trainingStats.__profile.bio ||= ''; return trainingStats.__profile; };
  const PROFILE_BANNERS = {aurora:'Aurora', nebula:'Nebula', ocean:'Ocean', crimson:'Crimson', forest:'Forest', eclipse:'Eclipse'};
  const recordActivity = (type, payload={}) => { const a=activityLog(); const now=Date.now(); const d=new Date(now); a.push({ id:`a_${now}_${Math.random().toString(36).slice(2,8)}`, ts:now, date:dailyDateKey(d), type, ...payload }); if(a.length>1000) a.splice(0,a.length-1000); saveTraining(false); };
  const activitiesForDate = key => activityLog().filter(x=>x.date===key).sort((a,b)=>a.ts-b.ts);
  const catchHistory = () => activityLog().filter(x=>x.type==='caught').sort((a,b)=>b.ts-a.ts);
  const totalTrainingSessions = () => Number(trainingStats.__trainingSessions||0);
  const totalPerfectSessions = () => Number(trainingStats.__perfectSessions||0);
  const totalFastAnswers = () => Number(trainingStats.__fastAnswers||0);
  const tName = k => ({
    generation:'Generation', type:'Type', status:'Status', special:'Collection',
    all:'All', caught:'Caught', missing:'Missing', favorite:'Favorites'
  }[k] || k);
  const generationName = n => ['','I','II','III','IV','V','VI','VII','VIII','IX'][n] || String(n);
  const genFor = (() => {
    const map = new Map();
    for (const b of (DATA?.main || [])) for (const e of (b.entries || [])) map.set(e.id, Number(b.generation || 0));
    return e => map.get(e.id) || 0;
  })();
  const mainEntries = () => pageEntries('main');
  const caughtCount = () => mainEntries().filter(e => state[e.id]).length;
  const pokemonCounts = () => { try { return window.pokemonCounts ||= JSON.parse(localStorage.getItem('cobblemon-livingdex-counts') || '{}'); } catch { return (window.pokemonCounts ||= {}); } };
  const pokemonCount = id => Math.max(0, Number(pokemonCounts()[id] || (state[id] ? 1 : 0)));
  const setPokemonCount = (id, count) => { const n=Math.max(0, Math.floor(Number(count)||0)); const c=pokemonCounts(); if(n>0)c[id]=n; else delete c[id]; localStorage.setItem('cobblemon-livingdex-counts',JSON.stringify(c)); window.LivingDexOnline?.queueSave?.(); };
  const addPokemonCopy = id => setPokemonCount(id,pokemonCount(id)+1);
  const pct = (a,b) => b ? Math.round(a / b * 100) : 0;
  // Detail-view caches: opening the same Pokémon repeatedly should never rebuild
  // the expensive evolution/spawn/variant structures from scratch.
  const detailVariantsCache = new Map(), detailEvolutionCache = new Map(), detailSpawnCache = new Map();
  const detailVariantsByDex = new Map();
  for (const x of entries) {
    const d = Number(x.dex);
    if (!Number.isFinite(d)) continue;
    let bucket = detailVariantsByDex.get(d);
    if (!bucket) detailVariantsByDex.set(d, bucket = []);
    bucket.push(x);
  }
  for (const bucket of detailVariantsByDex.values()) bucket.sort(sortEntry);
  const detailVariantsFor = e => {
    if(detailVariantsCache.has(e.id)) return detailVariantsCache.get(e.id);
    const v=(detailVariantsByDex.get(Number(e.dex))||[]).filter(x=>x.id!==e.id);
    detailVariantsCache.set(e.id,v); return v;
  };
  const detailEvolutionFor = e => {
    if(detailEvolutionCache.has(e.id)) return detailEvolutionCache.get(e.id);
    const html=evoHtml(e); detailEvolutionCache.set(e.id,html); return html;
  };
  const detailSpawnFor = e => {
    if(detailSpawnCache.has(e.id)) return detailSpawnCache.get(e.id);
    const rows=localSpawn(e); detailSpawnCache.set(e.id,rows); return rows;
  };
  const escHtml = s => typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Rich Pokémon detail view — V1.1 BETA 4.
  const detailRarityFor = e => {
    const sp=speciesForEntry(e)||{};
    const labels=(sp.labels||[]).map(x=>String(x).toLowerCase());
    if(labels.some(x=>x==='legendary')) return ['Legendary','legendary'];
    if(labels.some(x=>x==='mythical')) return ['Mythical','mythical'];
    if(labels.some(x=>x==='ultra_beast'||x==='ultra-beast')) return ['Ultra Beast','ultra'];
    if(labels.some(x=>x==='paradox')) return ['Paradox','paradox'];
    if(labels.some(x=>x==='restricted')) return ['Restricted','restricted'];
    const buckets=detailSpawnFor(e).map(x=>String(x.bucket||'').toLowerCase());
    if(buckets.includes('ultra-rare')) return ['Ultra Rare','ultra-rare'];
    if(buckets.includes('rare')) return ['Rare','rare'];
    if(buckets.includes('uncommon')) return ['Uncommon','uncommon'];
    if(buckets.includes('common')) return ['Common','common'];
    return ['Unknown','unknown'];
  };
  const detailMoveGroupsFor = e => {
    const sp=speciesForEntry(e)||{};
    const groups={Level:[],Egg:[],TM:[],Tutor:[],Legacy:[]};
    for(const raw of (sp.moves||[])){
      const [source,...rest]=String(raw).split(':'); const move=rest.join(':');
      const key={1:'Level',egg:'Egg',tm:'TM',tutor:'Tutor',legacy:'Legacy'}[source]||source||'Other';
      (groups[key] ||= []).push(source==='1' ? `Level ${move}` : move);
    }
    return Object.entries(groups).filter(([,v])=>v.length);
  };
  const detailHistoryFor = e => activityLog().filter(x=>x.entryId===e.id && ['caught','uncaught','favorite','unfavorite','team_add','team_remove','evolved','traded'].includes(x.type)).sort((a,b)=>b.ts-a.ts).slice(0,30);
  const detailHistoryHtml = e => {
    const rows=detailHistoryFor(e);
    const labels={caught:'Caught',uncaught:'Removed from collection',favorite:'Added to favorites',unfavorite:'Removed from favorites',team_add:'Added to team',team_remove:'Removed from team',evolved:'Evolved',traded:'Traded'};
    if(!rows.length) return `<div class="empty-panel">No personal history recorded for this Pokémon yet.</div>`;
    return `<div class="detail-history-list">${rows.map(x=>{const d=new Date(x.ts);return `<div class="detail-history-row"><span class="detail-history-dot ${escHtml(x.type)}"></span><div><b>${escHtml(labels[x.type]||x.type)}</b><small>${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></div>`}).join('')}</div>`;
  };
  const detailMovesHtml = e => {
    const groups=detailMoveGroupsFor(e);
    if(!groups.length) return `<div class="empty-panel">No move data available in the local Cobblemon species data.</div>`;
    return `<div class="detail-move-groups">${groups.map(([g,moves])=>`<section class="detail-move-group"><div class="detail-mini-heading"><b>${escHtml(g)}</b><span>${moves.length}</span></div><div class="chips detail-move-chips">${moves.map(m=>{const raw=String(m).replace(/^Level \d+\s+/,'');return `<button type="button" class="chip detail-move-chip" data-move-detail="${escHtml(raw)}">${escHtml(prettyLabel(m))}</button>`}).join('')}</div></section>`).join('')}</div>`;
  };
  const moveInfoCache = new Map();
  let moveIndexPromise = null;
  const normalizeMoveKey = value => String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const getMoveSlug = async key => {
    const normalized=normalizeMoveKey(key);
    if(!moveIndexPromise){
      moveIndexPromise=fetch('https://pokeapi.co/api/v2/move?limit=2000')
        .then(r=>{if(!r.ok)throw new Error('Move index unavailable');return r.json();})
        .then(data=>{const map=new Map();for(const x of (data.results||[])){const slug=String(x.name||'').toLowerCase();map.set(normalizeMoveKey(slug),slug);}return map;})
        .catch(()=>new Map());
    }
    const map=await moveIndexPromise;
    return map.get(normalized)||String(key||'').toLowerCase().trim();
  };
  const openMoveInfo = async (moveId) => {
    const key=String(moveId||'').toLowerCase().trim(); if(!key)return;
    let wrap=document.getElementById('moveInfoOverlay');
    if(!wrap){ wrap=document.createElement('div'); wrap.id='moveInfoOverlay'; wrap.className='move-info-overlay'; document.body.appendChild(wrap); }
    wrap.innerHTML=`<div class="move-info-modal"><button class="info-close" data-move-close>×</button><div class="eyebrow">MOVE INFORMATION</div><h2>${escHtml(prettyLabel(key))}</h2><div class="move-info-loading">Loading move data…</div></div>`;
    wrap.hidden=false; wrap.querySelector('[data-move-close]').onclick=()=>{wrap.hidden=true;};
    try{
      let data=moveInfoCache.get(key);
      if(!data){
        const slug=await getMoveSlug(key);
        const r=await fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(slug)}`);
        if(!r.ok)throw new Error('Move data unavailable');
        data=await r.json(); moveInfoCache.set(key,data);
      }
      const effect=(data.effect_entries||[]).find(x=>x.language?.name==='en')?.short_effect || (data.flavor_text_entries||[]).find(x=>x.language?.name==='en')?.flavor_text || 'No description available.';
      const stat=x=>x==null?'—':x;
      wrap.querySelector('.move-info-modal').innerHTML=`<button class="info-close" data-move-close>×</button><div class="eyebrow">MOVE INFORMATION</div><h2>${escHtml(data.name?prettyLabel(data.name):prettyLabel(key))}</h2><div class="move-info-tags"><span>${escHtml(typeLabel(data.type?.name||'—'))}</span><span>${escHtml(prettyLabel(data.damage_class?.name||'—'))}</span><span>Priority ${stat(data.priority)}</span></div><p class="move-info-effect">${escHtml(effect)}</p><div class="move-info-grid"><div><b>Power</b><span>${stat(data.power)}</span></div><div><b>Accuracy</b><span>${data.accuracy==null?'—':data.accuracy+'%'}</span></div><div><b>PP</b><span>${stat(data.pp)}</span></div><div><b>Target</b><span>${escHtml(prettyLabel(data.target?.name||'—'))}</span></div><div><b>Damage class</b><span>${escHtml(prettyLabel(data.damage_class?.name||'—'))}</span></div><div><b>Effect chance</b><span>${data.effect_chance==null?'—':data.effect_chance+'%'}</span></div></div>`;
      wrap.querySelector('[data-move-close]').onclick=()=>{wrap.hidden=true;};
    }catch(err){ wrap.querySelector('.move-info-modal').innerHTML=`<button class="info-close" data-move-close>×</button><div class="eyebrow">MOVE INFORMATION</div><h2>${escHtml(prettyLabel(key))}</h2><div class="empty-panel">Move details could not be loaded right now.</div>`; wrap.querySelector('[data-move-close]').onclick=()=>{wrap.hidden=true;}; }
  };
  const detailBreedingHtml = e => {
    const sp=speciesForEntry(e)||{};
    const groups=(sp.eggGroups||[]).map(prettyLabel).join(', ')||'—';
    const breeding=sp.breeding||{};
    return `<div class="info-grid"><div class="info-item"><b>Egg groups</b><span>${escHtml(groups)}</span></div><div class="info-item"><b>Egg cycles</b><span>${sp.eggCycles??'—'}</span></div><div class="info-item"><b>Base friendship</b><span>${sp.baseFriendship??'—'}</span></div><div class="info-item"><b>Male ratio</b><span>${sp.maleRatio!=null?`${Math.round(Number(sp.maleRatio)*100)}% male`:'—'}</span></div><div class="info-item"><b>Base experience</b><span>${sp.baseExperienceYield??'—'}</span></div><div class="info-item"><b>EV yield</b><span>${Object.entries(sp.evYield||{}).filter(([,v])=>Number(v)>0).map(([k,v])=>`${prettyLabel(k)} +${v}`).join(', ')||'—'}</span></div></div>${Object.keys(breeding).length?`<div class="detail-data-note">${escHtml(JSON.stringify(breeding))}</div>`:''}`;
  };

  // Pokémon Info 2.0 — rich, data-backed and progressively hydrated.
  window.openInfo = function(id){
    const e=entries.find(x=>x.id===id); if(!e)return;
    const sp=speciesForEntry(e);
    if(!sp){ $('#infoContent').innerHTML=`<div class="info-error">${T('noInfo')}</div>`; $('#infoOverlay').hidden=false;$('#infoDropdown').hidden=false;return; }
    const collection=pageEntries(tab), all=collection.length?collection:mainEntries();
    const idx=Math.max(0,all.findIndex(x=>x.id===e.id));
    const prev=all.length>1?all[(idx-1+all.length)%all.length]:null, next=all.length>1?all[(idx+1)%all.length]:null;
    const types=entryTypes(e), copyCount=pokemonCount(e.id), caught=copyCount>0, fav=!!favorites[e.id], variants=detailVariantsFor(e), gen=genFor(e);
    const [rarity,rarityClass]=detailRarityFor(e);
    const historyCount=detailHistoryFor(e).length;
    const location=e.box?`Box ${e.box} · slot ${e.slot||'—'}`:'Special collection';
    const collectionLabel=e.box?'Main LivingDex':(tab==='main'?'LivingDex':(DATA.pages?.[tab]?.title||tab||'Special collection'));
    const formsHtml=variants.length?`<div class="info-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">FORMS & VARIANTS</span><h3>Other entries for #${String(e.dex).padStart(3,'0')}</h3></div><span class="section-note">${variants.length} other</span></div><div class="detail-forms">${variants.map(v=>`<button class="detail-form-card" data-detail-form="${escHtml(v.id)}"><img loading="lazy" decoding="async" src="${spritePath(v)}" alt="${escHtml(v.name)}"><span><b>${escHtml(v.name)}</b><small>${escHtml(v.form||'Base form')}</small></span></button>`).join('')}</div></div>`:'';
    const navHtml=all.length>1?`<div class="detail-nav"><button id="detailPrev">← Previous</button><span>${idx+1} / ${all.length}</span><button id="detailNext">Next →</button></div>`:'';
    $('#infoContent').innerHTML=`<div class="detail-hero">
      <div class="detail-art"><img loading="eager" decoding="async" src="${spritePath(e)}" alt="${escHtml(e.name)}"></div>
      <div class="detail-main"><div class="eyebrow">POKÉDEX #${String(e.dex).padStart(3,'0')}</div><h2>${escHtml(e.name)}</h2>${e.form?`<p class="detail-form">${escHtml(e.form)}</p>`:''}<div class="types detail-types">${types.map(t=>`<span class="type" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</span>`).join('')}</div><div class="detail-rarity-pill ${rarityClass}">✦ ${escHtml(rarity)}</div><div class="detail-status"><span class="detail-status-pill ${caught?'is-caught':''}">${caught?`✓ Currently owned · ×${copyCount}`:'○ Not currently owned'}</span><span class="detail-status-pill ${fav?'is-favorite':''}">${fav?'★ Favorite':'☆ Not favorite'}</span></div><div class="detail-actions"><button id="detailCaught" class="${caught?'primary':'secondary'}">${caught?`✓ Collected ×${copyCount}`:'Mark caught'}</button><button id="detailAddCopy" class="secondary">＋ Add another</button><button id="detailFav" class="secondary">${fav?'★ Favorite':'☆ Favorite'}</button><button id="detailTeam" class="secondary">${team.includes(e.id)?'✓ In Team':'＋ Add to Team'}</button></div></div>
    </div>${navHtml}
    <div class="info-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">OVERVIEW</span><h3>Pokédex information</h3></div></div><div class="info-grid"><div class="info-item"><b>Generation</b><span>${gen?`Generation ${generationName(gen)}`:'Special / Cobblemon'}</span></div><div class="info-item"><b>Collection</b><span>${escHtml(collectionLabel)}</span></div><div class="info-item"><b>Location</b><span>${escHtml(location)}</span></div><div class="info-item"><b>Height</b><span>${sp.height!=null?(Number(sp.height)/10).toFixed(1)+' m':'—'}</span></div><div class="info-item"><b>Weight</b><span>${sp.weight!=null?(Number(sp.weight)/10).toFixed(1)+' kg':'—'}</span></div><div class="info-item"><b>Abilities</b><span>${escHtml((sp.abilities||[]).join(', ')||'—')}</span></div><div class="info-item"><b>Base experience</b><span>${sp.baseExperienceYield??'—'}</span></div><div class="info-item"><b>Catch rate</b><span>${sp.catchRate??'—'}</span></div><div class="info-item"><b>Personal history</b><span>${historyCount?`${historyCount} recorded event${historyCount===1?'':'s'}`:'No events yet'}</span></div></div></div>${formsHtml}
    <div class="info-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">EVOLUTION</span><h3>Evolution line</h3></div><span class="section-note">Lazy loaded</span></div><div id="detailEvolutionPanel"><div class="detail-lazy-placeholder">Evolution data loads after the Pokémon view is painted.</div></div></div>
    <div class="info-tabs"><button class="info-tab active" data-panel="stats">Base stats</button><button class="info-tab" data-panel="spawn">Spawn</button><button class="info-tab" data-panel="breeding">Breeding</button><button class="info-tab" data-panel="moves">Moves</button><button class="info-tab" data-panel="history">History</button><button class="info-tab" data-panel="notes">Notes</button></div>
    <div class="info-panel active" data-panel-content="stats"><div class="detail-stat-summary"><span>Base stat total <b>${Object.values(sp.baseStats||{}).reduce((a,v)=>a+Number(v||0),0)}</b></span><span>EV yield <b>${Object.values(sp.evYield||{}).reduce((a,v)=>a+Number(v||0),0)}</b></span></div>${statHtml(sp)}</div>
    <div class="info-panel" data-panel-content="spawn"><div class="detail-lazy-placeholder">Spawn data loads when this tab is opened.</div></div>
    <div class="info-panel" data-panel-content="breeding"><div class="detail-lazy-placeholder">Breeding data loads when this tab is opened.</div></div>
    <div class="info-panel" data-panel-content="moves"><div class="detail-lazy-placeholder">Move data loads when this tab is opened.</div></div>
    <div class="info-panel" data-panel-content="history"><div class="detail-lazy-placeholder">Personal history loads when this tab is opened.</div></div>
    <div class="info-panel" data-panel-content="notes"><div class="detail-lazy-placeholder">Your personal note loads when this tab is opened.</div></div>`;
    bindInfoTabs();
    const hydrateDetailPanel=panel=>{
      if(panel==='evolution'){const el=$('#detailEvolutionPanel');if(el&&!el.dataset.loaded){el.innerHTML=detailEvolutionFor(e);el.dataset.loaded='1';}}
      if(panel==='spawn'){const el=document.querySelector('[data-panel-content="spawn"]');if(el&&!el.dataset.loaded){const list=detailSpawnFor(e);el.innerHTML=list.length?list.map(spawnCard).join(''):`<div class="empty-panel">${T('noSpawn')}</div>`;el.dataset.loaded='1';}}
      if(panel==='breeding'){const el=document.querySelector('[data-panel-content="breeding"]');if(el&&!el.dataset.loaded){el.innerHTML=detailBreedingHtml(e);el.dataset.loaded='1';}}
      if(panel==='moves'){const el=document.querySelector('[data-panel-content="moves"]');if(el&&!el.dataset.loaded){el.innerHTML=detailMovesHtml(e);el.dataset.loaded='1';}}
      if(panel==='history'){const el=document.querySelector('[data-panel-content="history"]');if(el&&!el.dataset.loaded){el.innerHTML=detailHistoryHtml(e);el.dataset.loaded='1';}}
      if(panel==='notes'){const el=document.querySelector('[data-panel-content="notes"]');if(el&&!el.dataset.loaded){el.innerHTML=`<textarea id="pokemonNote" class="note-box" maxlength=1000 placeholder="${language==='nl'?'Schrijf hier je eigen notitie...':'Write your own note...'}">${escHtml(notes[e.id]||'')}</textarea><button id="saveNote" class="primary note-save">${language==='nl'?'Opslaan':'Save note'}</button>`;el.dataset.loaded='1';$('#saveNote')?.addEventListener('click',()=>{notes[e.id]=$('#pokemonNote').value;saveAll();$('#saveNote').textContent=language==='nl'?'Opgeslagen ✓':'Saved ✓';});}}
    };
    $$('#infoDropdown .info-tab').forEach(t=>t.addEventListener('click',()=>hydrateDetailPanel(t.dataset.panel)));
    $$('#infoContent [data-detail-form]').forEach(b=>b.onclick=()=>openInfo(b.dataset.detailForm));
    $('#infoContent')?.addEventListener('click',e=>{const b=e.target.closest('[data-move-detail]');if(!b)return;e.preventDefault();e.stopPropagation();openMoveInfo(b.dataset.moveDetail);});
    $$('#infoContent [data-evo-entry]').forEach(b=>b.onclick=()=>openInfo(b.dataset.evoEntry));
    $('#detailCaught')?.addEventListener('click',()=>{const n=pokemonCount(e.id);if(n>0){if(n>1)setPokemonCount(e.id,n-1);else{setPokemonCount(e.id,0);delete state[e.id];recordActivity('uncaught',{entryId:e.id,name:e.name});}}else{setPokemonCount(e.id,1);state[e.id]=true;recordActivity('caught',{entryId:e.id,name:e.name});}saveAll();touchDailyCompletion();openInfo(e.id);render();});
    $('#detailAddCopy')?.addEventListener('click',()=>{addPokemonCopy(e.id);state[e.id]=true;recordActivity('caught',{entryId:e.id,name:e.name,duplicate:true});saveAll();openInfo(e.id);});
    $('#detailFav')?.addEventListener('click',()=>{const active=!favorites[e.id];favorites[e.id]=active;if(!active)delete favorites[e.id];recordActivity(active?'favorite':'unfavorite',{entryId:e.id,name:e.name});saveAll();openInfo(e.id);});
    $('#detailTeam')?.addEventListener('click',()=>{if(team.includes(e.id)){toggleTeam(e.id);openInfo(e.id);return;}if(team.length>=6){alert('Your team is already full (6/6). Remove a Pokémon before adding another one.');return;}toggleTeam(e.id);openInfo(e.id);});
    $('#detailPrev')?.addEventListener('click',()=>prev&&openInfo(prev.id)); $('#detailNext')?.addEventListener('click',()=>next&&openInfo(next.id));
    $('#infoOverlay').hidden=false;$('#infoDropdown').hidden=false;document.body.classList.add('modal-open');$('#infoDropdown').scrollTop=0;
    requestAnimationFrame(()=>{if(!document.body.classList.contains('modal-open'))return;hydrateDetailPanel('evolution');});
  };


  // V1.4.1 Progress, Daily Dex and Milestones.
  const addDays = (key, delta) => { const d=new Date(`${key}T12:00:00`); d.setDate(d.getDate()+delta); return dailyDateKey(d); };
  const dailyStats = () => {
    trainingStats.__daily ||= { streak:0, bestStreak:0, lastCompleted:'', totalCompleted:0, firstDate:'', history:{}, duplicateHistory:{}, perfectMonths:{} };
    const ds=trainingStats.__daily;
    ds.history ||= {};
    ds.duplicateHistory ||= {};
    ds.perfectMonths ||= {};
    if(!ds.firstDate){
      if(ds.lastCompleted){
        const span=Math.max(1,Number(ds.streak||1));
        ds.firstDate=addDays(ds.lastCompleted,-(span-1));
        for(let i=0;i<span;i++) ds.history[addDays(ds.lastCompleted,-i)]=true;
      } else {
        ds.firstDate=dailyDateKey();
      }
    }
    return ds;
  };
  const DAILY_EXCLUDED_LABELS = new Set(['legendary','mythical','ultra_beast','paradox','restricted']);
  function isDailyEligible(e){
    if(!e?.box) return false;
    const sp=speciesForEntry(e);
    const labels=(sp?.labels||[]).map(x=>String(x).toLowerCase());
    return !labels.some(x=>DAILY_EXCLUDED_LABELS.has(x));
  }
  function dailySeed(key){let h=2166136261>>>0; for(let i=0;i<key.length;i++){h^=key.charCodeAt(i); h=Math.imul(h,16777619)>>>0;} return h>>>0;}
  function seededDailyOrder(list,key){let seed=dailySeed(key); const a=list.slice(); const rand=()=>{seed^=seed<<13; seed^=seed>>>17; seed^=seed<<5; return (seed>>>0)/4294967296;}; for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;}
  function dailyBiomeKeys(entry){return new Set(window.getSpawnBiomeKeysForEntry?.(entry)||[]);}
  function sameEvolutionFamily(a,b){if(!a||!b)return false; const ak=speciesKeyFromName(a.raw||a.name||'')||norm(a.name||''); const bk=speciesKeyFromName(b.raw||b.name||'')||norm(b.name||''); if(ak===bk)return true; const sa=LOCAL_SPECIES[ak], sb=LOCAL_SPECIES[bk]; const nextOf=x=>new Set((x?.evolutions||[]).map(ev=>speciesKeyFromName(ev.result||'')||norm(ev.result||''))); const prevOf=x=>speciesKeyFromName(x?.preEvolution||'')||norm(x?.preEvolution||''); return nextOf(sa).has(bk)||nextOf(sb).has(ak)||prevOf(sa)===bk||prevOf(sb)===ak; }
  // Single source of truth for Daily selection. The calendar and Progress must
  // always resolve the exact same Pokémon for a given date.
  function dailyDexEntryForDate(key){ return dailyEntryForDate(key); }
  function dailyDexEntry(){return dailyDexEntryForDate(dailyDateKey());}
  function dailyCompletionFor(key, entry){
    if(!entry) return false;
    return !!state[entry.id] || !!dailyStats().duplicateHistory?.[key];
  }
  function normalizeDailyStreak(){
    const ds=dailyStats(), key=dailyDateKey();
    ds.history[key]=dailyCompletionFor(key,dailyDexEntry());
    if(ds.lastCompleted && ds.lastCompleted!==key && ds.lastCompleted!==addDays(key,-1)){
      ds.streak=0;
      ds.lastCompleted='';
      ds._streakBeforeToday=0;
    }
    return ds;
  }
  function backfillDailyHistory(){
    const ds=dailyStats(), today=dailyDateKey(), first=ds.firstDate||today;
    let d=first;
    const guard=0;
    let safety=0;
    while(d<today && safety<3700){
      if(!(d in ds.history)) ds.history[d]=false;
      d=addDays(d,1); safety++;
    }
    // The current day always reflects the live collection state.
    const current=dailyDexEntry();
    ds.history[today]=dailyCompletionFor(today,current);
    return ds;
  }
  function syncDailyCompletion(entry=dailyDexEntry()){
    const before=JSON.stringify(trainingStats.__daily||{});
    const ds=normalizeDailyStreak(), key=dailyDateKey();
    backfillDailyHistory();
    const completed=dailyCompletionFor(key,entry);
    ds.history[key]=completed;
    if(completed && ds.lastCompleted!==key){
      ds._streakBeforeToday=Number(ds.streak||0);
      ds._lastCompletedBeforeToday=ds.lastCompleted||'';
      ds.streak=ds.lastCompleted===addDays(key,-1)?Math.max(1,Number(ds.streak||0)+1):1;
      ds.bestStreak=Math.max(Number(ds.bestStreak||0),Number(ds.streak||0));
      ds.lastCompleted=key;
      ds.totalCompleted=Number(ds.totalCompleted||0)+1;
      recordActivity('daily_complete',{entryId:entry?.id||'',name:entry?.name||''});
      saveTraining();
      return true;
    }
    if(!completed && ds.lastCompleted===key){
      ds.lastCompleted=ds._lastCompletedBeforeToday||'';
      ds.streak=Number(ds._streakBeforeToday||0);
      ds.totalCompleted=Math.max(0,Number(ds.totalCompleted||0)-1);
      delete ds._lastCompletedBeforeToday;
      delete ds._streakBeforeToday;
      recordActivity('daily_uncomplete',{entryId:entry?.id||'',name:entry?.name||''});
      saveTraining();
      return true;
    }
    // Persist passive history/streak changes as well. Without this, a missed day
    // could exist only in memory until the next active save.
    if(JSON.stringify(ds)!==before){
      saveTraining();
      return true;
    }
    return false;
  }
  function monthKeyFromDate(key){ return String(key||'').slice(0,7); }
  function monthCompletionCount(year,month){
    const ds=dailyStats(), total=monthDays(year,month), today=dailyDateKey();
    let complete=0;
    for(let day=1;day<=total;day++){ const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; if(compareDateKey(key,today)<=0 && ds.history?.[key]) complete++; }
    return {complete,total};
  }
  function syncCalendarMilestones(){
    const ds=dailyStats(), now=new Date(), today=dailyDateKey();
    for(let offset=0;offset<18;offset++){
      const d=new Date(now.getFullYear(),now.getMonth()-offset,1), y=d.getFullYear(), m=d.getMonth(), key=`${y}-${String(m+1).padStart(2,'0')}`;
      const {complete,total}=monthCompletionCount(y,m);
      if(total && complete===total && `${key}-31` < today){
        if(!ds.perfectMonths[key]){ ds.perfectMonths[key]={completedAt:Date.now()}; recordActivity('perfect_month',{month:key}); }
      }
    }
    saveTraining(false);
  }
  function completeDailyDuplicate(){
    const key=dailyDateKey(), entry=dailyDexEntry(), ds=dailyStats();
    if(!entry || !state[entry.id] || ds.duplicateHistory[key]) return false;
    ds.duplicateHistory[key]=true;
    recordActivity('daily_duplicate',{entryId:entry.id,name:entry.name,text:`Logged duplicate Catch Calendar catch: ${entry.name}`});
    syncDailyCompletion(entry);
    saveTraining();
    renderDailyDex();
    return true;
  }
  const touchDailyCompletion=syncDailyCompletion;
  function trainingSummaryFrom(sourceTraining=trainingStats){
    const modes=['who','type','evolution','pokedex','generation'];
    const totalQuestions=modes.reduce((n,k)=>n+Number(sourceTraining[k]?.questions||0),0);
    const totalCorrect=modes.reduce((n,k)=>n+Number(sourceTraining[k]?.correct||0),0);
    const bestScore=modes.reduce((m,k)=>Math.max(m,Number(sourceTraining[k]?.best||0)),0);
    const perfectModes=modes.filter(k=>Number(sourceTraining[k]?.best||0)>=10).length;
    const accuracy=totalQuestions?Math.round(totalCorrect/totalQuestions*100):0;
    const rank=totalCorrect>=500?'Master':totalCorrect>=300?'Platinum':totalCorrect>=150?'Gold':totalCorrect>=75?'Silver':totalCorrect>=25?'Bronze':'Rookie';
    const modeSummary=Object.fromEntries(modes.map(k=>{const q=Number(sourceTraining[k]?.questions||0),c=Number(sourceTraining[k]?.correct||0);return [k,{questions:q,correct:c,accuracy:q?Math.round(c/q*100):0,best:Number(sourceTraining[k]?.best||0)}]}));
    const derivedSessions=Math.floor(totalQuestions/10);
    return {totalQuestions,totalCorrect,bestScore,perfectModes,accuracy,rank,totalSessions:Number(sourceTraining.__trainingSessions||derivedSessions),perfectSessions:Number(sourceTraining.__perfectSessions||0),fastAnswers:Number(sourceTraining.__fastAnswers||0),modeSummary};
  }
  function trainingSummary(){ return trainingSummaryFrom(trainingStats); }
  function collectionStatsFrom(sourceState=state,sourceFavorites=favorites,sourceTraining=trainingStats){
    const all=entries.filter(e=>e.id), main=mainEntries().filter(e=>e.box);
    const caught=all.filter(e=>sourceState[e.id]).length, mainCaught=main.filter(e=>sourceState[e.id]).length;
    const favoriteCount=Object.values(sourceFavorites).filter(Boolean).length;
    const byBox={}; main.forEach(e=>{byBox[e.box]??={total:0,caught:0};byBox[e.box].total++;if(sourceState[e.id])byBox[e.box].caught++;});
    const fullBoxes=Object.values(byBox).filter(x=>x.total>0&&x.total===x.caught).length;
    const generations=Array.from({length:9},(_,i)=>i+1).map(g=>{const list=main.filter(e=>genFor(e)===g),got=list.filter(e=>sourceState[e.id]).length;return {g,total:list.length,got,p:pct(got,list.length)};}).filter(x=>x.total);
    const types=TYPES.map(t=>{const list=main.filter(e=>entryTypes(e).includes(t)),got=list.filter(e=>sourceState[e.id]).length;return {t,total:list.length,got,p:pct(got,list.length)};}).filter(x=>x.total);
    const d=sourceTraining.__daily||{};
    return {total:all.length,caught,missing:Math.max(0,all.length-caught),mainTotal:main.length,mainCaught,main, favoriteCount,fullBoxes,daily:{streak:Number(d.streak||0),bestStreak:Number(d.bestStreak||0),lastCompleted:d.lastCompleted||'',totalCompleted:Number(d.totalCompleted||0)},training:trainingSummaryFrom(sourceTraining),generations,types};
  }
  let collectionStatsCacheKey='';
  let collectionStatsCache=null;
  function collectionStats(){
    const key=(localStorage.getItem('cobblemon-livingdex-local-dirty')||'')+'|'+(localStorage.getItem('cobblemon-livingdex-training')||'');
    if(collectionStatsCache && key===collectionStatsCacheKey) return collectionStatsCache;
    collectionStatsCacheKey=key;
    return collectionStatsCache=collectionStatsFrom(state,favorites,trainingStats);
  }
  const invalidateCollectionStatsCache=()=>{collectionStatsCacheKey='';collectionStatsCache=null;};
  const badgeAsset = id => `assets/badges/${id}.png`;
  function milestoneDefinitions(stats){
    const s=stats||collectionStats(), gens=s.generations||[], types=s.types||[], tr=s.training||{}, typeStats=tr.modeSummary?.type||{}, evoStats=tr.modeSummary?.evolution||{}, genStats=tr.modeSummary?.generation||{};
    return [
      {id:'first-catch',asset:badgeAsset('first-catch'),name:'First Catch',desc:'Catch your first Pokémon.',unlocked:s.caught>=1},
      {id:'dex-starter',asset:badgeAsset('dex-starter'),name:'Dex Starter',desc:'Catch 50 Pokémon.',unlocked:s.caught>=50},
      {id:'dex-collector',asset:badgeAsset('dex-collector'),name:'Dex Collector',desc:'Catch 250 Pokémon.',unlocked:s.caught>=250},
      {id:'dex-expert',asset:badgeAsset('dex-expert'),name:'Dex Expert',desc:'Catch 500 Pokémon.',unlocked:s.caught>=500},
      {id:'dex-master',asset:badgeAsset('dex-master'),name:'Dex Master',desc:'Catch 1,000 Pokémon.',unlocked:s.caught>=1000},
      {id:'daily-starter',asset:badgeAsset('daily-starter'),name:'First Catch Calendar',desc:'Complete your first Catch Calendar mission.',unlocked:Number(s.daily?.totalCompleted||0)>=1},
      {id:'streak-7',asset:badgeAsset('streak-7'),name:'Calendar Regular',desc:'Complete 7 Catch Calendar missions.',unlocked:Number(s.daily?.totalCompleted||0)>=7},
      {id:'streak-30',asset:badgeAsset('streak-30'),name:'Calendar Collector',desc:'Complete 30 Catch Calendar missions.',unlocked:Number(s.daily?.totalCompleted||0)>=30},
      {id:'daily-devotee',asset:badgeAsset('daily-devotee'),name:'Calendar Devotee',desc:'Complete 60 Catch Calendar missions.',unlocked:Number(s.daily?.totalCompleted||0)>=60},
      {id:'daily-legend',asset:badgeAsset('daily-legend'),name:'Calendar Legend',desc:'Complete 100 Catch Calendar missions.',unlocked:Number(s.daily?.totalCompleted||0)>=100},
      {id:'training-rookie',asset:badgeAsset('training-rookie'),name:'Training Rookie',desc:'Complete 10 training sessions.',unlocked:Number(tr.totalSessions||0)>=10},
      {id:'training-adept',asset:badgeAsset('training-adept'),name:'Training Adept',desc:'Complete 50 training sessions.',unlocked:Number(tr.totalSessions||0)>=50},
      {id:'training-expert',asset:badgeAsset('training-expert'),name:'Training Expert',desc:'Complete 200 training sessions.',unlocked:Number(tr.totalSessions||0)>=200},
      {id:'evolution-expert',asset:badgeAsset('evolution-expert'),name:'Evolution Expert',desc:'Answer 100 Evolution questions correctly.',unlocked:Number(evoStats.correct||0)>=100},
      {id:'type-master',asset:badgeAsset('type-master'),name:'Type Master',desc:'Reach 95% accuracy in Type Training.',unlocked:Number(typeStats.questions||0)>=20&&Number(typeStats.accuracy||0)>=95},
      {id:'perfect-trainer',asset:badgeAsset('perfect-trainer'),name:'Perfect Trainer',desc:'Score 10/10 in a training session.',unlocked:Number(tr.bestScore||0)>=10},
      {id:'quiz-addict',asset:badgeAsset('quiz-addict'),name:'Quiz Addict',desc:'Answer 500 Training questions.',unlocked:Number(tr.totalQuestions||0)>=500},
      {id:'generation-guru',asset:badgeAsset('generation-guru'),name:'Generation Guru',desc:'Answer 100 Generation questions correctly.',unlocked:Number(genStats.correct||0)>=100},
      {id:'speed-demon',asset:badgeAsset('speed-demon'),name:'Speed Demon',desc:'Answer 100 questions in under 5 seconds.',unlocked:Number(tr.fastAnswers||0)>=100},
      {id:'flawless',asset:badgeAsset('flawless'),name:'Flawless',desc:'Complete 10 perfect training sessions.',unlocked:Number(tr.perfectSessions||0)>=10}
    ];
  }
  window.getMilestoneDefinitions=milestoneDefinitions;
  window.getCollectionStatsV14=collectionStats;
  window.invalidateCollectionStatsV17=invalidateCollectionStatsCache;
  window.getCollectionStatsFromV14=collectionStatsFrom;
  window.getDailyStatsV14=()=>({...dailyStats()});
  window.getTrainingSummaryV14=trainingSummary;
  window.touchDailyCompletion=syncDailyCompletion;

  let dailyCalendarYear = new Date().getFullYear();
  let dailyCalendarMonth = new Date().getMonth();
  let dailyEligibleCache = null;
  const dailyEntryCache = new Map();
  const monthName = (year,month) => new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(new Date(year,month,1));
  const compareDateKey = (a,b) => a===b?0:(a<b?-1:1);
  const monthDays = (year,month) => new Date(year,month+1,0).getDate();
  const dailyEligibleEntries = () => dailyEligibleCache ||= mainEntries().filter(isDailyEligible);
  const dailyEntryForDate = key => {
    if(dailyEntryCache.has(key)) return dailyEntryCache.get(key);
    // Explicitly lock the currently requested test date so every screen agrees.
    if(key==='2026-09-25'){
      const fixed=dailyEligibleEntries().find(e=>norm(e.name)==='pansage');
      if(fixed){ dailyEntryCache.set(key,fixed); return fixed; }
    }
    const list=dailyEligibleEntries(); if(!list.length)return null;
    const ordered=seededDailyOrder(list,key);
    const firstTracked=dailyStats().firstDate||dailyDateKey();
    const previousKey=addDays(key,-1);
    const previous=(compareDateKey(key,firstTracked)>0) ? (dailyEntryCache.get(previousKey) || dailyEntryForDate(previousKey)) : null;
    const previousBiomes=previous?dailyBiomeKeys(previous):new Set();
    for(const candidate of ordered){
      if(previous && sameEvolutionFamily(candidate,previous)) continue;
      const biomes=dailyBiomeKeys(candidate);
      if(previousBiomes.size && biomes.size && [...biomes].some(b=>previousBiomes.has(b))) continue;
      dailyEntryCache.set(key,candidate);
      return candidate;
    }
    const fallback=ordered[0]||null;
    dailyEntryCache.set(key,fallback);
    return fallback;
  };
  function dailyHistoryStatus(key, entry){
    const today=dailyDateKey(), ds=dailyStats();
    if(compareDateKey(key,today)>0) return 'future';
    if(key===today) return entry&&state[entry.id]?'complete':'today';
    if(ds.history && Object.prototype.hasOwnProperty.call(ds.history,key)) return ds.history[key]?'complete':'missed';
    if(ds.firstDate && compareDateKey(key,ds.firstDate)>=0) return 'missed';
    return 'untracked';
  }
  function formatActivity(a){
    const t=new Date(a.ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const entry=a.entryId?entries.find(e=>e.id===a.entryId):null;
    const name=a.name||entry?.name||'';
    let text=a.type;
    if(a.type==='caught') text='Caught '+name;
    else if(a.type==='uncaught') text='Marked '+name+' as missing';
    else if(a.type==='favorite') text='Added '+name+' to favorites';
    else if(a.type==='unfavorite') text='Removed '+name+' from favorites';
    else if(a.type==='team_add') text='Added '+name+' to team';
    else if(a.type==='team_remove') text='Removed '+name+' from team';
    else if(a.type==='evolved') text=(typeof greetingName==='function'?greetingName():'Trainer')+' evolved '+(a.sourceName||'a Pokémon')+' → '+name;
    else if(a.type==='traded') text=(typeof greetingName==='function'?greetingName():'Trainer')+' traded his '+(a.sourceName||'a Pokémon')+' for a '+name;
    else if(a.type==='training_complete') text='Completed '+(modeNames[a.mode]||'Training')+' ('+(a.score||0)+'/'+(a.total||10)+')';
    else if(a.type==='daily_complete') text='Completed Daily Dex'+(name?' ('+name+')':'');
    else if(a.type==='daily_uncomplete') text='Daily Dex completion undone'+(name?' ('+name+')':'');
    else if(a.type==='daily_duplicate') text='Logged duplicate catch'+(name?' ('+name+')':'');
    else if(a.type==='perfect_month') text='Completed a Perfect Month'+(a.month?' ('+a.month+')':'');
    return {time:t,text,entry};
  }
  function openDailyDay(key){
    const entry=dailyEntryForDate(key), status=dailyHistoryStatus(key,entry), acts=activitiesForDate(key).map(formatActivity);
    const dateText=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(key+'T12:00:00'));
    if(status==='future'){
      const wrap=document.createElement('div');
      wrap.className='daily-detail-overlay';
      wrap.innerHTML='<div class="daily-detail-modal"><button class="info-close" data-close>×</button><div class="eyebrow">CATCH CALENDAR</div><h2>'+escHtml(dateText)+'</h2><div class="daily-detail-future"><span>?</span><b>Not yet available</b><small>This day is still in the future.</small></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('[data-close]').onclick=()=>wrap.remove();
      wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
      return;
    }
    const wrap=document.createElement('div');
    wrap.className='daily-detail-overlay';
    const statusText=status==='complete'?'✓ Completed':status==='today'?'Today':'× Missed';
    const challengeText=status==='complete'?'Challenge completed':status==='today'?'Today’s challenge':'Challenge missed';
    const activityHtml=acts.map(a=>'<div class="daily-activity-row"><time>'+escHtml(a.time)+'</time><span>'+escHtml(a.text)+'</span>'+(a.entry?'<button class="daily-activity-open" data-entry="'+escHtml(a.entry.id)+'">View</button>':'')+'</div>').join('')||'<div class="empty-panel">No recorded activity for this day.</div>';
    wrap.innerHTML='<div class="daily-detail-modal"><button class="info-close" data-close>×</button><div class="daily-detail-head"><div><div class="eyebrow">CATCH CALENDAR • '+escHtml(key)+'</div><h2>'+escHtml(entry?.name||'Daily Dex')+'</h2><span class="daily-detail-status '+status+'">'+statusText+'</span></div>'+(entry?'<button class="secondary" id="dailyDetailPokemon">View Pokémon</button>':'')+'</div><div class="daily-detail-pokemon">'+(entry?'<img src="'+spritePath(entry)+'" alt="'+escHtml(entry.name)+'">':'')+'<div><b>'+challengeText+'</b><small>'+acts.length+' recorded '+(acts.length===1?'activity':'activities')+' on this day.</small></div></div><section class="daily-activity-section"><div class="section-heading"><div><span class="eyebrow">ACTIVITY</span><h3>What you did that day</h3></div></div><div class="daily-activity-list">'+activityHtml+'</div></section></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-close]').onclick=()=>wrap.remove();
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
    wrap.querySelector('#dailyDetailPokemon')?.addEventListener('click',()=>{if(!entry)return;wrap.remove();openInfo(entry.id);});
    wrap.querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>{wrap.remove();openInfo(b.dataset.entry);});
  }
  let dailyCountdownTimer=null;
  function nextDailyTimestamp(){ const now=new Date(); const next=new Date(now); next.setHours(24,0,0,0); return next.getTime(); }
  function formatCountdown(ms){ const total=Math.max(0,Math.floor(ms/1000)); const h=Math.floor(total/3600), m=Math.floor((total%3600)/60), sec=total%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
  function startDailyCountdown(){
    clearInterval(dailyCountdownTimer);
    const tick=()=>{ const el=document.querySelector('[data-daily-countdown]'); if(!el)return; const left=nextDailyTimestamp()-Date.now(); if(left<=0){clearInterval(dailyCountdownTimer);renderDailyDex();return;} el.textContent=formatCountdown(left); };
    tick(); dailyCountdownTimer=setInterval(tick,1000);
  }
  function renderDailyDex(){
    syncDailyCompletion();
    syncCalendarMilestones();
    backfillDailyHistory();
    const ds=dailyStats(), today=dailyDateKey();
    const minMonth=ds.firstDate ? new Date(`${ds.firstDate}T12:00:00`) : new Date();
    const firstAvailableMonth=new Date(minMonth.getFullYear(),minMonth.getMonth(),1);
    const viewingDate=new Date(dailyCalendarYear,dailyCalendarMonth,1);
    if(viewingDate<firstAvailableMonth){ dailyCalendarYear=firstAvailableMonth.getFullYear(); dailyCalendarMonth=firstAvailableMonth.getMonth(); }
    const y=dailyCalendarYear,m=dailyCalendarMonth,totalDays=monthDays(y,m);
    let leading=(new Date(y,m,1).getDay()+6)%7;
    const cells=[];
    for(let i=0;i<leading;i++) cells.push('<div class="daily-calendar-empty" aria-hidden="true"></div>');
    let monthComplete=0,monthMissed=0,monthPending=0;
    for(let day=1;day<=totalDays;day++){
      const key=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const entry=dailyEntryForDate(key), status=dailyHistoryStatus(key,entry);
      if(status==='complete')monthComplete++; else if(status==='missed')monthMissed++; else if(status==='today')monthPending++;
      const future=status==='future', untracked=status==='untracked';
      const sprite=entry && !future && !untracked ? `<img loading="lazy" decoding="async" src="${spritePath(entry)}" alt="${escHtml(entry.name)}">` : '';
      const name=entry && !future && !untracked ? escHtml(entry.name) : future ? 'Not yet' : 'Not tracked';
      const dayButton = (entry && !future && !untracked)
        ? `<button class="daily-calendar-day ${status}${key===today?' is-today':''}" data-daily-date="${key}" aria-label="${escHtml(entry.name)} on ${key}"><span class="daily-day-number">${day}</span><span class="daily-day-state">${status==='complete'?'✓':status==='missed'?'×':status==='today'?'TODAY':''}</span><div class="daily-day-art">${sprite}</div><b>${name}</b></button>`
        : `<div class="daily-calendar-day ${status}${key===today?' is-today':''}"><span class="daily-day-number">${day}</span><span class="daily-day-state">${future?'':''}</span><div class="daily-day-art">${future?'<span class="daily-question">?</span>':''}</div><b>${name}</b></div>`;
      cells.push(dayButton);
    }
    const canGoNext = true;
    const firstTracked=ds.firstDate;
    const seasonKey=`${y}-${String(m+1).padStart(2,'0')}`;
    const seasonComplete=monthComplete;
    const seasonTarget=Math.max(7,Math.min(totalDays,20));
    const seasonProgress=Math.min(seasonTarget,seasonComplete);
    const perfectCount=Object.keys(ds.perfectMonths||{}).length;
    const todayEntry=dailyDexEntry(), todayOwned=!!(todayEntry&&state[todayEntry.id]), duplicateDone=!!ds.duplicateHistory?.[today];
    $('#view').innerHTML=`<div class="page-card daily-calendar-page">
      <div class="daily-calendar-hero">
        <div><div class="eyebrow">CATCH CALENDAR 2.0</div><h2>Catch Calendar</h2><p>One Pokémon every day. Keep the chain alive, earn milestones and build your Trainer journey.</p></div>
        <div class="daily-hero-actions"><div class="daily-next-card"><span>⏱ NEXT CATCH</span><strong data-daily-countdown>00:00:00</strong><small>New challenge at midnight</small></div><div class="daily-streak-hero"><span>🔥 Current streak</span><strong>${Number(ds.streak||0)}</strong><small>Best ${Number(ds.bestStreak||0)} days</small></div></div>
      </div>
      <section class="daily-calendar-panel">
        <div class="daily-month-bar"><button class="secondary daily-month-btn" id="dailyPrevMonth" aria-label="Previous month">←</button><div><span class="eyebrow">MONTHLY JOURNAL</span><h3>${monthName(y,m)}</h3><p>${monthComplete} completed · ${monthMissed} missed${monthPending?' · today pending':''}</p></div><button class="secondary daily-month-btn" id="dailyNextMonth" aria-label="Next month">→</button></div>
        <div class="daily-month-summary"><span><i class="daily-key-dot complete"></i>Completed</span><span><i class="daily-key-dot missed"></i>Missed</span><span><i class="daily-key-dot today"></i>Today</span><span><i class="daily-key-dot future"></i>Future</span></div>
        <div class="daily-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div>
        <div class="daily-calendar-grid">${cells.join('')}</div>
      </section>
      <section class="daily-season-card"><div><span class="eyebrow">CURRENT SEASON</span><h3>${monthName(y,m)} Season</h3><p>Season progress is based on completed Calendar days. No separate season-completion reward.</p></div><div class="daily-season-progress"><strong>${seasonProgress} / ${seasonTarget}</strong><div class="daily-season-track"><i style="width:${Math.round(seasonProgress/Math.max(1,seasonTarget)*100)}%"></i></div><small>${seasonTarget-seasonProgress>0?`${seasonTarget-seasonProgress} days to the season target`:'Season target reached'}</small></div></section><section class="daily-duplicate-card ${todayOwned?'available':''} ${duplicateDone?'done':''}"><div><span class="eyebrow">TODAY'S CATCH</span><h3>${todayEntry?escHtml(todayEntry.name):'Catch Calendar'}</h3><p>${duplicateDone?'Duplicate catch logged. You can still keep your collection unchanged.':todayOwned?'You already own today’s Pokémon. Log a duplicate catch to complete today without changing your collection.':'Catch today’s Pokémon to complete the Calendar.'}</p></div>${todayOwned&&!duplicateDone?'<button class="primary" id="dailyDuplicateBtn">Log Duplicate Catch</button>':`<span class="daily-duplicate-state">${duplicateDone?'✓ Completed':'Collection catch'}</span>`}</section><section class="daily-insight-grid">
        <article><span class="eyebrow">TOTAL COMPLETED</span><strong>${Number(ds.totalCompleted||0)}</strong><small>Catch Calendar days completed</small></article>
        <article><span class="eyebrow">THIS MONTH</span><strong>${totalDays ? Math.round(monthComplete/Math.max(1,monthComplete+monthMissed+monthPending)*100) : 0}%</strong><small>${monthComplete} completed days</small></article>
        <article><span class="eyebrow">BEST STREAK</span><strong>${Number(ds.bestStreak||0)}</strong><small>Longest consecutive streak</small></article><article><span class="eyebrow">PERFECT MONTHS</span><strong>${perfectCount}</strong><small>Every Calendar day completed</small></article>
        <article><span class="eyebrow">TRACKING SINCE</span><strong>${firstTracked?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${firstTracked}T12:00:00`)):'Today'}</strong><small>Your Catch Calendar journey</small></article>
      </section>
    </div>`;
    const firstMonthIndex=firstAvailableMonth.getFullYear()*12+firstAvailableMonth.getMonth();
    const viewingMonthIndex=y*12+m;
    const prevBtn=$('#dailyPrevMonth');
    if(prevBtn){
      prevBtn.disabled=viewingMonthIndex<=firstMonthIndex;
      prevBtn.addEventListener('click',()=>{
        if(viewingMonthIndex<=firstMonthIndex)return;
        dailyCalendarMonth--;
        if(dailyCalendarMonth<0){dailyCalendarMonth=11;dailyCalendarYear--;}
        renderDailyDex();
      });
    }
    $('#dailyNextMonth')?.addEventListener('click',()=>{
      dailyCalendarMonth++;
      if(dailyCalendarMonth>11){dailyCalendarMonth=0;dailyCalendarYear++;}
      renderDailyDex();
    });
    $('#dailyDuplicateBtn')?.addEventListener('click',completeDailyDuplicate);
    $$('[data-daily-date]').forEach(b=>b.addEventListener('click',(ev)=>{
      const key=b.dataset.dailyDate, entry=dailyEntryForDate(key);
      if(ev.target.closest('.daily-day-art, .daily-day-art img')){ ev.preventDefault(); ev.stopPropagation(); if(entry) openInfo(entry.id); return; }
      openDailyDay(key);
    }));
    // The current challenge artwork on the calendar/progress surfaces opens the same rich info menu.
    $('#dailyDexView')?.addEventListener('click',()=>{const entry=dailyDexEntry(); if(entry) openInfo(entry.id);});
    startDailyCountdown();
  }
  function renderProgressPlus(){
    syncDailyCompletion();
    const s=collectionStats(),main=s.main;
    const generations=Array.from({length:9},(_,i)=>i+1).map(g=>{const list=main.filter(e=>genFor(e)===g),got=list.filter(e=>state[e.id]).length;return {g,total:list.length,got,p:pct(got,list.length)};}).filter(x=>x.total);
    const types=TYPES.map(t=>{const list=main.filter(e=>entryTypes(e).includes(t)),got=list.filter(e=>state[e.id]).length;return {t,total:list.length,got,p:pct(got,list.length)};}).filter(x=>x.total);
    const specialKeys=['vivillon','unown','furfrou','floette','minior','cobblemon-unique','arbok-patterns','minecraft-forms','magikarp-jump'];
    const specialNames={vivillon:'Vivillon',unown:'Unown',furfrou:'Furfrou',floette:'Floette',minior:'Minior','cobblemon-unique':'Cobblemon Unique','arbok-patterns':'Arbok Patterns','minecraft-forms':'Minecraft Forms','magikarp-jump':'Magikarp & Gyarados Jump'};
    const special=specialKeys.map(k=>{const list=pageEntries(k),got=list.filter(e=>state[e.id]).length;return {name:specialNames[k],got,total:list.length,p:pct(got,list.length)}}).filter(x=>x.total);
    const s2={...s,generations,types}, d=s.daily, daily=dailyDexEntry(), dailyDone=dailyCompletionFor(dailyDateKey(),daily), dailyOwned=!!(daily&&state[daily.id]), dailyDuplicateDone=!!dailyStats().duplicateHistory?.[dailyDateKey()];
    const milestones=milestoneDefinitions(s2), unlocked=milestones.filter(m=>m.unlocked).length;
    $('#view').innerHTML=`<div class="page-card progress-plus v14-progress">
      <div class="achievement-hero"><div><div class="eyebrow">COLLECTION DASHBOARD</div><h2>Progress</h2><p>${escHtml(greetingName())}'s complete LivingDex overview.</p></div><div class="achievement-total"><strong>${s.mainCaught}</strong><span>/ ${s.mainTotal} main caught</span><i style="width:${pct(s.mainCaught,s.mainTotal)}%"></i></div></div>
      <section class="progress-stat-grid"><div><b>${s.caught}</b><span>Total caught</span></div><div><b>${s.missing}</b><span>Total missing</span></div><div><b>${pct(s.caught,s.total)}%</b><span>Total complete</span></div><div><b>${s.favoriteCount}</b><span>Favorites</span></div><div><b>${s.fullBoxes}</b><span>Full boxes</span></div><div class="stat-accent"><b>${d.streak||0}</b><span>Daily streak</span></div></section>
      <section class="daily-dex-card ${dailyDone?'daily-complete':''}"><div class="daily-dex-art">${daily?`<img src="${spritePath(daily)}" alt="${escHtml(daily.name)}">`:''}</div><div class="daily-dex-copy"><span class="eyebrow">CATCH CALENDAR • ${escHtml(dailyDateKey())}</span><h3>${daily?escHtml(daily.name):'Catch Calendar'}</h3><p>${dailyDone?(dailyDuplicateDone?'Duplicate catch logged today. Keep the streak alive tomorrow.':'Completed today. Keep the streak alive tomorrow.'):dailyOwned?'You already own today’s Pokémon — log a duplicate catch to complete today.':'Complete today’s Catch Calendar by having this Pokémon in your collection.'}</p><div class="daily-meta"><span class="daily-status">${dailyDone?'✓ Completed today':'○ Not completed today'}</span><span>🔥 ${d.streak||0} day streak</span><span>Best ${d.bestStreak||0}</span></div></div>${dailyOwned&&!dailyDuplicateDone?'<button id="dailyDuplicateProgress" class="primary">Log Duplicate Catch</button>':''}<button id="dailyDexView" class="secondary" ${daily?'':'disabled'}>View Pokémon</button></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">GENERATIONS</span><h3>Generation completion</h3></div><span class="section-note">${generations.filter(x=>x.got===x.total).length} / ${generations.length} complete</span></div><div class="progress-grid generation-progress">${generations.map(x=>`<article class="progress-card ${x.got===x.total?'progress-complete':''}"><div class="progress-card-top"><span>Generation ${generationName(x.g)}</span><strong>${x.got} / ${x.total}</strong></div><div class="progress-track"><i style="width:${x.p}%"></i></div><small>${x.p}% complete</small></article>`).join('')}</div></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">TYPES</span><h3>Completion per type</h3></div><span class="section-note">${types.filter(x=>x.got===x.total).length} / ${types.length} complete</span></div><div class="progress-grid type-progress">${types.map(x=>`<article class="progress-card ${x.got===x.total?'progress-complete':''}"><div class="progress-card-top"><span class="knowledge-chip mini" style="${typeStyle(x.t)}">${escHtml(typeLabel(x.t))}</span><strong>${x.got} / ${x.total}</strong></div><div class="progress-track"><i style="width:${x.p}%"></i></div><small>${x.p}% complete</small></article>`).join('')}</div></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">SPECIAL COLLECTIONS</span><h3>Special forms</h3></div></div><div class="progress-grid special-progress">${special.map(x=>`<article class="progress-card ${x.got===x.total?'progress-complete':''}"><div class="progress-card-top"><span>${escHtml(x.name)}</span><strong>${x.got} / ${x.total}</strong></div><div class="progress-track"><i style="width:${x.p}%"></i></div><small>${x.p}% complete</small></article>`).join('')}</div></section>
      <section class="progress-footer-grid"><article class="progress-summary-card"><div class="summary-icon">🏅</div><div><span class="eyebrow">MILESTONES</span><h3>${unlocked} / ${milestones.length} badges earned</h3><p>Badges for collection, Catch Calendar and Training achievements.</p></div><button id="progressMilestones" class="secondary">View Milestones</button></article><article class="progress-summary-card"><div class="summary-icon">◎</div><div><span class="eyebrow">TRAINING</span><h3>${escHtml(s.training.rank)} Rank</h3><p>${s.training.totalQuestions} questions · ${s.training.accuracy}% accuracy · best ${s.training.bestScore}/10</p></div><button id="progressTraining" class="secondary">Open Training</button></article></section>
    </div>`;
    $('#dailyDuplicateProgress')?.addEventListener('click',completeDailyDuplicate);
    $('#dailyDexView')?.addEventListener('click',()=>daily&&openInfo(daily.id));
    $('#progressMilestones')?.addEventListener('click',()=>window.LivingDexNavigate?.('milestones'));
    $('#progressTraining')?.addEventListener('click',()=>window.LivingDexNavigate?.('training'));
  }
  function renderMilestones(){
    const main=mainEntries().filter(e=>e.box);
    const generations=Array.from({length:9},(_,i)=>i+1).map(g=>{const list=main.filter(e=>genFor(e)===g),got=list.filter(e=>state[e.id]).length;return {g,total:list.length,got};}).filter(x=>x.total);
    const types=TYPES.map(t=>{const list=main.filter(e=>entryTypes(e).includes(t)),got=list.filter(e=>state[e.id]).length;return {t,total:list.length,got};}).filter(x=>x.total);
    const s=collectionStats(), ms=milestoneDefinitions({...s,generations,types}), unlocked=ms.filter(m=>m.unlocked).length;
    $('#view').innerHTML=`<div class="page-card online-page milestones-page v14-page"><div class="achievement-hero"><div><div class="eyebrow">BADGE COLLECTION</div><h2>Milestones</h2><p>Earn rewards through your LivingDex, Catch Calendar missions and Training.</p></div><div class="achievement-total"><strong>${unlocked}</strong><span>/ ${ms.length} earned</span><i style="width:${pct(unlocked,ms.length)}%"></i></div></div><div class="milestone-grid v14-milestones">${ms.map(m=>`<article class="milestone-badge ${m.unlocked?'unlocked':''}"><div class="badge-art"><img src="${escHtml(m.asset)}" alt="${escHtml(m.name)}"></div><div><b>${escHtml(m.name)}</b><p>${escHtml(m.desc)}</p></div><span class="badge-state">${m.unlocked?'EARNED':'LOCKED'}</span></article>`).join('')}</div></div>`;
  }
  // Training hub and quizzes.
  const shuffle=a=>a.slice().sort(()=>Math.random()-.5);
  const pickEntry=pool=>pool[Math.floor(Math.random()*pool.length)];
  function trainingQuestion(mode){
    const pool=mainEntries().filter(e=>entryTypes(e).length);
    let e=pickEntry(pool); let choices=[], prompt='', correct='';
    if(mode==='who'){
      correct=e.name; choices=shuffle([correct,...shuffle(pool.filter(x=>x.id!==e.id).map(x=>x.name)).slice(0,3)]); prompt='Who is this Pokémon?';
    } else if(mode==='type'){
      const def=entryTypes(e); const eff=TYPES.filter(t=>effectiveness(def,t)>1); correct=pickEntry(eff.length?eff:TYPES); choices=shuffle([correct,...shuffle(TYPES.filter(t=>t!==correct && !eff.includes(t))).slice(0,3)]); prompt=`Which attacking type is super effective against ${e.name}?`;
    } else if(mode==='evolution'){
      // Build questions from the actual Cobblemon species preEvolution relation.
      // Both the target and the correct answer are always the exact LivingDex entries
      // whose displayed names are used by the buttons, so punctuation/normalisation
      // differences in the local species dataset can never make the answer invisible.
      const basePool=mainEntries().filter(e=>e.box&&!e.form);
      const bySpecies=new Map();
      basePool.forEach(entry=>{
        const key=speciesKeyFromName(entry.raw||entry.name||'')||norm(entry.name||'');
        if(!bySpecies.has(key))bySpecies.set(key,entry);
      });
      const pairs=[];
      const evolutionSourceIds=new Set();
      for(const [targetKey,targetSpecies] of Object.entries(LOCAL_SPECIES)){
        if(!targetSpecies?.preEvolution) continue;
        const sourceKey=speciesKeyFromName(targetSpecies.preEvolution)||norm(targetSpecies.preEvolution).replace(/[^a-z0-9]+/g,'');
        const sourceEntry=bySpecies.get(sourceKey);
        const targetEntry=bySpecies.get(targetKey);
        if(!sourceEntry||!targetEntry||sourceEntry.id===targetEntry.id) continue;
        // Validate the relation against the source species' actual evolution result.
        const sourceSpecies=LOCAL_SPECIES[sourceKey];
        const pointsToTarget=(sourceSpecies?.evolutions||[]).some(ev=>speciesKeyFromName(ev.result||'')===targetKey);
        if(!pointsToTarget) continue;
        pairs.push({source:sourceEntry,target:targetEntry});
        evolutionSourceIds.add(sourceEntry.id);
      }
      const pair=pickEntry(pairs);
      if(!pair){ return trainingQuestion('who'); }
      const target=pair.target;
      e=target;
      correct=pair.source.name;
      // Every answer option must itself belong to a real evolution relationship.
      // This prevents unrelated single-stage Pokémon from appearing as distractors.
      const evolutionAnswerPool=basePool.filter(x=>evolutionSourceIds.has(x.id)&&x.id!==pair.source.id);
      choices=shuffle([correct,...shuffle(evolutionAnswerPool.map(x=>x.name).filter(n=>n!==correct)).slice(0,3)]);
      prompt='Which Pokémon evolves into the Pokémon shown?';
    } else if(mode==='pokedex'){
      correct=String(e.dex); choices=shuffle([correct,...shuffle(pool.filter(x=>x.id!==e.id).map(x=>String(x.dex))).slice(0,3)]); prompt=`What is ${e.name}'s Pokédex number?`;
    } else {
      correct=String(genFor(e)); choices=shuffle([correct,...['1','2','3','4','5','6','7','8','9'].filter(x=>x!==correct).sort(()=>Math.random()-.5).slice(0,3)]); prompt=`Which generation introduced ${e.name}?`;
    }
    return {mode,e,choices,prompt,correct};
  }
  function startTraining(mode){
    trainingSession={mode,score:0,streak:0,total:0,answered:false,q:null};
    const overlay=document.createElement('div');overlay.className='picker-overlay training-overlay';overlay.id='trainingOverlay';
    overlay.innerHTML=`<div class="training-modal"><button class="info-close" id="trainingClose">×</button><div class="eyebrow">TRAINING</div><h2 id="trainingTitle"></h2><div class="quiz-score"><span>Score <b id="trainingScore">0</b></span><span>Streak <b id="trainingStreak">0</b></span><span>Question <b id="trainingNumber">1</b>/10</span></div><div id="trainingQuestion"></div><div id="trainingFeedback" class="quiz-feedback"></div><button id="trainingNext" class="primary" hidden>Next question</button></div>`;
    document.body.appendChild(overlay); $('#trainingClose').onclick=()=>overlay.remove(); overlay.onclick=e=>{if(e.target===overlay)overlay.remove();}; $('#trainingNext').onclick=draw;
    function draw(){
      if(trainingSession.total>=10){finish();return;} trainingSession.q=trainingQuestion(mode);trainingSession.questionStartedAt=Date.now();trainingSession.answered=false;const q=trainingSession.q;
      $('#trainingTitle').textContent={who:"Who's That Pokémon?",type:'Type Learner',evolution:'Evolution Training',pokedex:'Pokédex Training',generation:'Generation Training'}[mode];
      const art=mode==='who'?`<div class="training-art"><img loading="lazy" decoding="async" src="${spritePath(q.e)}"></div>`:mode==='evolution'?`<div class="training-target evolution-target"><div class="evolution-target-art"><img loading="lazy" decoding="async" src="${spritePath(q.e)}"><span>Target Pokémon</span></div><div><b>${escHtml(q.e.name)}</b><small>${escHtml(q.prompt)}</small></div></div>`:`<div class="training-target"><img loading="lazy" decoding="async" src="${spritePath(q.e)}"><div><b>${escHtml(q.prompt)}</b></div></div>`;
      $('#trainingQuestion').innerHTML=`${art}<div class="quiz-prompt">${mode==='who'?'':escHtml(q.prompt)}</div><div class="quiz-choices">${q.choices.map(c=>`<button class="quiz-choice" data-answer="${escHtml(c)}">${escHtml(mode==='type'?typeLabel(c):mode==='generation'?`Generation ${generationName(Number(c))}`:c)}</button>`).join('')}</div>`;
      $('#trainingFeedback').textContent='';$('#trainingNext').hidden=true;$('#trainingNumber').textContent=trainingSession.total+1;
      $$('#trainingQuestion .quiz-choice').forEach(b=>b.onclick=()=>answer(b));
    }
    function answer(btn){if(trainingSession.answered)return;trainingSession.answered=true;trainingSession.total++;const elapsed=Math.max(0,Date.now()-(trainingSession.questionStartedAt||Date.now()));trainingSession.totalTimeMs=(trainingSession.totalTimeMs||0)+elapsed;trainingSession.times=(trainingSession.times||[]);trainingSession.times.push(elapsed);trainingSession.bestTimeMs=trainingSession.bestTimeMs==null?elapsed:Math.min(trainingSession.bestTimeMs,elapsed);if(elapsed<5000)trainingSession.fastAnswers=(trainingSession.fastAnswers||0)+1;const ok=btn.dataset.answer===String(trainingSession.q.correct);if(ok){trainingSession.score++;trainingSession.streak++;btn.classList.add('correct');}else{trainingSession.streak=0;btn.classList.add('wrong');$$('#trainingQuestion .quiz-choice').forEach(b=>{if(b.dataset.answer===String(trainingSession.q.correct))b.classList.add('correct');});}$('#trainingScore').textContent=trainingSession.score;$('#trainingStreak').textContent=trainingSession.streak;$('#trainingFeedback').textContent=ok?`${assistantName()}: Correct!`:`${assistantName()}: The answer was ${mode==='type'?typeLabel(trainingSession.q.correct):mode==='generation'?`Generation ${generationName(Number(trainingSession.q.correct))}`:trainingSession.q.correct}.`;$('#trainingNext').textContent=trainingSession.total>=10?'Finish':'Next question';$('#trainingNext').hidden=false;}
    function finish(){const key=mode;trainingStats[key]??={questions:0,correct:0,best:0};const ss=trainingStats[key];ss.questions+=trainingSession.total;ss.correct+=trainingSession.score;ss.best=Math.max(ss.best||0,trainingSession.score);ss.totalTimeMs=Number(ss.totalTimeMs||0)+Number(trainingSession.totalTimeMs||0);ss.timedQuestions=Number(ss.timedQuestions||0)+Number(trainingSession.total||0);ss.bestTimeMs=ss.bestTimeMs==null?trainingSession.bestTimeMs:Math.min(Number(ss.bestTimeMs),Number(trainingSession.bestTimeMs));ss.bestSessionTimeMs=ss.bestSessionTimeMs==null?Number(trainingSession.totalTimeMs||0):Math.min(Number(ss.bestSessionTimeMs),Number(trainingSession.totalTimeMs||0));trainingStats.__trainingSessions=Number(trainingStats.__trainingSessions||0)+1;trainingStats.__fastAnswers=Number(trainingStats.__fastAnswers||0)+Number(trainingSession.fastAnswers||0);trainingStats.__totalTimeMs=Number(trainingStats.__totalTimeMs||0)+Number(trainingSession.totalTimeMs||0);trainingStats.__timedQuestions=Number(trainingStats.__timedQuestions||0)+Number(trainingSession.total||0);trainingStats.__bestTimeMs=trainingStats.__bestTimeMs==null?trainingSession.bestTimeMs:Math.min(Number(trainingStats.__bestTimeMs),Number(trainingSession.bestTimeMs));trainingStats.__bestSessionTimeMs=trainingStats.__bestSessionTimeMs==null?Number(trainingSession.totalTimeMs||0):Math.min(Number(trainingStats.__bestSessionTimeMs),Number(trainingSession.totalTimeMs||0));if(trainingSession.score===10)trainingStats.__perfectSessions=Number(trainingStats.__perfectSessions||0)+1;recordActivity('training_complete',{mode,score:trainingSession.score,total:trainingSession.total});saveTraining();overlay.remove();renderTraining();}
    draw();
  }
  function renderTraining(){
    const labels={who:["Who's That Pokémon?",'Identify Pokémon from their sprite.'],type:['Type Learner','Learn weaknesses, resistances and super-effective matchups.'],evolution:['Evolution Training','Practice evolution relationships.'],pokedex:['Pokédex Training','Learn numbers and LivingDex order.'],generation:['Generation Training','Practice which generation each Pokémon belongs to.']};
    const sum=trainingSummary();
    const cards=Object.entries(labels).map(([k,v])=>{const ss=trainingStats[k]||{};const acc=ss.questions?pct(ss.correct||0,ss.questions):0;return `<article class="training-card"><div class="training-card-icon">${{who:'?',type:'T',evolution:'↗',pokedex:'#',generation:'G'}[k]}</div><div><div class="eyebrow">TRAINING</div><h3>${v[0]}</h3><p>${v[1]}</p><div class="training-statline"><span>Best <b>${ss.best||0}/10</b></span><span>Accuracy <b>${acc}%</b></span><span>Questions <b>${ss.questions||0}</b></span><span>Avg <b>${ss.timedQuestions?((ss.totalTimeMs/ss.timedQuestions)/1000).toFixed(2)+'s':'—'}</b></span><span>Best Time <b>${ss.bestTimeMs!=null?(ss.bestTimeMs/1000).toFixed(2)+'s':'—'}</b></span><span>Rank <b>${trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=95?'Master':trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=85?'Platinum':trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=75?'Gold':trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=60?'Silver':'Bronze'}</b></span></div></div><button class="primary training-start" data-training="${k}">Start</button></article>`;}).join('');
    $('#view').innerHTML=`<div class="page-card training-page v14-training"><div class="page-title"><div><div class="eyebrow">TRAINER SCHOOL</div><h2>Training</h2><p>Test your Pokémon knowledge and build your skills.</p></div><div class="training-rank-card"><span class="eyebrow">TRAINING RANK</span><strong>${sum.rank}</strong><small>${sum.totalCorrect} correct · ${sum.accuracy}% accuracy</small></div></div><div class="training-overview-grid"><div><b>${sum.totalQuestions}</b><span>Questions answered</span></div><div><b>${sum.totalCorrect}</b><span>Correct answers</span></div><div><b>${sum.accuracy}%</b><span>Overall accuracy</span></div><div><b>${sum.bestScore}/10</b><span>Best score</span></div><div><b>${sum.perfectModes}</b><span>Perfect modes</span></div><div><b>${sum.totalSessions}</b><span>Sessions</span></div><div><b>${sum.fastAnswers}</b><span>Fast answers</span></div><div><b>${trainingStats.__timedQuestions?((trainingStats.__totalTimeMs/trainingStats.__timedQuestions)/1000).toFixed(2)+'s':'—'}</b><span>Average time</span></div><div><b>${trainingStats.__bestTimeMs!=null?(trainingStats.__bestTimeMs/1000).toFixed(2)+'s':'—'}</b><span>Fastest answer</span></div></div><div class="training-grid">${cards}</div></div>`;
        $$('.training-start').forEach(b=>b.onclick=()=>startTraining(b.dataset.training));
  }
  // Type Knowledge is now reference-only. Quiz lives under Training.
  window.renderTypeKnowledge = function(){
    const selected=window.knowledgeTypes||[]; const q=norm(window.knowledgeQuery||''); const shown=TYPES.filter(t=>!q||norm(typeLabel(t)).includes(q)).slice(0,20); const defTypes=selected.length?selected:['Fire'];
    const rows=TYPES.map(t=>({type:t,m:effectiveness(defTypes,t)})); const weak=rows.filter(x=>x.m>1), resist=rows.filter(x=>x.m>0&&x.m<1), immune=rows.filter(x=>x.m===0);
    const chips=a=>a.map(x=>`<span class="knowledge-chip" style="${typeStyle(x.type)}">${escHtml(typeLabel(x.type))}<small>${x.m===0?'×0':x.m>=4?`${x.m}×`:x.m>1?'×2':x.m<1?'×½':'×1'}</small></span>`).join('')||'<span class="muted-dash">None</span>';
    $('#view').innerHTML=`<div class="page-card knowledge-page"><div class="page-title"><div><div class="eyebrow">TYPE DATABASE</div><h2>Type Knowledge</h2><p>Study exact type matchups. Training quizzes are now under Training.</p></div></div><div class="knowledge-selector"><div class="knowledge-search"><span>⌕</span><input id="knowledgeSearch" value="${escHtml(q)}" placeholder="Search types..."></div><div class="knowledge-selected-row">${selected.map(t=>`<button class="knowledge-selected" data-remove-type="${t}" style="${typeStyle(t)}">${escHtml(typeLabel(t))} ×</button>`).join('')||'<span class="selector-hint">Select up to two types</span>'}</div><div class="knowledge-options">${shown.map(t=>`<button class="knowledge-option ${selected.includes(t)?'selected':''}" data-add-type="${t}" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</button>`).join('')}</div></div><div class="knowledge-hero">${defTypes.map(t=>`<span class="big-type" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</span>`).join('<span class="combo-slash">/</span>')}<div><span class="eyebrow">DEFENSIVE PROFILE</span><h3>${escHtml(defTypes.map(typeLabel).join(' / '))}</h3><p>How attacking types interact with this combination.</p></div></div><div class="knowledge-columns"><section class="knowledge-panel offensive"><div class="panel-heading"><div><span class="eyebrow">ATTACKING</span><h3>Super effective</h3></div></div><div class="chip-cloud">${chips(weak)}</div><div class="knowledge-sub"><h4>Not very effective</h4><div class="chip-cloud">${chips(resist)}</div></div><div class="knowledge-sub"><h4>No effect</h4><div class="chip-cloud">${chips(immune)}</div></div></section><section class="knowledge-panel defensive"><div class="panel-heading"><div><span class="eyebrow">MULTIPLIERS</span><h3>Full matchup</h3></div></div><div class="type-multiplier-grid">${rows.map(x=>`<div class="type-multiplier"><span class="knowledge-chip mini" style="${typeStyle(x.type)}">${escHtml(typeLabel(x.type))}</span><strong>${x.m===0?'×0':x.m===1?'×1':x.m+'×'}</strong></div>`).join('')}</div></section></div></div>`;
    $('#knowledgeSearch').oninput=e=>{window.knowledgeQuery=e.target.value;renderTypeKnowledge();};
    $$('[data-add-type]').forEach(b=>b.onclick=()=>{const t=b.dataset.addType;if(selected.includes(t))window.knowledgeTypes=selected.filter(x=>x!==t);else if(selected.length<2)window.knowledgeTypes=[...selected,t];renderTypeKnowledge();});
    $$('[data-remove-type]').forEach(b=>b.onclick=()=>{window.knowledgeTypes=selected.filter(x=>x!==b.dataset.removeType);renderTypeKnowledge();});
  };

  // ================================================================
  // V2.0.0 — TRAINER OS FOUNDATION
  // New shell/navigation/home layered over the stable V1.7.15 core.
  // ================================================================
  const V2_NAV = [
    ['home','⌂','Home'],
    ['activity','≡','Feed'],
    ['dex','▦','LivingDex'],
    ['daily','◷','Catch Calendar'],
    ['training','⚔','Training'],
    ['team','◇','Team Builder'],
    ['types','◈','Type Knowledge'],
    ['achievements','★','Progress'],
    ['stats','◌','Statistics'],
    ['goals','◎','Goals'],
    ['profile','◉','Trainer'],
    ['players','◎','Players'],
    ['leaderboard','♛','Leaderboard']
  ];
  function v2Profile(){
    try{return JSON.parse(localStorage.getItem('cobblemon-livingdex-profile')||'{}')||{};}catch{return {};}
  }
  function v2Name(){return String(v2Profile().name||greetingName?.()||'Trainer').trim()||'Trainer';}
  function v2CaughtCount(){return entries.filter(e=>!!state[e.id]).length;}
  function v2MainCount(){return pageEntries('main').length||entries.length;}
  function v2Pct(a,b){return b?Math.round(a/b*100):0;}
  function v2IconNav(active){
    const primary=V2_NAV.filter(x=>['home','activity','dex','daily','training','team','types'].includes(x[0]));
    const journey=V2_NAV.filter(x=>['achievements','stats','goals'].includes(x[0]));
    const social=V2_NAV.filter(x=>['profile','players','leaderboard'].includes(x[0]));
    const button=([id,icon,label])=>`<button class="v2-nav-item ${active===id?'active':''}" data-v2-view="${id}"><span class="v2-nav-icon">${icon}</span><span>${label}</span></button>`;
    const section=(label,items)=>`<div class="v2-nav-section"><span class="v2-nav-section-label">${label}</span>${items.map(button).join('')}</div>`;
    const side=document.querySelector('#v2SidebarNav');
    if(side) side.innerHTML=section('TRAINER HUB',primary)+section('JOURNEY',journey)+section('SOCIAL',social)+`<div class="v2-nav-account"><button type="button" class="v2-account-action" id="v2AccountAction">${window.LivingDexOnline?.user?'↪ Sign out':'↗ Sign in'}</button></div>`;
    const mobileItems=[V2_NAV.find(x=>x[0]==='home'),V2_NAV.find(x=>x[0]==='activity'),V2_NAV.find(x=>x[0]==='dex'),V2_NAV.find(x=>x[0]==='training'),V2_NAV.find(x=>x[0]==='profile')];
    const mobile=document.querySelector('#v2MobileNav');
    if(mobile) mobile.innerHTML=mobileItems.map(([id,icon,label])=>`<button class="v2-mobile-item ${active===id?'active':''}" data-v2-view="${id}"><span>${icon}</span><small>${id==='profile'?'Trainer':label}</small></button>`).join('');
    document.querySelectorAll('[data-v2-view]').forEach(b=>b.onclick=()=>v2Navigate(b.dataset.v2View));
    const account=document.querySelector('#v2AccountAction');
    if(account) account.onclick=()=>window.LivingDexOnline?.user?window.LivingDexOnline.logout?.():window.LivingDexOnline?.login?.();
  }
  let v2FeedLiveTimer=null;
  function v2StopFeedLive(){if(v2FeedLiveTimer){clearInterval(v2FeedLiveTimer);v2FeedLiveTimer=null;}}
  function v2StartFeedLive(){v2StopFeedLive();v2FeedLiveTimer=setInterval(()=>{if(view!=='activity'){v2StopFeedLive();return;}if(document.visibilityState==='hidden')return;const list=document.querySelector('.v2-feed-list');const keep=list?.scrollTop||0;v2RenderFeed({silent:true}).then(()=>{const next=document.querySelector('.v2-feed-list');if(next)next.scrollTop=keep;});},30000);}
  function v2Navigate(target){
    if(target!=='activity')v2StopFeedLive();
    closeInfo();
    if(target==='profile'){ renderV2TrainerCard(); return; }
    if(['players','leaderboard'].includes(target)){
      view=target; v2IconNav(target); renderTopNav(); renderView(); return;
    }
    view=target; v2IconNav(target); renderTopNav(); renderView();
  }
  function renderV2TrainerCard(){
    const p=v2Profile();
    const meta=profileMeta();
    const caught=v2CaughtCount(), total=v2MainCount(), pct=v2Pct(caught,total);
    const xp=v2XpSnapshot(), daily=v2DailySnapshot();
    const stats=collectionStats();
    const badges=milestoneDefinitions({...stats,generations:v2GenerationStats(),types:stats.types||[]});
    const unlocked=badges.filter(b=>b.unlocked), featuredIds=(meta.featuredBadges||[]).slice(0,5);
    const featured=featuredIds.map(id=>badges.find(b=>b.id===id)).filter(Boolean);
    const favId=p.favoritePokemon||'';
    const fav=entries.find(e=>e.name===favId || e.id===favId);
    const teamIds=Array.isArray(team)?team.slice(0,6):[];
    const teamCards=teamIds.map(id=>{
      const e=entries.find(x=>x.id===id||x.name===id);
      return e?`<div class="v2-trainer-team-mon"><img loading="lazy" decoding="async" src="${escHtml(spritePath(e))}" alt="${escHtml(e.name)}"><span>${escHtml(e.name)}</span></div>`:'';
    }).join('') || '<div class="v2-trainer-empty">No team selected yet.</div>';
    const genRows=v2GenerationStats().map(g=>`<div class="v2-trainer-progress-row"><span>Generation ${g.g}</span><div><i style="width:${g.pct}%"></i></div><b>${g.pct}%</b></div>`).join('');
    const typeRows=(stats.types||[]).slice().sort((a,b)=>b.p-a.p).slice(0,6).map(t=>`<div class="v2-trainer-type-row"><span>${escHtml(typeLabel(t.t))}</span><div><i style="width:${t.p}%"></i></div><b>${t.p}%</b></div>`).join('');
    const banner=meta.banner||p.banner||'aurora';
    const ign=meta.ign||p.ign||'';
    const bio=meta.bio||p.bio||'';
    const favoriteArt=fav?`<img class="v2-trainer-favorite-art" loading="lazy" decoding="async" src="${escHtml(spritePath(fav))}" alt="${escHtml(fav.name)}">`:'';
    $('#dexView').hidden=true; $('#view').hidden=false;
    $('#view').innerHTML=`
      <div class="v2-trainer-page">
        <section class="v2-trainer-hero banner-${escHtml(banner)}">
          <div class="v2-trainer-hero-glow"></div>
          <div class="v2-trainer-identity">
            <div class="v2-trainer-avatar">◈</div>
            <div><span class="eyebrow">TRAINER CARD 2.0</span><h2>${escHtml(p.name||p.trainerName||'Trainer')}</h2><p>${ign?`IGN · ${escHtml(ign)} · `:''}Trainer OS</p>${bio?`<div class="v2-trainer-bio">${escHtml(bio)}</div>`:''}</div>
          </div>
          <div class="v2-trainer-hero-actions"><div class="v2-level-pill"><strong>LV ${xp.level}</strong><span>${xp.intoLevel}/100 XP</span></div><button id="v2TrainerEdit" class="primary">Edit Profile</button></div>
          ${favoriteArt}
        </section>
        <section class="v2-trainer-stat-grid">
          <article><span>LivingDex</span><strong>${pct}%</strong><small>${caught.toLocaleString()} / ${total.toLocaleString()} caught</small></article>
          <article><span>Trainer XP</span><strong>${xp.xp.toLocaleString()}</strong><small>${100-xp.intoLevel} XP to next level</small></article>
          <article><span>Daily Streak</span><strong>🔥 ${daily.streak}</strong><small>Best ${daily.bestStreak}</small></article>
          <article><span>Rewards</span><strong>${unlocked.length}</strong><small>${badges.length} total milestones</small></article>
        </section>
        <div class="v2-trainer-columns">
          <div class="v2-trainer-main">
            <section class="v2-trainer-panel v2-trainer-progress-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">COLLECTION PROGRESS</span><h3>How far you've come</h3></div><strong>${pct}%</strong></div><div class="v2-trainer-wide-progress"><i style="width:${pct}%"></i></div><div class="v2-trainer-progress-grid">${genRows}</div></section>
            <section class="v2-trainer-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">FEATURED</span><h3>Your badges</h3></div><button id="v2TrainerBadges" class="secondary">Edit badges</button></div><div class="v2-trainer-badges">${featured.map(b=>`<div class="v2-trainer-badge"><img loading="lazy" decoding="async" src="${escHtml(b.asset)}" alt="${escHtml(b.name)}"><b>${escHtml(b.name)}</b></div>`).join('')||'<div class="v2-trainer-empty">No featured badges yet. Earn milestones and choose your favourites.</div>'}</div></section>
            <section class="v2-trainer-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">TYPE COLLECTION</span><h3>Your strongest types</h3></div></div><div class="v2-trainer-type-list">${typeRows}</div></section>
          </div>
          <aside class="v2-trainer-side">
            <section class="v2-trainer-panel v2-trainer-favorite-panel"><span class="eyebrow">FAVOURITE POKÉMON</span><h3>${fav?escHtml(fav.name):'Choose a favourite'}</h3>${favoriteArt?`<div class="v2-trainer-favorite-wrap">${favoriteArt}</div>`:'<p>Set your favourite Pokémon in Edit Profile.</p>'}</section>
            <section class="v2-trainer-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">YOUR TEAM</span><h3>Current squad</h3></div><button id="v2TrainerTeam" class="secondary">Team Builder</button></div><div class="v2-trainer-team">${teamCards}</div></section>
            <section class="v2-trainer-panel v2-trainer-quick-stats"><span class="eyebrow">TRAINER RECORD</span><div><b>${stats.favoriteCount||0}</b><small>Favorites</small></div><div><b>${stats.fullBoxes||0}</b><small>Full boxes</small></div><div><b>${stats.training?.totalQuestions||0}</b><small>Training questions</small></div><div><b>${stats.training?.accuracy||0}%</b><small>Training accuracy</small></div></section>
          </aside>
        </div>
      </div>`;
    $('#v2TrainerEdit')?.addEventListener('click',()=>openProfileOptions?.());
    $('#v2TrainerBadges')?.addEventListener('click',()=>window.openFeaturedBadgeEditor?.());
    $('#v2TrainerTeam')?.addEventListener('click',()=>v2Navigate('team'));
  }

  function buildV2TrainerCardMarkup(data={}){
    const p=data.profile||{};
    const meta=data.meta||{};
    const caught=Number(data.caught||0), total=Number(data.total||entries.length||0), pct=v2Pct(caught,total);
    const xp=data.xp||{xp:0,level:1,intoLevel:0};
    const daily=data.daily||{streak:0,bestStreak:0};
    const badges=Array.isArray(data.badges)?data.badges:[];
    const featured=Array.isArray(data.featured)?data.featured.slice(0,5):[];
    const favId=p.favoritePokemon||p.favorite_pokemon||meta.favoritePokemon||meta.favorite_pokemon||'';
    const fav=entries.find(e=>e.name===favId||e.id===favId);
    const teamIds=Array.isArray(data.team)?data.team.slice(0,6):[];
    const teamCards=teamIds.map(id=>{const e=entries.find(x=>x.id===id||x.name===id);return e?`<div class="v2-trainer-team-mon"><img loading="lazy" decoding="async" src="${escHtml(spritePath(e))}" alt="${escHtml(e.name)}"><span>${escHtml(e.name)}</span></div>`:'';}).join('')||'<div class="v2-trainer-empty">No team selected yet.</div>';
    const genRows=(Array.isArray(data.generations)?data.generations:[]).map(g=>`<div class="v2-trainer-progress-row"><span>Generation ${g.g}</span><div><i style="width:${Number(g.pct||0)}%"></i></div><b>${Number(g.pct||0)}%</b></div>`).join('');
    const typeRows=(Array.isArray(data.types)?data.types:[]).slice().sort((a,b)=>Number(b.p||0)-Number(a.p||0)).slice(0,6).map(t=>`<div class="v2-trainer-type-row"><span>${escHtml(typeLabel(t.t))}</span><div><i style="width:${Number(t.p||0)}%"></i></div><b>${Number(t.p||0)}%</b></div>`).join('');
    const banner=meta.banner||p.banner||'aurora';
    const ign=meta.ign||p.ign||'';
    const bio=meta.bio||p.bio||'';
    const favoriteArt=fav?`<img class="v2-trainer-favorite-art" loading="lazy" decoding="async" src="${escHtml(spritePath(fav))}" alt="${escHtml(fav.name)}">`:'';
    const stats=data.stats||{};
    return `<div class="v2-trainer-page v2-public-trainer-card">
      <section class="v2-trainer-hero banner-${escHtml(banner)}">
        <div class="v2-trainer-hero-glow"></div>
        <div class="v2-trainer-identity"><div class="v2-trainer-avatar">◈</div><div><span class="eyebrow">TRAINER CARD 2.0</span><h2>${escHtml(p.name||p.trainerName||p.display_name||'Trainer')}</h2><p>${ign?`IGN · ${escHtml(ign)} · `:''}Trainer OS</p>${bio?`<div class="v2-trainer-bio">${escHtml(bio)}</div>`:''}</div></div>
        <div class="v2-trainer-hero-actions"><div class="v2-level-pill"><strong>LV ${xp.level}</strong><span>${xp.intoLevel}/100 XP</span></div></div>${favoriteArt}
      </section>
      <section class="v2-trainer-stat-grid"><article><span>LivingDex</span><strong>${pct}%</strong><small>${caught.toLocaleString()} / ${total.toLocaleString()} caught</small></article><article><span>Trainer XP</span><strong>${Number(xp.xp||0).toLocaleString()}</strong><small>${Math.max(0,100-Number(xp.intoLevel||0))} XP to next level</small></article><article><span>Daily Streak</span><strong>🔥 ${Number(daily.streak||0)}</strong><small>Best ${Number(daily.bestStreak||0)}</small></article><article><span>Rewards</span><strong>${badges.length}</strong><small>earned milestones</small></article></section>
      <div class="v2-trainer-columns"><div class="v2-trainer-main">
        <section class="v2-trainer-panel v2-trainer-progress-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">COLLECTION PROGRESS</span><h3>How far they've come</h3></div><strong>${pct}%</strong></div><div class="v2-trainer-wide-progress"><i style="width:${pct}%"></i></div><div class="v2-trainer-progress-grid">${genRows||'<div class="v2-trainer-empty">Generation progress unavailable.</div>'}</div></section>
        <section class="v2-trainer-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">FEATURED</span><h3>Featured badges</h3></div></div><div class="v2-trainer-badges">${featured.map(b=>`<div class="v2-trainer-badge"><img loading="lazy" decoding="async" src="${escHtml(b.asset)}" alt="${escHtml(b.name)}"><b>${escHtml(b.name)}</b></div>`).join('')||'<div class="v2-trainer-empty">No featured badges selected.</div>'}</div></section>
        <section class="v2-trainer-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">TYPE COLLECTION</span><h3>Strongest types</h3></div></div><div class="v2-trainer-type-list">${typeRows||'<div class="v2-trainer-empty">No type progress yet.</div>'}</div></section>
      </div><aside class="v2-trainer-side">
        <section class="v2-trainer-panel v2-trainer-favorite-panel"><span class="eyebrow">FAVOURITE POKÉMON</span><h3>${fav?escHtml(fav.name):'No favourite selected'}</h3>${favoriteArt?`<div class="v2-trainer-favorite-wrap">${favoriteArt}</div>`:'<p>This Trainer has not selected a favourite Pokémon.</p>'}</section>
        <section class="v2-trainer-panel"><div class="v2-trainer-panel-head"><div><span class="eyebrow">TEAM</span><h3>Current squad</h3></div></div><div class="v2-trainer-team">${teamCards}</div></section>
        <section class="v2-trainer-panel v2-trainer-quick-stats"><span class="eyebrow">TRAINER RECORD</span><div><b>${Number(stats.favoriteCount||0)}</b><small>Favorites</small></div><div><b>${Number(stats.fullBoxes||0)}</b><small>Full boxes</small></div><div><b>${Number(stats.training?.totalQuestions||0)}</b><small>Training questions</small></div><div><b>${Number(stats.training?.accuracy||0)}%</b><small>Training accuracy</small></div></section>
      </aside></div></div>`;
  }
  window.buildV2TrainerCardMarkup=buildV2TrainerCardMarkup;

  function v2DailySnapshot(){
    try{ window.touchDailyCompletion?.(); }catch{}
    const d=trainingStats?.__daily||{};
    return {streak:Number(d.streak||0),bestStreak:Number(d.bestStreak||0),totalCompleted:Number(d.totalCompleted||0),lastCompleted:String(d.lastCompleted||'')};
  }
  function v2ActivityText(a){
    const name=a?.name||a?.entryName||'';
    const source=a?.sourceName||'';
    switch(a?.type){
      case 'caught': return name?`Caught ${name}`:'Caught a Pokémon';
      case 'uncaught': return name?`Removed ${name} from the collection`:'Removed a Pokémon from the collection';
      case 'favorite': return name?`Added ${name} to favorites`:'Added a favorite';
      case 'unfavorite': return name?`Removed ${name} from favorites`:'Removed a favorite';
      case 'evolved': return source&&name?`${source} evolved into ${name}`:name?`Evolved into ${name}`:'Completed an evolution';
      case 'traded': return source&&name?`Traded ${source} for ${name}`:name?`Traded for ${name}`:'Completed a trade';
      case 'daily_complete': return name?`Completed Catch Calendar with ${name}`:'Completed today’s Catch Calendar';
      case 'daily_duplicate': return name?`Logged duplicate Catch Calendar catch: ${name}`:'Logged a duplicate Catch Calendar catch';
      case 'daily_uncomplete': return name?`Catch Calendar completion removed for ${name}`:'Catch Calendar completion removed';
      case 'training_complete': return `Training complete · ${Number(a.score||0)}/${Number(a.total||10)}`;
      case 'daily_xp': return a.text||'Completed today’s Catch Calendar mission · +100 XP';
      case 'perfect_month': return a.month?`Completed a perfect Catch Calendar month · ${a.month}`:'Completed a perfect Catch Calendar month';
      default: return a?.text||a?.message||a?.type||'Trainer activity';
    }
  }
  function v2XpSnapshot(){
    const caught=v2CaughtCount();
    const trainingQ=Number(trainingStats?.__timedQuestions||0);
    const sessions=Number(trainingStats?.__trainingSessions||0);
    const daily=v2DailySnapshot();
    const streak=daily.streak;
    const bonus=Number(trainingStats?.xp||0);
    const xp=Math.max(0,caught*10+trainingQ*3+sessions*10+streak*8+bonus);
    const level=Math.floor(xp/100)+1;
    return {xp,level,intoLevel:xp%100,pct:xp%100};
  }
  function v2AwardDailyXp(){
    const d=window.__dailyDexEntry?.(); if(!d||!state[d.id])return false;
    const key='cobblemon-v2-daily-xp-'+new Date().toISOString().slice(0,10);
    if(localStorage.getItem(key)==='1')return false;
    trainingStats.xp=Number(trainingStats.xp||0)+100;
    localStorage.setItem(key,'1'); saveTraining();
    recordActivity('daily_xp',{text:`Completed today's Catch Calendar mission · +100 XP`,date:new Date().toLocaleDateString()});
    return true;
  }
  function v2ActivityRows(limit=30){
    const list=typeof activityLog==='function'?activityLog():[];
    return list.slice().sort((a,b)=>Number(b.ts||0)-Number(a.ts||0)).slice(0,limit);
  }
  function renderV2Rewards(){
    const s=collectionStats(), ms=milestoneDefinitions({...s,generations:v2GenerationStats(),types:[]}), unlocked=ms.filter(m=>m.unlocked), locked=ms.filter(m=>!m.unlocked);
    const xp=v2XpSnapshot(), daily=v2DailySnapshot();
    const cards=ms.map(m=>`<article class="v2-reward-card ${m.unlocked?'unlocked':'locked'}"><div class="v2-reward-art"><img loading="lazy" decoding="async" src="${escHtml(m.asset)}" alt="${escHtml(m.name)}"></div><div><b>${escHtml(m.name)}</b><p>${escHtml(m.desc)}</p></div><span>${m.unlocked?'EARNED':'LOCKED'}</span></article>`).join('');
    $('#view').innerHTML=`<div class="page-card v2-rich-page v2-rewards-page"><div class="page-title"><div><div class="eyebrow">TRAINER REWARDS</div><h2>Rewards</h2><p>Milestones you have earned — and the next rewards waiting for you.</p></div><div class="v2-level-pill">LV ${xp.level}<span>${xp.xp.toLocaleString()} XP</span></div></div><div class="v2-reward-summary"><article><strong>${unlocked.length}</strong><span>Rewards earned</span></article><article><strong>${locked.length}</strong><span>Still locked</span></article><article><strong>🔥 ${daily.streak}</strong><span>Current streak</span></article><article><strong>${s.caught}</strong><span>Pokémon collected</span></article></div><div class="v2-reward-list">${cards}</div></div>`;
  }
  function renderV2Stats(){
    const caught=v2CaughtCount(), total=v2MainCount(), pct=v2Pct(caught,total), xp=v2XpSnapshot(), daily=v2DailySnapshot();
    const fav=Object.keys(favorites||{}).filter(k=>favorites[k]).length;
    const teamCount=Array.isArray(team)?team.length:0;
    const q=Number(trainingStats?.__timedQuestions||0), correct=Object.keys(trainingStats||{}).filter(k=>!k.startsWith('__')&&trainingStats[k]&&typeof trainingStats[k]==='object').reduce((n,k)=>n+Number(trainingStats[k].correct||0),0);
    const sessions=Number(trainingStats?.__trainingSessions||0);
    const forms=entries.filter(e=>!!state[e.id]&&e.form).length;
    const rows=[['Current collection',caught.toLocaleString(),`${pct}% of main LivingDex`],['Favorites',fav,`${fav?'Curated':'Start building'} collection`],['Team',teamCount,'6 slots maximum'],['Forms collected',forms,'Tracked from your current collection'],['Training questions',q.toLocaleString(),`${sessions} sessions`],['Training correct',correct.toLocaleString(),q?`${Math.round(correct/q*100)}% accuracy`:'No answers yet'],['Daily streak',daily.streak,`Best ${daily.bestStreak}`],['Trainer XP',xp.xp.toLocaleString(),`Level ${xp.level}`]];
    $('#view').innerHTML=`<div class="page-card v2-rich-page"><div class="page-title"><div><div class="eyebrow">TRAINER ANALYTICS</div><h2>Statistics</h2><p>A clean snapshot of your collection and Trainer journey.</p></div><div class="v2-level-pill">LV ${xp.level}<span>${xp.intoLevel}/100 XP</span></div></div><div class="v2-stats-grid">${rows.map(r=>`<article><span>${escHtml(r[0])}</span><strong>${escHtml(String(r[1]))}</strong><small>${escHtml(r[2])}</small></article>`).join('')}</div><div class="v2-progress-panel"><div><span class="eyebrow">LIVINGDEX COMPLETION</span><strong>${pct}%</strong></div><div class="v2-wide-progress"><i style="width:${pct}%"></i></div><div class="v2-stat-foot"><span>${caught.toLocaleString()} currently collected</span><span>${total.toLocaleString()} total</span></div></div></div>`;
  }
  function renderV2Goals(){
    const caught=v2CaughtCount(), total=v2MainCount(), pct=v2Pct(caught,total), d=window.__dailyDexEntry?.();
    const daily=v2DailySnapshot(), streak=daily.streak, q=Number(trainingStats?.__timedQuestions||0), xp=v2XpSnapshot();
    const goals=[
      ['Complete today’s Catch Calendar',d&&state[d.id]?1:0,1,d?.name||'Daily mission'],
      ['Reach the next Trainer Level',xp.intoLevel,100,`${100-xp.intoLevel} XP remaining`],
      ['Build your LivingDex',caught,total,`${pct}% complete`],
      ['Build a 7-day streak',Math.min(streak,7),7,`${Math.max(0,7-streak)} days remaining`],
      ['Answer 100 training questions',Math.min(q,100),100,`${Math.max(0,100-q)} questions remaining`]
    ];
    $('#view').innerHTML=`<div class="page-card v2-rich-page"><div class="page-title"><div><div class="eyebrow">TRAINER OBJECTIVES</div><h2>Goals</h2><p>Small goals keep your collection moving without turning the app into a grind.</p></div></div><div class="v2-goal-list">${goals.map(g=>{const p=v2Pct(g[1],g[2]);return `<article class="v2-goal"><div class="v2-goal-top"><div><b>${escHtml(g[0])}</b><small>${escHtml(String(g[3]))}</small></div><strong>${Math.min(g[1],g[2])}/${g[2]}</strong></div><div class="v2-wide-progress"><i style="width:${p}%"></i></div></article>`}).join('')}</div></div>`;
  }
  function v2FeedIcon(a){return a?.type==='caught'?'✦':a?.type==='evolved'?'↗':a?.type==='traded'?'⇄':a?.type==='training_complete'?'⚔':a?.type?.startsWith('daily')?'★':'•';}
  function v2FeedWhen(a){return a?.ts?new Date(Number(a.ts)).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):(a?.date||'');}

  let v2FeedFilter='all';
  let v2CommunityPostsCache=[];
  function v2CommunityPostKindLabel(k){return ({looking_for:'LOOKING FOR',trade_offer:'LOOKING FOR',discussion:'TRAINER POST',trainer_post:'TRAINER POST'})[k]||'TRAINER POST';}
  function v2CommunityPokemonNames(list){return (Array.isArray(list)?list:[]).map(x=>typeof x==='string'?x:(x?.name||'')).filter(Boolean);}
  function v2CommunityPokemonCards(list,empty='No Pokémon selected'){
    const names=v2CommunityPokemonNames(list); if(!names.length)return `<span class="v2-community-none">${empty}</span>`;
    const limited=names.slice(0,5); return `<div class="v2-community-mon-grid" data-count="${limited.length}">${limited.map(name=>{const e=entries.find(x=>String(x.name).toLowerCase()===String(name).toLowerCase()||String(x.id)===String(name));const qty=e?Number(state[e.id]||0):0;return `<div class="v2-community-mon"><div class="v2-community-mon-art">${e?`<img loading="lazy" src="${escHtml(spritePath(e))}" alt="${escHtml(e.name)}">`:'?'}</div><b>${escHtml(e?.name||name)}</b>${qty>1?`<small>×${qty}</small>`:''}</div>`;}).join('')}</div>`;
  }
  function v2CommunityPostComposer(){
    if(!window.isOnlineTrainerV17?.()){alert('Sign in to create a community post.');return;}
    const wrap=document.createElement('div');wrap.id='v2CommunityComposer';wrap.className='v2-community-modal-wrap';
    wrap.innerHTML=`<div class="v2-community-modal"><button class="info-close" data-close>×</button><div class="eyebrow">TRAINER COMMUNITY</div><h2>Create a post</h2><p>Share something with the Trainer community.</p><label>Post type<select id="communityKind"><option value="trainer_post">📣 Trainer Post</option><option value="looking_for">🔍 Looking For</option></select></label><label>Title<input id="communityTitle" maxlength="100" placeholder="Give your post a title…"></label><label>Message<textarea id="communityBody" maxlength="1000" rows="4" placeholder="What do you want other Trainers to know?"></textarea></label><div id="communityPokemonFields"></div><div class="v2-community-modal-actions"><button class="secondary" data-close>Cancel</button><button class="primary" id="communityPublish">Publish Post</button></div></div>`;
    document.body.appendChild(wrap);wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close]'))wrap.remove();});
    const fields=wrap.querySelector('#communityPokemonFields'); let wanted=[],offered=[];
    const ownedEntries=()=>entries.filter(e=>Number(state[e.id]||0)>0);
    const picker=(id,label,arr,kind)=>`<div class="v2-community-picker"><b>${label}</b><div class="v2-community-picker-row"><input id="${id}" placeholder="Search Pokémon…" autocomplete="off"><button type="button" data-add-community="${kind}">Add</button></div><div class="v2-community-selected" data-selected="${kind}"></div><div class="v2-community-suggestions" data-suggestions="${kind}"></div></div>`;
    function defaults(kind){
      const title=wrap.querySelector('#communityTitle'),body=wrap.querySelector('#communityBody');
      if(kind==='looking_for'){title.value=title.value||'Looking for Pokémon';body.value=body.value||'I am looking for the following Pokémon.';}
      else {title.value=title.value||'Trainer Post';body.value=body.value||'Share something with the community.';}
    }
    function drawFields(){const kind=wrap.querySelector('#communityKind').value;defaults(kind);fields.innerHTML=kind==='looking_for'?picker('communityWanted','🔍 Looking for',wanted,'wanted'):'';if(kind==='looking_for')bindPicker();}
    function bindPicker(){const kind='wanted',input=wrap.querySelector('#communityWanted'),suggestions=wrap.querySelector('[data-suggestions="wanted"]');if(!input)return;const draw=()=>{const q=norm(input.value);const hits=entries.filter(e=>!q||norm(e.name).includes(q)).slice(0,8);suggestions.innerHTML=hits.map(e=>`<button type="button" data-pick-community="${escHtml(e.name)}"><img src="${escHtml(spritePath(e))}" alt="">${escHtml(e.name)}</button>`).join('');};input.oninput=draw;draw();suggestions.onclick=e=>{const b=e.target.closest('[data-pick-community]');if(!b)return;if(!wanted.includes(b.dataset.pickCommunity)&&wanted.length<5)wanted.push(b.dataset.pickCommunity);input.value='';draw();drawSelected();};drawSelected();}
    function drawSelected(){const el=wrap.querySelector('[data-selected="wanted"]');if(!el)return;el.innerHTML=wanted.map(n=>`<button type="button" data-remove-community="${escHtml(n)}">${escHtml(n)} ×</button>`).join('');el.onclick=e=>{const b=e.target.closest('[data-remove-community]');if(!b)return;const i=wanted.indexOf(b.dataset.removeCommunity);if(i>=0)wanted.splice(i,1);drawSelected();};}
    wrap.querySelector('#communityKind').onchange=()=>{wanted=[];offered=[];drawFields();};drawFields();
    wrap.querySelector('#communityPublish').onclick=async()=>{const btn=wrap.querySelector('#communityPublish');btn.disabled=true;const kind=wrap.querySelector('#communityKind').value;const r=await window.createCommunityPostV18?.({kind,title:wrap.querySelector('#communityTitle').value,body:wrap.querySelector('#communityBody').value,wanted_pokemon:wanted,offered_pokemon:[]});if(!r?.ok){alert(r?.error||'Post could not be published.');btn.disabled=false;return;}wrap.remove();v2FeedRowsCache=null;v2RenderFeed();};
  }
  async function v2LoadCommunityPosts(){const rows=await window.getCommunityPostsV18?.()||[];v2CommunityPostsCache=Array.isArray(rows)?rows:[];return v2CommunityPostsCache;}
  function v2FeedFilterMatch(a){if(v2FeedFilter==='all')return true;if(a.__community){if(v2FeedFilter==='looking_for')return a.kind==='looking_for'||a.kind==='trade_offer';if(v2FeedFilter==='trainer_post')return a.kind==='trainer_post'||a.kind==='discussion';return false;}return v2FeedFilter==='activity';}
  function v2CommunityPostMarkup(a,comments,reactions){
    const reactionData=reactions.get(a.activity_id)||{counts:{},mine:''};
    const kind=a.kind; const title=a.title||v2CommunityPostKindLabel(kind); const wanted=a.wanted_pokemon||[], offered=a.offered_pokemon||[];
    const tradeButton=(kind==='looking_for'||kind==='trade_offer')&&a.trainerId!==window.getCurrentTrainerIdV17?.()?`<button type="button" class="v2-community-help" data-community-help="${escHtml(a.id)}">🤝 I can help / Make an offer</button>`:'';
    const deleteButton=a.trainerId===window.getCurrentTrainerIdV17?.()?`<button type="button" class="v2-community-delete" data-community-delete="${escHtml(a.id)}">Delete post</button>`:'';
    const content=kind==='trade_offer'?`<div class="v2-community-trade-grid"><section><span>LOOKING FOR</span>${v2CommunityPokemonCards(wanted,'Anything')}</section><section><span>OFFERING</span>${v2CommunityPokemonCards(offered,'Open to offers')}</section></div>`:kind==='looking_for'?`<section class="v2-community-looking"><span>LOOKING FOR</span>${v2CommunityPokemonCards(wanted,'Tell the community what you need.')}</section>`:'';
    return `<article class="v2-feed-post v2-social-post v2-community-post"><div class="v2-feed-post-top"><div class="v2-feed-author"><div class="v2-feed-avatar">${escHtml(String(a.trainerName||'T').slice(0,1).toUpperCase())}</div><div><b>${escHtml(a.trainerName||'Trainer')}</b><small>${escHtml(v2FeedWhen(a))}</small></div></div><span class="v2-feed-action-pill">${v2CommunityPostKindLabel(kind)}</span></div><div class="v2-community-copy"><h3>${escHtml(title)}</h3><p>${escHtml(a.body||'')}</p>${content}${tradeButton}${deleteButton}</div><div class="v2-feed-social-bar">${v2ReactionMarkup({id:a.activity_id},reactionData)}<span class="v2-feed-comment-count">${comments.length} comments</span></div>${v2CommentMarkup({id:a.activity_id},comments)}</article>`;
  }
  function v2CommunityFilters(){return `<div class="v2-community-toolbar"><button class="v2-community-create primary" id="v2CreateCommunityPost">＋ Create Post</button><div class="v2-community-filters"><button data-feed-filter="all" class="${v2FeedFilter==='all'?'active':''}">All</button><button data-feed-filter="looking_for" class="${v2FeedFilter==='looking_for'?'active':''}">🔍 Looking For</button><button data-feed-filter="trainer_post" class="${v2FeedFilter==='trainer_post'?'active':''}">📣 Posts</button><button data-feed-filter="activity" class="${v2FeedFilter==='activity'?'active':''}">⚡ Activity</button></div></div>`;}
  function v2FeedEntry(a){
    const id=a?.entryId||'';
    let e=entries.find(x=>String(x.id)===String(id));
    if(!e && a?.name)e=entries.find(x=>String(x.name).toLowerCase()===String(a.name).toLowerCase());
    if(!e && a?.entryName)e=entries.find(x=>String(x.name).toLowerCase()===String(a.entryName).toLowerCase());
    return e||null;
  }
  function v2FeedMedia(a){
    const e=v2FeedEntry(a);
    if(!e)return '';
    return `<div class="v2-feed-pokemon-media"><div class="v2-feed-pokemon-glow"></div><img loading="lazy" decoding="async" src="${escHtml(spritePath(e))}" alt="${escHtml(e.name)}"><span>#${escHtml(String(e.num||e.id||''))}</span></div>`;
  }
  function v2TradeMarkup(a){
    const from=v2FeedEntry({entryId:a.sourceEntryId,name:a.sourceName}),to=v2FeedEntry({entryId:a.entryId,name:a.name});
    const leftName=a.trainerName||'Trainer',rightName=a.tradePartnerName||'Unknown Trainer';
    return `<div class="v2-linked-trade"><div class="v2-linked-trainer"><span>${escHtml(leftName)}</span>${from?`<img loading="lazy" decoding="async" src="${escHtml(spritePath(from))}" alt="${escHtml(from.name)}">`:''}<b>${escHtml(from?.name||a.sourceName||'Pokémon')}</b></div><div class="v2-linked-arrow">⇄</div><div class="v2-linked-trainer"><span>${escHtml(rightName)}</span>${to?`<img loading="lazy" decoding="async" src="${escHtml(spritePath(to))}" alt="${escHtml(to.name)}">`:''}<b>${escHtml(to?.name||a.name||'Pokémon')}</b></div></div>`;
  }
  function v2FeedMeta(a){
    const e=v2FeedEntry(a);
    const type=e?.types?.[0]||'';
    return `${e?`<span class="v2-feed-pokemon-name">${escHtml(e.name)}</span>`:''}${type?`<span class="v2-feed-type-chip" style="${typeStyle(type)}">${escHtml(typeLabel(type))}</span>`:''}`;
  }
  function v2ReactionMarkup(a, reactionData){
    const counts=reactionData?.counts||{}; const mine=reactionData?.mine||'';
    const reactions=[['❤️','love'],['🔥','fire'],['👏','clap'],['😂','laugh'],['💯','hundred']];
    return `<div class="v2-feed-reactions" data-reactions-for="${escHtml(a.id||'')}">${reactions.map(([emoji,key])=>`<button type="button" class="v2-reaction-btn ${mine===key?'active':''}" data-reaction="${key}" data-activity-id="${escHtml(a.id||'')}"><span>${emoji}</span><b>${Number(counts[key]||0)||''}</b></button>`).join('')}</div>`;
  }
  function v2CommentMarkup(a, comments=[]){
    const safe=Array.isArray(comments)?comments:[];
    return `<div class="v2-feed-comments" data-comments-for="${escHtml(a.id||'')}"><div class="v2-comments-list">${safe.map(c=>`<div class="v2-comment"><div class="v2-comment-avatar">${escHtml(String(c.display_name||'T').slice(0,1).toUpperCase())}</div><div><b>${escHtml(c.display_name||'Trainer')}</b><span>${escHtml(c.body||'')}</span></div><small>${escHtml(c.created_at?new Date(c.created_at).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'')}</small></div>`).join('')||'<div class="v2-comments-empty">Be the first to say something.</div>'}</div><form class="v2-comment-form" data-comment-form="${escHtml(a.id||'')}"><input maxlength="280" placeholder="Write a comment…" aria-label="Write a comment"><button type="submit">Post</button></form></div>`;
  }
  let v2FeedSocialCache={key:'',comments:[],reactions:new Map(),at:0};
  async function v2LoadFeedSocial(activityIds=[]){
    const ids=[...activityIds].filter(Boolean), key=ids.join('|'), now=Date.now();
    if(v2FeedSocialCache.key===key && now-v2FeedSocialCache.at<15000)return {comments:v2FeedSocialCache.comments,reactions:v2FeedSocialCache.reactions};
    const [comments,reactions]=await Promise.all([
      typeof window.getFeedCommentsV17==='function'?window.getFeedCommentsV17(ids):Promise.resolve([]),
      typeof window.getFeedReactionsV17==='function'?window.getFeedReactionsV17(ids):Promise.resolve(new Map())
    ]);
    v2FeedSocialCache={key,comments:comments||[],reactions:reactions||new Map(),at:Date.now()};
    return v2FeedSocialCache;
  }
  async function v2LoadFeedComments(activityIds){return (await v2LoadFeedSocial(activityIds)).comments;}
  async function v2LoadFeedReactions(activityIds){return (await v2LoadFeedSocial(activityIds)).reactions;}
  function v2AttachFeedInteractions(root){
    root?.querySelectorAll('[data-comment-form]').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();const input=form.querySelector('input'),body=(input?.value||'').trim(),activityId=form.dataset.commentForm;if(!body||!activityId)return;if(!window.isOnlineTrainerV17?.()){alert('Sign in to comment on the Feed.');return;}const btn=form.querySelector('button');if(btn)btn.disabled=true;try{const ok=await window.postFeedCommentV17?.(activityId,body);if(!ok){alert('Could not post the comment.');return;}input.value='';const feedScroll=document.querySelector('.v2-feed-list')?.scrollTop||0;const pageScroll=window.scrollY||window.pageYOffset||0;v2FeedSocialCache.at=0;v2FeedRowsCache=null;await v2RenderFeed({silent:true});requestAnimationFrame(()=>{const next=document.querySelector('.v2-feed-list');if(next)next.scrollTop=feedScroll;window.scrollTo(0,pageScroll);requestAnimationFrame(()=>{const n=document.querySelector('.v2-feed-list');if(n)n.scrollTop=feedScroll;window.scrollTo(0,pageScroll);});});}finally{if(btn)btn.disabled=false;}}));
    root?.querySelectorAll('[data-community-delete]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.communityDelete;if(!id||!confirm('Delete this post?'))return;btn.disabled=true;const r=await window.deleteCommunityPostV18?.(id);if(!r?.ok){alert(r?.error||'Could not delete the post.');btn.disabled=false;return;}v2FeedRowsCache=null;await v2RenderFeed({silent:true});}));    root?.querySelectorAll('[data-delete-activity]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.deleteActivity;if(!id||!confirm('Delete this Feed post?'))return;btn.disabled=true;const r=await window.deleteFeedActivityV17?.(id);if(!r?.ok){alert(r?.error||'Could not delete the post.');btn.disabled=false;return;}v2FeedRowsCache=null;v2FeedRowsCacheAt=0;v2FeedSocialCache.at=0;await v2RenderFeed({silent:true});}));
    root?.querySelectorAll('[data-reaction]').forEach(btn=>btn.addEventListener('click',async()=>{const activityId=btn.dataset.activityId,reaction=btn.dataset.reaction;if(!activityId)return;if(!window.isOnlineTrainerV17?.()){alert('Sign in to react on the Feed.');return;}btn.disabled=true;try{const ok=await window.toggleFeedReactionV17?.(activityId,reaction);if(!ok){const detail=window.getLastFeedReactionErrorV17?.()||'Onbekende databasefout.';alert(`Deze reactie kon niet worden opgeslagen.\n\n${detail}\n\nControleer of de Social Feed migration in Supabase is uitgevoerd.`);return;}v2FeedSocialCache.at=0;v2FeedRowsCache=null;await v2RenderFeed();}finally{btn.disabled=false;}}));
  }
  let v2FeedRowsCache=null,v2FeedRowsCacheAt=0;
  async function v2RenderFeed(opts={}){
    document.body.dataset.v2FeedMode='global';
    try{await window.syncTrainerTradeStateV28?.();}catch{}
    const now=Date.now();
    let posts;
    if(v2FeedRowsCache&&now-v2FeedRowsCacheAt<10000){ posts=v2FeedRowsCache.posts; }
    else { const [_,loadedPosts]=await Promise.all([v2LoadGlobalActivity(),v2LoadCommunityPosts()]); posts=loadedPosts; v2FeedRowsCache={posts}; v2FeedRowsCacheAt=now; }
    if(!posts) posts=[];
    if(v2FeedRowsCache && !v2FeedRowsCache.global) v2FeedRowsCache.global=v2GlobalActivityRows();
    const rawActivityRows=(v2FeedRowsCache?.global||v2GlobalActivityRows()).map(a=>({...a,__community:false,activity_id:a.id}));
    const seenLinkedTrades=new Set(); const activityRows=rawActivityRows.filter(a=>{if(a.type!=='traded'||!a.linkedTradeId)return true;const k=String(a.linkedTradeId);if(seenLinkedTrades.has(k))return false;seenLinkedTrades.add(k);return true;});
    const postRows=posts.map(a=>({...a,__community:true}));
    let rows=[...activityRows,...postRows].filter(v2FeedFilterMatch).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0)).slice(0,80);
    const ids=rows.map(a=>a.activity_id||a.id).filter(Boolean);
    const comments=await v2LoadFeedComments(ids); const reactions=await v2LoadFeedReactions(ids);
    const byId=new Map();comments.forEach(c=>{const id=c.activity_id;if(!byId.has(id))byId.set(id,[]);byId.get(id).push(c);});
    const html=rows.length?rows.map(a=>{
      const id=a.activity_id||a.id, cs=byId.get(id)||[];
      if(a.__community)return v2CommunityPostMarkup(a,cs,reactions);
      const text=v2GlobalActivityText(a), e=v2FeedEntry(a), media=v2FeedMedia(a), reactionData=reactions.get(id)||{counts:{},mine:''};
      const actionLabel=a.type==='caught'?'CAUGHT':a.type==='evolved'?'EVOLVED':a.type==='traded'?'TRADE':a.type==='training_complete'?'TRAINING':a.type?.startsWith('daily')?'DAILY':'TRAINER UPDATE';
      const ownActivity=a.activityUserId===window.getCurrentTrainerIdV17?.();
      const deleteActivity=ownActivity?`<button type="button" class="v2-feed-delete" data-delete-activity="${escHtml(id)}" title="Delete post">Delete</button>`:'';
      return `<article class="v2-feed-post v2-social-post"><div class="v2-feed-post-top"><div class="v2-feed-author"><div class="v2-feed-avatar">${escHtml(String(a.trainerName||'Trainer').slice(0,1).toUpperCase())}</div><div><b>${a.type==='traded'?escHtml(a.trainerName||'Trainer')+' & '+escHtml(a.tradePartnerName||'Unknown Trainer'):escHtml(a.trainerName||'Trainer')}</b><small>${escHtml(v2FeedWhen(a))}</small></div></div><div class="v2-feed-post-head-actions"><span class="v2-feed-action-pill">${actionLabel}</span>${deleteActivity}</div></div><div class="v2-feed-copy"><strong>${a.type==='traded'?escHtml((a.trainerName||'Trainer')+' and '+(a.tradePartnerName||'Unknown Trainer')+' just had a trade.'):escHtml(text)}</strong>${a.type==='traded'?v2TradeMarkup(a):e?`<div class="v2-feed-pokemon-meta">${v2FeedMeta(a)}</div>`:''}</div>${a.type==='traded'?'':media}<div class="v2-feed-social-bar">${v2ReactionMarkup({id},reactionData)}<span class="v2-feed-comment-count">${cs.length} comments</span></div>${id?v2CommentMarkup({id},cs):''}</article>`;
    }).join(''):`<div class="v2-empty-feed"><strong>No posts here yet.</strong><span>Be the first Trainer to start the conversation.</span></div>`;
    $('#view').innerHTML=`<div class="page-card v2-rich-page v2-feed-page"><div class="v2-feed-hero"><div><div class="eyebrow">TRAINER COMMUNITY</div><h2>Feed</h2><p>Trade, find Pokémon, share discoveries and connect with other Trainers.</p></div><div class="v2-feed-hero-mark">✦<span>LIVE COMMUNITY</span></div></div>${v2CommunityFilters()}<div class="v2-feed-list">${html}</div></div>`;
    $('#v2CreateCommunityPost')?.addEventListener('click',v2CommunityPostComposer);
    $$('[data-feed-filter]').forEach(b=>b.onclick=()=>{v2FeedFilter=b.dataset.feedFilter;v2RenderFeed();});
    v2AttachFeedInteractions(document.querySelector('#view'));
    document.querySelectorAll('[data-community-help]').forEach(b=>b.onclick=()=>v2OpenTradeRequest(b.dataset.communityHelp));
    v2StartFeedLive();
  }
  async function v2OpenTradeRequest(postId){
    if(!window.isOnlineTrainerV17?.()){alert('Sign in to contact this Trainer.');return;}
    const post=v2CommunityPostsCache.find(p=>String(p.id)===String(postId)); if(!post)return;
    const wrap=document.createElement('div');wrap.className='v2-community-modal-wrap';wrap.innerHTML=`<div class="v2-community-modal"><button class="info-close" data-close>×</button><div class="eyebrow">TRADE REQUEST</div><h2>Contact ${escHtml(post.trainerName)}</h2><p>${escHtml(post.title||'Trade request')}</p>${post.wanted_pokemon?.length?`<div class="v2-community-trade-preview"><span>THEY ARE LOOKING FOR</span>${v2CommunityPokemonCards(post.wanted_pokemon,'No Pokémon specified')}</div>`:''}<div class="v2-community-picker"><b>🤝 What can you offer?</b><input id="tradeOfferSearch" placeholder="Search your Pokémon…" autocomplete="off"><div class="v2-community-selected" id="tradeOfferSelected"></div><div class="v2-community-suggestions" id="tradeOfferSuggestions"></div></div><label>Message<textarea id="tradeMessage" maxlength="500" rows="4" placeholder="Tell them what you can offer…"></textarea></label><div class="v2-community-modal-actions"><button class="secondary" data-close>Cancel</button><button class="primary" id="sendTradeRequest">Send Request</button></div></div>`;
    document.body.appendChild(wrap);wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close]'))wrap.remove();});
    const owned=entries.filter(e=>Number(state[e.id]||0)>0), offered=[];const input=wrap.querySelector('#tradeOfferSearch'),suggestions=wrap.querySelector('#tradeOfferSuggestions'),selected=wrap.querySelector('#tradeOfferSelected');
    const draw=()=>{const q=norm(input.value);const hits=owned.filter(e=>!q||norm(e.name).includes(q)).slice(0,8);suggestions.innerHTML=hits.map(e=>`<button type="button" data-offer-pick="${escHtml(e.name)}"><img src="${escHtml(spritePath(e))}" alt="">${escHtml(e.name)}<small>×${Number(state[e.id]||1)}</small></button>`).join('');};
    const drawSelected=()=>{selected.innerHTML=offered.map(n=>`<button type="button" data-offer-remove="${escHtml(n)}">${escHtml(n)} ×</button>`).join('');};
    input.oninput=draw;draw();suggestions.onclick=e=>{const b=e.target.closest('[data-offer-pick]');if(!b)return;if(!offered.includes(b.dataset.offerPick)&&offered.length<5)offered.push(b.dataset.offerPick);input.value='';draw();drawSelected();};selected.onclick=e=>{const b=e.target.closest('[data-offer-remove]');if(!b)return;const i=offered.indexOf(b.dataset.offerRemove);if(i>=0)offered.splice(i,1);drawSelected();};
    wrap.querySelector('#sendTradeRequest').onclick=async()=>{const btn=wrap.querySelector('#sendTradeRequest');if(!offered.length){alert('Select at least one Pokémon you actually own.');return;}btn.disabled=true;const r=await window.createTradeRequestV18?.({post_id:post.id,message:wrap.querySelector('#tradeMessage').value,wanted_pokemon:post.wanted_pokemon||[],offered_pokemon:offered});if(!r?.ok){alert(r?.error||'Could not send trade request.');btn.disabled=false;return;}alert('Trade request sent!');wrap.remove();};
  }
  async function v2OpenCommunityNotifications(){
    const [rows,trades]=await Promise.all([window.getCommunityNotificationsV18?.()||[],window.getTrainerTradesV28?.()||[]]);
    const tradeMap=new Map(trades.map(t=>[String(t.id),t]));
    const wrap=document.createElement('div');wrap.className='v2-community-modal-wrap';
    const unread=rows.filter(n=>!n.read).length;
    const tradeCard=n=>{const t=tradeMap.get(String(n.trainer_trade_id||''));if(!t)return '';const from=entries.find(e=>String(e.id)===String(t.from_pokemon)),to=entries.find(e=>String(e.id)===String(t.to_pokemon));return `<div class="v2-trade-notification-card"><div><span>${escHtml(t.from_trainer_name)}</span>${from?`<img src="${escHtml(spritePath(from))}" alt="">`:''}<b>${escHtml(from?.name||t.from_pokemon)}</b></div><i>⇄</i><div><span>${escHtml(t.to_trainer_name)}</span>${to?`<img src="${escHtml(spritePath(to))}" alt="">`:''}<b>${escHtml(to?.name||t.to_pokemon)}</b></div></div>`;};
    wrap.innerHTML=`<div class="v2-community-modal v2-notifications-modal"><button class="info-close" data-close>×</button><div class="eyebrow">COMMUNITY</div><h2>Notifications ${unread?`<span class="v2-notification-count">${unread}</span>`:''}</h2><div class="v2-notification-list">${rows.length?rows.map(n=>{const isTrade=n.type==='trainer_trade_request',isDone=n.type==='trainer_trade_accepted',t=tradeMap.get(String(n.trainer_trade_id||''));return `<article class="v2-notification ${n.read?'read':'unread'}" data-notification="${escHtml(n.id)}"><div class="v2-notification-icon">${isTrade?'⇄':isDone?'✅':n.type==='trade_request'?'🤝':'🔔'}</div><div class="v2-notification-body"><b>${escHtml(n.title)}</b><p>${escHtml(n.body)}</p>${t?tradeCard(n):''}<small>${escHtml(n.created_at?new Date(n.created_at).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'')}</small>${isTrade&&!n.read&&t?`<div class="v2-notification-actions"><button data-linked-trade-action="accept" data-trade-id="${escHtml(t.id)}">Confirm trade</button><button data-linked-trade-action="decline" data-trade-id="${escHtml(t.id)}">Decline</button></div>`:n.type==='trade_request'&&!n.read?`<div class="v2-notification-actions"><button data-trade-action="accepted" data-trade-id="${escHtml(n.trade_request_id||'')}">Accept</button><button data-trade-action="declined" data-trade-id="${escHtml(n.trade_request_id||'')}">Decline</button></div>`:''}</div></article>`;}).join(''):`<div class="v2-empty-feed"><strong>All clear.</strong><span>No community notifications yet.</span></div>`}</div></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',async e=>{
      if(e.target===wrap||e.target.closest('[data-close]')){wrap.remove();return;}
      const n=e.target.closest('[data-notification]');
      const linked=e.target.closest('[data-linked-trade-action]');
      if(linked){const id=linked.dataset.tradeId,action=linked.dataset.linkedTradeAction;linked.disabled=true;const r=action==='accept'?await window.acceptTrainerTradeV28?.(id):await window.respondTrainerTradeV28?.(id,'declined');if(!r?.ok){alert(r?.error||'Could not update the trade.');linked.disabled=false;return;}if(n)await window.markCommunityNotificationReadV18?.(n.dataset.notification);if(action==='accept'){try{await window.LivingDexOnline?.reloadFromCloudV28?.();}catch{}alert('Trade confirmed! Both collections have been updated.');}n?.remove();return;}
      if(n&&!e.target.closest('[data-trade-action]')){await window.markCommunityNotificationReadV18?.(n.dataset.notification);n.classList.remove('unread');n.classList.add('read');}
      const action=e.target.closest('[data-trade-action]');if(action){const r=await window.respondToTradeRequestV18?.(action.dataset.tradeId,action.dataset.tradeAction);if(!r?.ok){alert(r?.error||'Could not update trade request.');return;}await window.markCommunityNotificationReadV18?.(n?.dataset.notification);action.closest('.v2-notification-actions')?.remove();}
    });
  }
  let v2NotificationTimer=null;
  async function v2RefreshNotificationBell(){
    const b=document.querySelector('#notificationBtn');
    const badge=document.querySelector('#notificationBadge');
    if(!b||!badge)return;
    if(!window.LivingDexOnline?.user||!window.getCommunityNotificationsV18){badge.hidden=true;badge.textContent='0';return;}
    try{
      const rows=await window.getCommunityNotificationsV18();
      const n=rows.filter(x=>!x.read).length;
      badge.textContent=n>9?'9+':String(n);
      badge.hidden=n===0;
      b.classList.toggle('has-notifications',n>0);
      b.setAttribute('aria-label',n?`Notifications (${n} unread)`:'Notifications');
    }catch{badge.hidden=true;badge.textContent='0';b.classList.remove('has-notifications');}
  }
  function v2CommunityNotificationBell(){
    const b=document.querySelector('#notificationBtn'); if(!b)return;
    if(!b.dataset.bound){
      b.dataset.bound='1';
      b.addEventListener('click',v2OpenCommunityNotifications);
    }
    v2RefreshNotificationBell();
    if(!v2NotificationTimer){
      v2NotificationTimer=setInterval(()=>{if(document.visibilityState!=='hidden')v2RefreshNotificationBell();},30000);
    }
  }

  function renderV2Activity(){v2RenderFeed();}
  function v2CommandPalette(){
    if($('#v2CommandPalette')){ $('#v2CommandPalette').hidden=false; $('#v2CommandInput')?.focus(); return; }
    const el=document.createElement('div');el.id='v2CommandPalette';el.className='v2-command-overlay';el.innerHTML=`<div class="v2-command"><button class="v2-command-close" id="v2CommandClose">×</button><div class="eyebrow">TRAINER COMMAND</div><h3>What do you want to do?</h3><input id="v2CommandInput" placeholder="Search actions…" autocomplete="off"><div id="v2CommandList"></div><small>Press Esc to close · Ctrl/⌘ K to open</small></div>`;document.body.appendChild(el);
    const actions=[['Open Home','home','⌂'],['Open LivingDex','dex','▦'],['Open Catch Calendar','daily','◷'],['Start Training','training','⚔'],['Open Rewards','achievements','★'],['Open Statistics','stats','◌'],['Open Goals','goals','◎'],['Open Feed','activity','≡'],['Open Team Builder','team','◇'],['Open Type Knowledge','types','◈'],['Open Players','players','◎'],['Open Leaderboard','leaderboard','♛']];
    const draw=()=>{const q=norm($('#v2CommandInput').value);const list=actions.filter(a=>!q||norm(a[0]).includes(q));$('#v2CommandList').innerHTML=list.map(a=>`<button class="v2-command-item" data-cmd="${a[1]}"><span>${a[2]}</span>${a[0]}<kbd>↵</kbd></button>`).join('')||'<div class="v2-empty-feed">No matching action.</div>';$$('.v2-command-item').forEach(b=>b.onclick=()=>{el.hidden=true;v2Navigate(b.dataset.cmd);});};
    $('#v2CommandInput').oninput=draw;$('#v2CommandClose').onclick=()=>el.hidden=true;el.onclick=e=>{if(e.target===el)el.hidden=true};el.addEventListener('keydown',e=>{if(e.key==='Escape')el.hidden=true});draw();$('#v2CommandInput').focus();
  }
  function v2QuickSearch(){v2CommandPalette();}

  function v2GenerationStats(){
    const gens=[];
    for(let g=1;g<=9;g++){ const all=entries.filter(e=>Number(e.generation||0)===g); const caught=all.filter(e=>!!state[e.id]).length; gens.push({g,total:all.length,caught,pct:v2Pct(caught,all.length)}); }
    return gens.filter(x=>x.total);
  }
  function v2Heatmap(){
    const gens=v2GenerationStats();
    return gens.map(x=>`<button class="v2-heat-cell heat-${x.pct<25?'low':x.pct<60?'mid':x.pct<90?'high':'done'}" title="Generation ${x.g}: ${x.caught}/${x.total}"><span>GEN ${x.g}</span><strong>${x.pct}%</strong><small>${x.caught}/${x.total}</small></button>`).join('');
  }
  function v2TypeOverview(){
    const base=pageEntries('main');
    return TYPES.map(type=>{
      const all=base.filter(e=>entryTypes(e).includes(type));
      const caught=all.filter(e=>!!state[e.id]).length;
      const pct=v2Pct(caught,all.length);
      return {type,total:all.length,caught,pct};
    }).filter(x=>x.total).sort((a,b)=>b.pct-a.pct||b.caught-a.caught||a.type.localeCompare(b.type));
  }
  function v2TypeRings(){
    return v2TypeOverview().map(x=>`<button class="v2-type-ring" type="button" title="${escHtml(typeLabel(x.type))}: ${x.caught}/${x.total}" data-type-ring="${escHtml(x.type)}" style="--type-pct:${x.pct}%;--type-color:${TYPE_COLORS[x.type]||'#7da5ff'}"><span class="v2-type-ring-visual"><b>${x.pct}%</b></span><strong>${escHtml(typeLabel(x.type))}</strong><small>${x.caught}/${x.total}</small></button>`).join('');
  }
  function v2GlobalActivityText(a){
    const name=a?.name||a?.entryName||'';
    const trainer=a?.trainerName||'Trainer';
    const action=v2ActivityText(a);
    return `${trainer} · ${action}`;
  }
  function v2GlobalActivityRows(){
    try{return Array.isArray(window.__v2GlobalActivityCache)?window.__v2GlobalActivityCache:[];}catch{return [];}
  }
  async function v2LoadGlobalActivity(){
    if(typeof window.getGlobalActivityV17!=='function') return;
    try{
      const rows=await window.getGlobalActivityV17();
      window.__v2GlobalActivityCache=Array.isArray(rows)?rows:[];
      if(view!=='home') return;
      const el=$('#v2HomeFeed'); if(!el) return;
      if(document.body.dataset.v2FeedMode==='global') v2RenderHomeFeed('global');
    }catch(err){console.warn('Global activity unavailable',err);}
  }
  function v2RenderHomeFeed(mode='personal'){
    const el=$('#v2HomeFeed'); if(!el)return;
    document.body.dataset.v2FeedMode=mode;
    const rows=mode==='global'?v2GlobalActivityRows():((typeof activityLog==='function'?activityLog():[]).filter(a=>a&&a.type).slice().sort((a,b)=>Number(b.ts||0)-Number(a.ts||0)).slice(0,12));
    el.innerHTML=rows.length?rows.map(a=>`<div class="v2-feed-row"><span class="v2-feed-dot"></span><div class="v2-feed-row-main"><b>${escHtml(mode==='global'?v2GlobalActivityText(a):v2ActivityText(a))}</b><small>${escHtml(v2FeedWhen(a))}</small>${mode==='global'&&a.id?`<button class="v2-feed-comment-link" data-home-comment="${escHtml(a.id)}">Comment</button>`:''}</div></div>`).join(''):`<div class="v2-empty-feed">${mode==='global'?'No public player activity yet.':'Your Trainer activity will appear here as you play.'}</div>`;
    $$('#v2FeedPersonal,#v2FeedGlobal').forEach(b=>b.classList.toggle('active',(b.id==='v2FeedPersonal'&&mode==='personal')||(b.id==='v2FeedGlobal'&&mode==='global')));
    el.querySelectorAll('[data-home-comment]').forEach(b=>b.addEventListener('click',()=>v2Navigate('activity')));
  }
  function renderV2Home(){
    $('#dexView').hidden=true; $('#view').hidden=false;
    const caught=v2CaughtCount(), total=v2MainCount(), pct=v2Pct(caught,total);
    const d=window.__dailyDexEntry?.()||null;
    const dailyDone=!!(d && state[d.id]);
    const profile=v2Profile();
    const meta=profileMeta();
    // Home, Statistics and Rewards must use one Trainer progression source.
    const xpSnapshot=v2XpSnapshot();
    const level=xpSnapshot.level, xp=xpSnapshot.xp, xpPct=xpSnapshot.pct;
    const daily=v2DailySnapshot();
    const streak=daily.streak;
    const dailyOwned=!!(d && state[d.id]);
    const dailyDuplicateDone=!!(d && localStorage.getItem('cobblemon-v2-daily-duplicate-'+new Date().toISOString().slice(0,10))==='1');
    const recent=(typeof activityLog==='function'?activityLog():[]).filter(a=>a&&a.type).slice(-6).reverse();
    const activity=recent.length?recent.map(a=>`<div class="v2-feed-row"><span class="v2-feed-dot"></span><div><b>${escHtml(v2ActivityText(a))}</b><small>${escHtml(a.ts?new Date(Number(a.ts)).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):(a.date||''))}</small></div></div>`).join(''):`<div class="v2-empty-feed">Your Trainer activity will appear here as you play.</div>`;
    $('#view').innerHTML=`<div class="v2-home-page">
      <section class="v2-hero">
        <div class="v2-hero-copy"><span class="eyebrow">TRAINER OS • ${escHtml(meta.ign||'COBBLEMON TRAINER')}</span><h2>Welcome back, ${escHtml(profile.name||v2Name())}.</h2><p>Your collection, training and daily journey — all in one place.</p><div class="v2-hero-actions"><button class="primary" id="v2OpenDex">Open LivingDex</button></div></div>
        <div class="v2-hero-orb"><div class="v2-orb-ring"></div><div class="v2-orb-mark">◈</div><span>TRAINER<br>ONLINE</span></div>
      </section>
      <section class="v2-stat-strip">
        <article><span>LivingDex</span><strong>${caught.toLocaleString()} <small>/ ${total.toLocaleString()}</small></strong><i><b style="width:${pct}%"></b></i></article>
        <article><span>Trainer Level</span><strong>Lv ${level}</strong><i><b style="width:${xpPct}%"></b></i></article>
        <article><span>Daily Streak</span><strong>🔥 ${streak}</strong><small>Best ${daily.bestStreak}</small></article>
        <article><span>Today's Pokémon</span><strong>${escHtml(d?.name||'—')}</strong><small>${dailyDone?'✓ Completed today':'Ready to catch'}</small></article>
      </section>
      <section class="v2-home-dashboard">
        <div class="v2-home-left">
          <article class="v2-home-card v2-overview-card">
            <div class="v2-card-head"><div><span class="eyebrow">COLLECTION INTELLIGENCE</span><h3>LivingDex overview</h3></div><button class="v2-text-btn" id="v2HeatmapDex">Open LivingDex</button></div>
            <div class="v2-overview-top"><div class="v2-main-ring" style="--pct:${pct}%"><strong>${pct}%</strong><small>COMPLETE</small></div><div class="v2-overview-copy"><b>${caught.toLocaleString()} / ${total.toLocaleString()} Pokémon</b><p>Your collection at a glance. Generations and type coverage update automatically as you catch.</p><div class="v2-overview-meta"><span>🔥 ${streak} day streak</span><span>Lv ${level}</span><span>${daily.bestStreak} best streak</span></div></div></div>
            <div class="v2-section-label"><span>GENERATION MAP</span><small>Completion by generation</small></div><div class="v2-heatmap">${v2Heatmap()}</div>
          </article>
          <article class="v2-home-card v2-type-card"><div class="v2-card-head"><div><span class="eyebrow">TYPE MAP</span><h3>Collection by type</h3></div><span class="v2-card-kicker">${v2TypeOverview().length} TYPES</span></div><div class="v2-type-ring-grid">${v2TypeRings()}</div></article>
          <div class="v2-home-lower">
            <article class="v2-home-card v2-daily-card"><div class="v2-card-head"><div><span class="eyebrow">TODAY'S MISSION</span><h3>Catch Calendar</h3></div><span class="v2-card-kicker">+ Daily XP</span></div><div class="v2-daily-body">${d?`<img src="${spritePath(d)}" alt="${escHtml(d.name)}"><div><b>${escHtml(d.name)}</b><p>${dailyDone?(dailyDuplicateDone?'Duplicate catch logged. Keep the streak alive.':'Mission complete. Keep the streak alive.'):(dailyOwned?'You already own it. Log a duplicate catch to complete today.':'Catch this Pokémon to complete today’s mission.')}</p><button class="secondary" id="v2DailyView">View Pokémon</button></div>`:`<div class="v2-empty-feed">No daily Pokémon available.</div>`}</div></article>
            <article class="v2-home-card"><div class="v2-card-head"><div><span class="eyebrow">COLLECTION</span><h3>Your journey</h3></div><span class="v2-big-percent">${pct}%</span></div><div class="v2-journey"><div class="v2-ring" style="--pct:${pct}%"><strong>${pct}%</strong></div><div><b>${caught.toLocaleString()} Pokémon collected</b><p>Keep building your LivingDex and unlock Trainer rewards.</p><button class="secondary" id="v2ProgressBtn">Open Progress</button></div></div></article>
          </div>
        </div>
        <aside class="v2-home-activity"><article class="v2-home-card v2-feed-card"><div class="v2-card-head"><div><span class="eyebrow">TRAINER TIMELINE</span><h3>Recent activity</h3></div><button class="v2-text-btn" id="v2ActivityBtn">View all</button></div><div class="v2-feed-preview" id="v2HomeFeed">${activity}</div></article></aside>
      </section>
      <section class="v2-quick-actions"><button class="v2-quick" id="v2QuickSearch">⌕<span>Command Search</span><small>Ctrl K</small></button><button class="v2-quick" id="v2QuickStats">◌<span>Statistics</span></button><button class="v2-quick" id="v2QuickGoals">◎<span>Goals</span></button><button class="v2-quick" id="v2QuickActivity">≡<span>Activity</span></button></section>
    </div>`;
    $('#v2OpenDex')?.addEventListener('click',()=>v2Navigate('dex'));
    $('#v2DailyView')?.addEventListener('click',()=>d&&openInfo(d.id));
    $('#v2ProgressBtn')?.addEventListener('click',()=>v2Navigate('achievements'));
    $('#v2ActivityBtn')?.addEventListener('click',()=>v2Navigate('activity'));
    document.body.dataset.v2FeedMode='global';
    v2LoadGlobalActivity();
    $('#v2HeatmapDex')?.addEventListener('click',()=>v2Navigate('dex'));
    $$('[data-type-ring]').forEach(b=>b.addEventListener('click',()=>{selectedTypes=[b.dataset.typeRing];tab='main';page=1;query='';status='all';v2Navigate('dex');}));
    $('#v2QuickSearch')?.addEventListener('click',v2QuickSearch);
    $('#v2QuickStats')?.addEventListener('click',()=>v2Navigate('stats'));
    $('#v2QuickGoals')?.addEventListener('click',()=>v2Navigate('goals'));
    $('#v2QuickActivity')?.addEventListener('click',()=>v2Navigate('activity'));
  }
  window.renderV2Home=renderV2Home;
  window.v2Navigate=v2Navigate;
  window.v2CurrentView=()=>view;
  window.v2IconNav=v2IconNav;window.v2CurrentView=()=>view;

  window.renderTopNav = function(){
    const items=[['dex','LivingDex'],['daily','Catch Calendar'],['team','Team Builder'],['types','Type Knowledge'],['training','Training'],['achievements','Rewards'],['stats','Statistics'],['goals','Goals'],['activity','Activity']];
    $('#topNav').innerHTML=items.map(([k,n])=>`<button class="top-nav-btn ${view===k?'active':''}" data-view="${k}">${n}</button>`).join('');
    $$('.top-nav-btn').forEach(b=>b.onclick=()=>v2Navigate(b.dataset.view));
    v2IconNav(view);
  };
  window.renderView = function(){
    if(view==='home'){renderV2Home();return;}
    if(view==='dex'){renderDex();return;}
    $('#dexView').hidden=true;$('#view').hidden=false;
    if(view==='team')renderTeam();
    else if(view==='types')renderTypeKnowledge();
    else if(view==='training')renderTraining();
    else if(view==='daily')renderDailyDex();
    else if(view==='achievements')renderV2Rewards();
    else if(view==='stats')renderV2Stats();
    else if(view==='goals')renderV2Goals();
    else if(view==='activity')renderV2Activity();
    else if(view==='players')window.renderPlayers?.();
    else if(view==='leaderboard')window.renderLeaderboard?.();
  };

  function addBackupControls(){
    const menu=$('#settingsMenu'); if(!menu||$('#exportSaveBtn'))return;
    menu.insertAdjacentHTML('beforeend',`<div class="settings-divider"></div><div class="settings-heading">Save data</div><div class="settings-note">Back up your caught Pokémon, favorites, notes, profile and training stats.</div><div class="settings-save-actions"><button id="exportSaveBtn" class="secondary">Export Save</button><button id="importSaveBtn" class="secondary">Import Save</button><input id="importSaveInput" type="file" accept="application/json" hidden></div>`);
    $('#exportSaveBtn').onclick=()=>{const payload={version:V11_VERSION,exportedAt:new Date().toISOString(),state,favorites,notes,team,profile:JSON.parse(localStorage.getItem('cobblemon-livingdex-profile')||'null'),training:trainingStats,theme:localStorage.getItem('livingdex-theme')||'dark'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${greetingName().replace(/[^A-Za-z0-9_-]+/g,'_')}_LivingDex_Save.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};
    $('#importSaveBtn').onclick=()=>$('#importSaveInput').click();
    $('#importSaveInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.state||typeof d.state!=='object')throw new Error('Invalid save');Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,d.state);Object.keys(favorites).forEach(k=>delete favorites[k]);Object.assign(favorites,d.favorites||{});Object.keys(notes).forEach(k=>delete notes[k]);Object.assign(notes,d.notes||{});team.splice(0,team.length,...(d.team||[]));if(d.profile)saveProfile(d.profile);trainingStats=d.training||{};saveAll();saveTraining();alert('Save imported successfully.');location.reload();}catch(err){alert('Could not import this save file.');}};
  }

  // Replace the settings label and add a compact trainer profile summary to Progress.
  const originalApplySettings=window.applySettings;
  window.applySettings=function(){if(originalApplySettings)originalApplySettings();addBackupControls();};

  // Boot V1.1 after the V1.0 app has loaded its data and local state.
  function boot(){
    document.title='Cobblemon LivingDex — V2.0.29';
    // Expose the V1.1/V1.2 views explicitly so the database layer and navigation
    // always call the same implementations.
    window.renderTraining = renderTraining;
    window.renderProgressPlus = renderProgressPlus;
    window.renderProgressV13 = renderProgressPlus;
    window.renderMilestones = renderMilestones;
    window.renderDailyDex = renderDailyDex;
    window.__dailyDexEntry = dailyDexEntry;
    window.recordActivityV17=recordActivity;
    window.getActivitiesForDateV17=activitiesForDate;
    window.getCatchHistoryV17=catchHistory;
    window.getFeaturedBadgesV17=()=>profileMeta().featuredBadges.slice();
    window.setFeaturedBadgesV17=(ids)=>{profileMeta().featuredBadges=[...new Set(ids||[])].slice(0,5);saveTraining();};
    window.getProfileMetaV17=()=>({...profileMeta()});
    window.setProfileMetaV17=(patch={})=>{const m=profileMeta();if(patch.ign!=null)m.ign=String(patch.ign).slice(0,24);if(patch.bio!=null)m.bio=String(patch.bio).slice(0,240);if(patch.banner&&PROFILE_BANNERS[patch.banner])m.banner=patch.banner;saveTraining();};
    window.getProfileBannersV17=()=>({...PROFILE_BANNERS});
    let selectedProfileBanner='aurora';
    window.getSelectedProfileBannerV17=()=>selectedProfileBanner;
    window.renderProfileBannerChoicesV17=(selected='aurora')=>{selectedProfileBanner=PROFILE_BANNERS[selected]?selected:'aurora';const el=document.querySelector('#profileBannerChoices');if(!el)return;el.innerHTML=Object.entries(PROFILE_BANNERS).map(([id,name])=>`<button type="button" class="profile-banner-choice banner-${id} ${selectedProfileBanner===id?'selected':''}" data-banner-choice="${id}"><span></span><b>${name}</b></button>`).join('');el.querySelectorAll('[data-banner-choice]').forEach(b=>b.onclick=()=>{selectedProfileBanner=b.dataset.bannerChoice;el.querySelectorAll('[data-banner-choice]').forEach(x=>x.classList.toggle('selected',x===b));});};
    window.getActivityLogV17=()=>activityLog().slice();
    window.refreshTrainingStateV17=()=>{try{trainingStats=JSON.parse(localStorage.getItem('cobblemon-livingdex-training')||'{}');}catch{trainingStats={};}};
    window.renderTopNav = renderTopNav;
    window.renderView = renderView;
    addBackupControls();
    v2CommunityNotificationBell();
    // Always boot into the LivingDex with the grid rendered immediately.
    // The V1.0 app initializes before this file loads, so explicitly render the
    // default view here as well; this prevents a blank first screen until the
    // LivingDex button is clicked.
    view='home';
    renderTopNav();
    renderView();
    const v2n=document.querySelector('#v2TrainerName'); if(v2n)v2n.textContent=v2Name();
    const v2m=document.querySelector('#v2TrainerMeta'); if(v2m)v2m.textContent=profileMeta().ign ? 'IGN · '+profileMeta().ign : 'Trainer OS';
    // Re-bind navigation with delegation. This prevents an older V1.0 handler
    // from swallowing the new Training/Progress views.
    const homeBtn=document.getElementById('v2HomeReset');
    if(homeBtn)homeBtn.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();v2Navigate('home');};
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && typeof closeFilterModal==='function')closeFilterModal();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();v2CommandPalette();}});
  }
  boot();
})();
