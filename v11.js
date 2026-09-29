/* Cobblemon LivingDex V1.1 - LivingDex Plus */
(() => {
  const V11_VERSION = '1.7.18';
  // App-state bridge: prefer app.js bindings, but safely recover if app.js was interrupted before its bridge initialized.
  const state=window.state ?? JSON.parse(localStorage.getItem('cobblemon-livingdex-state')||'{}');
  const favorites=window.favorites ?? JSON.parse(localStorage.getItem('cobblemon-livingdex-favorites')||'{}');
  const notes=window.notes ?? JSON.parse(localStorage.getItem('cobblemon-livingdex-notes')||'{}');
  const team=window.team ?? JSON.parse(localStorage.getItem('cobblemon-livingdex-team')||'[]');
  const DATA=window.DATA ?? window.EMBEDDED_DATA ?? {main:[],special:[]};
  const entries=window.entries ?? [...(DATA.main||[]),...(DATA.special||[])].flatMap(b=>b.entries||[]);
  if(!window.state) Object.defineProperty(window,'state',{configurable:true,get:()=>state});
  if(!window.favorites) Object.defineProperty(window,'favorites',{configurable:true,get:()=>favorites});
  if(!window.notes) Object.defineProperty(window,'notes',{configurable:true,get:()=>notes});
  if(!window.team) Object.defineProperty(window,'team',{configurable:true,get:()=>team});
  // V11-local sort helper: app.js keeps sortEntry in its own script scope, so V11 must not depend on that lexical binding.
  const sortEntry=(a,b)=>Number(a.dex)-Number(b.dex)||(a.box||999)-(b.box||999)||(a.slot||999)-(b.slot||999);
  // V11-local entry lookup: entryById is lexical inside app.js and is not visible from this script.
  const entryById=id=>entries.find(e=>e?.id===id)||null;
  // V11-local DOM helpers: app.js keeps these in its own script scope.
  const $=s=>document.querySelector(s);
  const queryAll=s=>[...document.querySelectorAll(s)];
  // V11-local profile helper: greetingName is lexical inside app.js and is not visible here.
  const greetingName=()=>JSON.parse(localStorage.getItem('cobblemon-livingdex-profile')||'null')?.trainerName||'Trainer';
// V11-local UI helper: closeInfo is lexical inside app.js and is not visible here.
const closeInfo=()=>{const el=$('#infoDropdown');if(el)el.hidden=true;const overlay=$('#infoOverlay');if(overlay)overlay.hidden=true;document.body.classList.remove('modal-open');};
  const adv = { generation:'all', type:'all', status:'all', special:'all' };
  let trainingSession = null;
  let trainingStats = JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}');
  // v3.5: move the two previously separate Cobblemon Forms entries into the main LivingDex without losing existing progress.
  const V35_FORM_ALIASES = {'burmy|sandy|412|forms':'burmy|sandy|412|main','mime-jr|galarbias|439|forms':'mime-jr|galarbias|439|main'};
  for (const [oldId,newId] of Object.entries(V35_FORM_ALIASES)) {
    if (state[oldId] && !state[newId]) state[newId]=true;
    if (favorites[oldId] && !favorites[newId]) favorites[newId]=true;
    const counts=window.pokemonCounts ||= JSON.parse(localStorage.getItem('cobblemon-livingdex-counts') || '{}');
    if (Number(counts[oldId]||0)>Number(counts[newId]||0)) counts[newId]=Number(counts[oldId]);
    const shinies=trainingStats.__shinies ||= {};
    if (Number(shinies[oldId]||0)>Number(shinies[newId]||0)) shinies[newId]=Number(shinies[oldId]);
  }

  // v3.6.63: special-form tabs were consolidated into the main LivingDex.
  // Preserve existing catches/favorites/counts/shinies while the old IDs disappear.
  const V363_FORM_ALIASES = {
    'zygarde-10|base|718|forms':'zygarde-50|base|718|main',
    'zygarde-50|base|718|forms':'zygarde-50|base|718|main',
    'zygarde-complete|base|718|forms':'zygarde-50|base|718|main',
    'tauros-paldea-combat-breed|base|128|forms':'regional-tauros-paldea-combat|paldea|128',
    'tauros-paldea-blaze-breed|base|128|forms':'regional-tauros-paldea-blaze|paldea|128',
    'tauros-paldea-aqua-breed|base|128|forms':'regional-tauros-paldea-aqua|paldea|128',
    'deerling-autumn|base|585|forms':'deerling|autumn|585|main',
    'deerling-summer|base|585|forms':'deerling|summer|585|main',
    'deerling-winter|base|585|forms':'deerling|winter|585|main',
    'sawsbuck-autumn|base|586|forms':'sawsbuck|autumn|586|main',
    'sawsbuck-summer|base|586|forms':'sawsbuck|summer|586|main',
    'sawsbuck-winter|base|586|forms':'sawsbuck|winter|586|main'
  };
  const V363_PREFIX_ALIASES = [
    ['alcremie-', 'alcremie|base|869|main'],
    ['arceus-', 'arceus|base|493|main'],
    ['silvally-', 'silvally|base|773|main']
  ];
  const migrateFormState = (oldId,newId) => {
    if(oldId===newId)return;
    if(state[oldId]&&!state[newId])state[newId]=state[oldId];
    if(favorites[oldId]&&!favorites[newId])favorites[newId]=favorites[oldId];
    const counts=window.pokemonCounts ||= JSON.parse(localStorage.getItem('cobblemon-livingdex-counts') || '{}');
    if(Number(counts[oldId]||0)>Number(counts[newId]||0))counts[newId]=Number(counts[oldId]);
    const shinies=trainingStats.__shinies ||= {};
    if(Number(shinies[oldId]||0)>Number(shinies[newId]||0))shinies[newId]=Number(shinies[oldId]);
  };
  for(const [oldId,newId] of Object.entries(V363_FORM_ALIASES))migrateFormState(oldId,newId);
  for(const oldId of Object.keys(state)) for(const [prefix,newId] of V363_PREFIX_ALIASES) if(oldId.startsWith(prefix)) migrateFormState(oldId,newId);
  for(const oldId of Object.keys(favorites)) for(const [prefix,newId] of V363_PREFIX_ALIASES) if(oldId.startsWith(prefix)) migrateFormState(oldId,newId);

  // v3.6.65: normalize special-form IDs into the main LivingDex without losing local progress.
  const V365_FORM_ALIASES = {
    'castform-rainy|base|351|forms':'castform-rainy|base|351|main','castform-snowy|base|351|forms':'castform-snowy|base|351|main','castform-sunny|base|351|forms':'castform-sunny|base|351|main',
    'ogerpon-cornerstone|base|1017|forms':'ogerpon-cornerstone|base|1017|main','ogerpon-cornerstone-tera|base|1017|forms':'ogerpon-cornerstone-tera|base|1017|main','ogerpon-hearthflame|base|1017|forms':'ogerpon-hearthflame|base|1017|main','ogerpon-hearthflame-tera|base|1017|forms':'ogerpon-hearthflame-tera|base|1017|main','ogerpon-teal-tera|base|1017|forms':'ogerpon-teal-tera|base|1017|main','ogerpon-wellspring|base|1017|forms':'ogerpon-wellspring|base|1017|main','ogerpon-wellspring-tera|base|1017|forms':'ogerpon-wellspring-tera|base|1017|main',
    'squawkabilly-blue|base|931|forms':'squawkabilly-blue|base|931|main','squawkabilly-white|base|931|forms':'squawkabilly-white|base|931|main','squawkabilly-yellow|base|931|forms':'squawkabilly-yellow|base|931|main',
    'tatsugiri-droopy|base|978|forms':'tatsugiri-droopy|base|978|main','tatsugiri-stretchy|base|978|forms':'tatsugiri-stretchy|base|978|main',
    'pumpkaboo-small|base|710|special':'pumpkaboo-small|base|710|main','pumpkaboo-large|base|710|special':'pumpkaboo-large|base|710|main','pumpkaboo-super|base|710|special':'pumpkaboo-super|base|710|main',
    'gourgeist-small|base|711|special':'gourgeist-small|base|711|main','gourgeist-large|base|711|special':'gourgeist-large|base|711|main','gourgeist-super|base|711|special':'gourgeist-super|base|711|main'
  };
  for(const [oldId,newId] of Object.entries(V365_FORM_ALIASES)) migrateFormState(oldId,newId);


  const PICHU_BIAS_ALIAS={'regional-bias-pichu-alola':'pichu|base|172|main'};
  for(const [oldId,newId] of Object.entries(PICHU_BIAS_ALIAS))migrateFormState(oldId,newId);
  const V368_FORM_ALIASES={'minior-red-meteor|base|774|main':'minior|base|774|main','minior-red|base|10136|main':'minior-red|base|10136|special','minior-orange|base|10137|main':'minior-orange|base|10137|special','minior-yellow|base|10138|main':'minior-yellow|base|10138|special','minior-green|base|10139|main':'minior-green|base|10139|special','minior-blue|base|10140|main':'minior-blue|base|10140|special','minior-indigo|base|10141|main':'minior-indigo|base|10141|special','minior-violet|base|10142|main':'minior-violet|base|10142|special'};
  for(const [oldId,newId] of Object.entries(V368_FORM_ALIASES))migrateFormState(oldId,newId);
  const V367_FORM_ALIASES={'minior-red-meteor|base|774|main':'minior|base|774|main','minior-red|base|10136|main':'minior-red|base|10136|special','minior-orange|base|10137|main':'minior-orange|base|10137|special','minior-yellow|base|10138|main':'minior-yellow|base|10138|special','minior-green|base|10139|main':'minior-green|base|10139|special','minior-blue|base|10140|main':'minior-blue|base|10140|special','minior-indigo|base|10141|main':'minior-indigo|base|10141|special','minior-violet|base|10142|main':'minior-violet|base|10142|special'};
  for(const [oldId,newId] of Object.entries(V367_FORM_ALIASES))migrateFormState(oldId,newId);
  const V366_FORM_ALIASES = {'regional-bias-pichu-alola':'pichu|base|172|main','regional-bias-petilil-hisui':'petilil|base|548|main','regional-bias-goomy-hisui':'goomy|base|704|main','rockruff|dusk|744|main':'rockruff|base|744|main','minior-red-meteor|base|774|main':'minior|base|774|main'};
  for(const [oldId,newId] of Object.entries(V366_FORM_ALIASES)) migrateFormState(oldId,newId);


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
  const shinyCounts = () => { trainingStats.__shinies ||= {}; return trainingStats.__shinies; };
  const shinyCount = id => Math.max(0, Math.floor(Number(shinyCounts()[id] || 0)));
  const setShinyCount = (id, count) => { const old=shinyCount(id); const n=Math.max(0, Math.floor(Number(count)||0)); const c=shinyCounts(); if(n>0)c[id]=n; else delete c[id]; if(n>old) recordActivity(old===0?'shiny_caught':'shiny_added',{entryId:id,name:entryById(id)?.name||id,shiny:true,count:n}); else if(old>0&&n===0) recordActivity('shiny_uncaught',{entryId:id,name:entryById(id)?.name||id,shiny:true}); saveTraining(); };
  const shinySpritePath = e => { if(e?.shinySprite&&/^https?:\/\//i.test(String(e.shinySprite))) return String(e.shinySprite);
    const dex=Math.max(1,Number(e?.dex||0));
    if(SHOWDOWN_FALLBACK_DEX.has(dex) || !SPRITE_FILE_BY_ID[e?.id]) return `https://play.pokemonshowdown.com/sprites/home-shiny/${encodeURIComponent(showdownHomeSlug(e))}.png`;
    const base=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dex}.png`;
    const form=String(e?.form||'').toLowerCase();
    if(/alola|alolan/.test(form)) return `https://play.pokemonshowdown.com/sprites/gen5-shiny/${String(e.name||'').toLowerCase()}-alola.png`;
    if(/galar|galarian/.test(form)) return `https://play.pokemonshowdown.com/sprites/gen5-shiny/${String(e.name||'').toLowerCase()}-galar.png`;
    if(/hisui|hisuian/.test(form)) return `https://play.pokemonshowdown.com/sprites/gen5-shiny/${String(e.name||'').toLowerCase()}-hisui.png`;
    if(/paldea|paldean/.test(form)) return `https://play.pokemonshowdown.com/sprites/gen5-shiny/${String(e.name||'').toLowerCase()}-paldea.png`;
    return base;
  };
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
      <div class="detail-main"><div class="eyebrow">POKÉDEX #${String(e.dex).padStart(3,'0')}</div><h2>${escHtml(e.name)}</h2>${e.form?`<p class="detail-form">${escHtml(e.form)}</p>`:''}<div class="types detail-types">${types.map(t=>`<span class="type" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</span>`).join('')}</div><div class="detail-rarity-pill ${rarityClass}">✦ ${escHtml(rarity)}</div><div class="detail-status"><span class="detail-status-pill ${caught?'is-caught':''}">${caught?`✓ Currently owned · ×${copyCount}`:'○ Not currently owned'}</span><span class="detail-status-pill ${fav?'is-favorite':''}">${fav?'★ Favorite':'☆ Not favorite'}</span></div><div class="detail-actions"><button id="detailFav" class="secondary">${fav?'★ Favorite':'☆ Favorite'}</button><button id="detailTeam" class="secondary">${team.includes(e.id)?'✓ In Team':'＋ Add to Team'}</button></div></div>
    </div><section class="shiny-detail-card ${shinyCount(e.id)>0?'is-owned':''}"><div class="shiny-detail-art"><img loading="lazy" decoding="async" src="${shinySpritePath(e)}" alt="${escHtml(e.name)} shiny" onerror="this.closest('.shiny-detail-art')?.classList.add('is-unavailable');this.remove();"></div><div class="shiny-detail-copy"><div class="eyebrow">✨ SHINY COLLECTION</div><h3>${shinyCount(e.id)>0?'Shiny collected':'Shiny not collected'}</h3><p>${shinyCount(e.id)>0?`You have ${shinyCount(e.id)} shiny ${escHtml(e.name)}${shinyCount(e.id)===1?'':'s'}.`:`Track the shiny separately from your normal LivingDex entry.`}</p><div class="shiny-detail-actions"><span class="detail-status-pill ${shinyCount(e.id)>0?'is-caught':''}">${shinyCount(e.id)>0?`✓ Shiny recorded · ×${shinyCount(e.id)}`:'No shiny recorded'}</span></div></div></section>${navHtml}
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
    queryAll('#infoDropdown .info-tab').forEach(t=>t.addEventListener('click',()=>hydrateDetailPanel(t.dataset.panel)));
    queryAll('#infoContent [data-detail-form]').forEach(b=>b.onclick=()=>openInfo(b.dataset.detailForm));
    $('#infoContent')?.addEventListener('click',e=>{const b=e.target.closest('[data-move-detail]');if(!b)return;e.preventDefault();e.stopPropagation();openMoveInfo(b.dataset.moveDetail);});
    queryAll('#infoContent [data-evo-entry]').forEach(b=>b.onclick=()=>openInfo(b.dataset.evoEntry));
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
  const DAILY_EXCLUDED_ENTRY_IDS = new Set(["pumpkaboo-small|base|710|special","pumpkaboo-large|base|710|special","pumpkaboo-super|base|710|special","gimmighoul|roaming|999|main","staryu|patrickyu|120|main","maushold|base|925|main","maushold|four|925|main","deoxys|base|386|main","deoxys|attack|386|main","deoxys|defense|386|main","deoxys|speed|386|main","burmy|sandy|412|main","burmy|trash|412|main","wormadam|sandy|413|main","wormadam|trash|413|main","cherrim|sunshine|421|main","shellos|east|422|main","gastrodon|east|423|main","mime-jr|galarbias|439|main","rotom|heat|479|main","rotom|wash|479|main","rotom|frost|479|main","rotom|fan|479|main","rotom|mow|479|main","basculin|blue-striped|550|main","basculin|white-striped|550|main","darmanitan|galar|555|main","deerling|summer|585|main","deerling|autumn|585|main","deerling|winter|585|main","sawsbuck|summer|586|main","sawsbuck|autumn|586|main","sawsbuck|winter|586|main","flabebe|blue|669|main","flabebe|orange|669|main","flabebe|white|669|main","flabebe|yellow|669|main","flabebe|blue|669|special","flabebe|orange|669|special","flabebe|white|669|special","flabebe|yellow|669|special","floette|blue|670|special","floette|orange|670|special","floette|white|670|special","floette|yellow|670|special","florges|blue|671|special","florges|orange|671|special","florges|white|671|special","florges|yellow|671|special","meowstic|female|678|main","oricorio|pom-pom|741|main","oricorio|pau|741|main","oricorio|sensu|741|main","rockruff|dusk|744|main","lycanroc|midnight|745|main","lycanroc|dusk|745|main"]);
  function isDailyEligible(e){
    if(!e?.box || DAILY_EXCLUDED_ENTRY_IDS.has(e.id)) return false;
    const sp=speciesForEntry(e);
    const labels=(sp?.labels||[]).map(x=>String(x).toLowerCase());
    if(labels.some(x=>DAILY_EXCLUDED_LABELS.has(x))) return false;
    // Daily Catch is a catchable-world challenge: require actual natural spawn data.
    // This prevents entries such as Baxcalibur from being selected merely because
    // they exist in the LivingDex when no server spawn source is known.
    return (localSpawn(e)||[]).length>0;
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
const DAILY_CATCH_SCHEDULE_VERSION='3.6-fixed-2026';
const DAILY_CATCH_POOL_IDS=["bulbasaur|base|1|main","ivysaur|base|2|main","venusaur|base|3|main","charmander|base|4|main","charmeleon|base|5|main","charizard|base|6|main","squirtle|base|7|main","wartortle|base|8|main","blastoise|base|9|main","caterpie|base|10|main","metapod|base|11|main","butterfree|base|12|main","weedle|base|13|main","kakuna|base|14|main","beedrill|base|15|main","pidgey|base|16|main","pidgeotto|base|17|main","pidgeot|base|18|main","rattata|base|19|main","regional-rattata-alola|alola|19","raticate|base|20|main","regional-raticate-alola|alola|20","spearow|base|21|main","fearow|base|22|main","ekans|base|23|main","arbok|base|24|main","pikachu|base|25|main","regional-bias-25-alola-bias","raichu|base|26|main","regional-raichu-alola|alola|26","sandshrew|base|27|main","regional-sandshrew-alola|alola|27","sandslash|base|28|main","regional-sandslash-alola|alola|28","nidoran-f|base|29|main","nidorina|base|30|main","nidoqueen|base|31|main","nidoran-m|base|32|main","nidorino|base|33|main","nidoking|base|34|main","clefairy|base|35|main","clefable|base|36|main","vulpix|base|37|main","regional-vulpix-alola|alola|37","ninetales|base|38|main","regional-ninetales-alola|alola|38","jigglypuff|base|39|main","wigglytuff|base|40|main","zubat|base|41|main","golbat|base|42|main","oddish|base|43|main","gloom|base|44|main","vileplume|base|45|main","paras|base|46|main","parasect|base|47|main","venonat|base|48|main","venomoth|base|49|main","diglett|base|50|main","regional-diglett-alola|alola|50","dugtrio|base|51|main","regional-dugtrio-alola|alola|51","meowth|base|52|main","regional-meowth-alola|alola|52","regional-meowth-galar|galar|52","persian|base|53|main","regional-persian-alola|alola|53","psyduck|base|54|main","golduck|base|55|main","mankey|base|56|main","primeape|base|57|main","growlithe|base|58|main","regional-growlithe-hisui|hisui|58","arcanine|base|59|main","regional-arcanine-hisui|hisui|59","poliwag|base|60|main","poliwhirl|base|61|main","poliwrath|base|62|main","abra|base|63|main","kadabra|base|64|main","alakazam|base|65|main","machop|base|66|main","machoke|base|67|main","machamp|base|68|main","bellsprout|base|69|main","weepinbell|base|70|main","victreebel|base|71|main","tentacool|base|72|main","tentacruel|base|73|main","geodude|base|74|main","regional-geodude-alola|alola|74","graveler|base|75|main","regional-graveler-alola|alola|75","golem|base|76|main","regional-golem-alola|alola|76","ponyta|base|77|main","regional-ponyta-galar|galar|77","rapidash|base|78|main","regional-rapidash-galar|galar|78","slowpoke|base|79|main","regional-slowpoke-galar|galar|79","slowbro|base|80|main","regional-slowbro-galar|galar|80","magnemite|base|81|main","magneton|base|82|main","farfetchd|base|83|main","regional-farfetchd-galar|galar|83","doduo|base|84|main","dodrio|base|85|main","seel|base|86|main","dewgong|base|87|main","grimer|base|88|main","regional-grimer-alola|alola|88","muk|base|89|main","regional-muk-alola|alola|89","shellder|base|90|main","cloyster|base|91|main","gastly|base|92|main","haunter|base|93|main","gengar|base|94|main","onix|base|95|main","drowzee|base|96|main","hypno|base|97|main","krabby|base|98|main","kingler|base|99|main","voltorb|base|100|main","regional-voltorb-hisui|hisui|100","electrode|base|101|main","regional-electrode-hisui|hisui|101","exeggcute|base|102|main","regional-bias-102-alolan","exeggutor|base|103|main","regional-exeggutor-alola|alola|103","cubone|base|104|main","regional-bias-104-alolan","marowak|base|105|main","regional-marowak-alola|alola|105","hitmonlee|base|106|main","hitmonchan|base|107|main","lickitung|base|108|main","koffing|base|109|main","regional-bias-109-galarian","weezing|base|110|main","regional-weezing-galar|galar|110","rhyhorn|base|111|main","rhydon|base|112|main","chansey|base|113|main","tangela|base|114|main","kangaskhan|base|115|main","horsea|base|116|main","seadra|base|117|main","goldeen|base|118|main","seaking|base|119|main","staryu|base|120|main","starmie|base|121|main","mr-mime|base|122|main","regional-mr-mime-galar|galar|122","scyther|base|123|main","jynx|base|124|main","electabuzz|base|125|main","magmar|base|126|main","pinsir|base|127|main","tauros|base|128|main","regional-tauros-paldea-aqua|paldea|128","regional-tauros-paldea-blaze|paldea|128","regional-tauros-paldea-combat|paldea|128","magikarp|base|129|main","gyarados|base|130|main","lapras|base|131|main","ditto|base|132|main","eevee|base|133|main","vaporeon|base|134|main","jolteon|base|135|main","flareon|base|136|main","porygon|base|137|main","omanyte|base|138|main","omastar|base|139|main","kabuto|base|140|main","kabutops|base|141|main","aerodactyl|base|142|main","snorlax|base|143|main","dratini|base|147|main","dragonair|base|148|main","dragonite|base|149|main","chikorita|base|152|main","bayleef|base|153|main","meganium|base|154|main","cyndaquil|base|155|main","cobblemon-hisui-bias-cyndaquil","quilava|base|156|main","cobblemon-hisui-bias-quilava","typhlosion|base|157|main","regional-typhlosion-hisui|hisui|157","totodile|base|158|main","croconaw|base|159|main","feraligatr|base|160|main","sentret|base|161|main","furret|base|162|main","hoothoot|base|163|main","noctowl|base|164|main","ledyba|base|165|main","ledian|base|166|main","spinarak|base|167|main","ariados|base|168|main","crobat|base|169|main","chinchou|base|170|main","lanturn|base|171|main","pichu|base|172|main","cleffa|base|173|main","igglybuff|base|174|main","togepi|base|175|main","togetic|base|176|main","natu|base|177|main","xatu|base|178|main","mareep|base|179|main","flaaffy|base|180|main","ampharos|base|181|main","bellossom|base|182|main","marill|base|183|main","azumarill|base|184|main","sudowoodo|base|185|main","politoed|base|186|main","hoppip|base|187|main","skiploom|base|188|main","jumpluff|base|189|main","aipom|base|190|main","sunkern|base|191|main","sunflora|base|192|main","yanma|base|193|main","wooper|base|194|main","regional-wooper-paldea|paldea|194","quagsire|base|195|main","espeon|base|196|main","umbreon|base|197|main","murkrow|base|198|main","slowking|base|199|main","regional-slowking-galar|galar|199","misdreavus|base|200|main","unown|base|201|main","wobbuffet|base|202|main","girafarig|base|203|main","pineco|base|204|main","forretress|base|205|main","dunsparce|base|206|main","gligar|base|207|main","steelix|base|208|main","snubbull|base|209|main","granbull|base|210|main","qwilfish|base|211|main","regional-qwilfish-hisui|hisui|211","scizor|base|212|main","shuckle|base|213|main","heracross|base|214|main","sneasel|base|215|main","regional-sneasel-hisui|hisui|215","teddiursa|base|216|main","ursaring|base|217|main","slugma|base|218|main","magcargo|base|219|main","swinub|base|220|main","piloswine|base|221|main","corsola|base|222|main","regional-corsola-galar|galar|222","remoraid|base|223|main","octillery|base|224|main","delibird|base|225|main","mantine|base|226|main","skarmory|base|227|main","houndour|base|228|main","houndoom|base|229|main","kingdra|base|230|main","phanpy|base|231|main","donphan|base|232|main","porygon2|base|233|main","stantler|base|234|main","smeargle|base|235|main","tyrogue|base|236|main","hitmontop|base|237|main","smoochum|base|238|main","elekid|base|239|main","magby|base|240|main","miltank|base|241|main","blissey|base|242|main","larvitar|base|246|main","pupitar|base|247|main","tyranitar|base|248|main","treecko|base|252|main","grovyle|base|253|main","sceptile|base|254|main","torchic|base|255|main","combusken|base|256|main","blaziken|base|257|main","mudkip|base|258|main","marshtomp|base|259|main","swampert|base|260|main","poochyena|base|261|main","mightyena|base|262|main","zigzagoon|base|263|main","regional-zigzagoon-galar|galar|263","linoone|base|264|main","regional-linoone-galar|galar|264","beautifly|base|267|main","cascoon|base|268|main","dustox|base|269|main","lotad|base|270|main","lombre|base|271|main","ludicolo|base|272|main","seedot|base|273|main","nuzleaf|base|274|main","shiftry|base|275|main","taillow|base|276|main","swellow|base|277|main","wingull|base|278|main","pelipper|base|279|main","ralts|base|280|main","kirlia|base|281|main","gardevoir|base|282|main","surskit|base|283|main","masquerain|base|284|main","shroomish|base|285|main","breloom|base|286|main","slakoth|base|287|main","vigoroth|base|288|main","slaking|base|289|main","nincada|base|290|main","ninjask|base|291|main","shedinja|base|292|main","whismur|base|293|main","loudred|base|294|main","exploud|base|295|main","makuhita|base|296|main","hariyama|base|297|main","azurill|base|298|main","nosepass|base|299|main","skitty|base|300|main","delcatty|base|301|main","sableye|base|302|main","mawile|base|303|main","aron|base|304|main","lairon|base|305|main","aggron|base|306|main","meditite|base|307|main","medicham|base|308|main","electrike|base|309|main","manectric|base|310|main","plusle|base|311|main","minun|base|312|main","volbeat|base|313|main","illumise|base|314|main","roselia|base|315|main","gulpin|base|316|main","swalot|base|317|main","carvanha|base|318|main","sharpedo|base|319|main","wailmer|base|320|main","wailord|base|321|main","numel|base|322|main","camerupt|base|323|main","torkoal|base|324|main","spoink|base|325|main","grumpig|base|326|main","spinda|base|327|main","trapinch|base|328|main","vibrava|base|329|main","flygon|base|330|main","cacnea|base|331|main","cacturne|base|332|main","swablu|base|333|main","altaria|base|334|main","zangoose|base|335|main","seviper|base|336|main","lunatone|base|337|main","solrock|base|338|main","barboach|base|339|main","whiscash|base|340|main","corphish|base|341|main","crawdaunt|base|342|main","baltoy|base|343|main","claydol|base|344|main","lileep|base|345|main","cradily|base|346|main","anorith|base|347|main","armaldo|base|348|main","feebas|base|349|main","milotic|base|350|main","castform|base|351|main","kecleon|base|352|main","shuppet|base|353|main","banette|base|354|main","duskull|base|355|main","dusclops|base|356|main","tropius|base|357|main","chimecho|base|358|main","absol|base|359|main","wynaut|base|360|main","snorunt|base|361|main","glalie|base|362|main","spheal|base|363|main","sealeo|base|364|main","walrein|base|365|main","clamperl|base|366|main","huntail|base|367|main","gorebyss|base|368|main","relicanth|base|369|main","luvdisc|base|370|main","bagon|base|371|main","shelgon|base|372|main","salamence|base|373|main","beldum|base|374|main","metang|base|375|main","metagross|base|376|main","turtwig|base|387|main","grotle|base|388|main","torterra|base|389|main","chimchar|base|390|main","monferno|base|391|main","infernape|base|392|main","piplup|base|393|main","prinplup|base|394|main","empoleon|base|395|main","starly|base|396|main","staravia|base|397|main","staraptor|base|398|main","bidoof|base|399|main","bibarel|base|400|main","kricketot|base|401|main","kricketune|base|402|main","shinx|base|403|main","luxio|base|404|main","luxray|base|405|main","budew|base|406|main","roserade|base|407|main","cranidos|base|408|main","rampardos|base|409|main","shieldon|base|410|main","bastiodon|base|411|main","burmy|base|412|main","wormadam-plant|base|413|main","mothim|base|414|main","combee|base|415|main","vespiquen|base|416|main","pachirisu|base|417|main","buizel|base|418|main","floatzel|base|419|main","cherubi|base|420|main","cherrim|base|421|main","shellos|base|422|main","gastrodon|base|423|main","ambipom|base|424|main","drifloon|base|425|main","drifblim|base|426|main","buneary|base|427|main","lopunny|base|428|main","mismagius|base|429|main","honchkrow|base|430|main","glameow|base|431|main","purugly|base|432|main","chingling|base|433|main","stunky|base|434|main","skuntank|base|435|main","bronzor|base|436|main","bronzong|base|437|main","bonsly|base|438|main","mime-jr|base|439|main","happiny|base|440|main","chatot|base|441|main","spiritomb|base|442|main","gible|base|443|main","gabite|base|444|main","garchomp|base|445|main","munchlax|base|446|main","riolu|base|447|main","lucario|base|448|main","hippopotas|base|449|main","hippowdon|base|450|main","skorupi|base|451|main","drapion|base|452|main","croagunk|base|453|main","toxicroak|base|454|main","carnivine|base|455|main","finneon|base|456|main","lumineon|base|457|main","mantyke|base|458|main","snover|base|459|main","abomasnow|base|460|main","weavile|base|461|main","magnezone|base|462|main","lickilicky|base|463|main","rhyperior|base|464|main","tangrowth|base|465|main","electivire|base|466|main","magmortar|base|467|main","togekiss|base|468|main","yanmega|base|469|main","leafeon|base|470|main","glaceon|base|471|main","gliscor|base|472|main","mamoswine|base|473|main","porygon-z|base|474|main","gallade|base|475|main","probopass|base|476|main","dusknoir|base|477|main","froslass|base|478|main","rotom|base|479|main","snivy|base|495|main","servine|base|496|main","serperior|base|497|main","tepig|base|498|main","pignite|base|499|main","emboar|base|500|main","oshawott|base|501|main","cobblemon-hisui-bias-oshawott","dewott|base|502|main","cobblemon-hisui-bias-dewott","samurott|base|503|main","regional-samurott-hisui|hisui|503","patrat|base|504|main","watchog|base|505|main","lillipup|base|506|main","herdier|base|507|main","stoutland|base|508|main","purrloin|base|509|main","liepard|base|510|main","pansage|base|511|main","simisage|base|512|main","pansear|base|513|main","simisear|base|514|main","panpour|base|515|main","simipour|base|516|main","munna|base|517|main","musharna|base|518|main","pidove|base|519|main","tranquill|base|520|main","unfezant|base|521|main","blitzle|base|522|main","zebstrika|base|523|main","roggenrola|base|524|main","boldore|base|525|main","gigalith|base|526|main","woobat|base|527|main","swoobat|base|528|main","drilbur|base|529|main","excadrill|base|530|main","audino|base|531|main","timburr|base|532|main","gurdurr|base|533|main","conkeldurr|base|534|main","tympole|base|535|main","palpitoad|base|536|main","seismitoad|base|537|main","throh|base|538|main","sawk|base|539|main","sewaddle|base|540|main","swadloon|base|541|main","leavanny|base|542|main","venipede|base|543|main","whirlipede|base|544|main","scolipede|base|545|main","cottonee|base|546|main","whimsicott|base|547|main","petilil|base|548|main","lilligant|base|549|main","regional-lilligant-hisui|hisui|549","basculin-red-striped|base|550|main","sandile|base|551|main","krokorok|base|552|main","krookodile|base|553|main","darumaka|base|554|main","regional-darumaka-galar|galar|554","darmanitan-standard|base|555|main","maractus|base|556|main","dwebble|base|557|main","crustle|base|558|main","scraggy|base|559|main","scrafty|base|560|main","sigilyph|base|561|main","yamask|base|562|main","regional-yamask-galar|galar|562","cofagrigus|base|563|main","tirtouga|base|564|main","carracosta|base|565|main","archen|base|566|main","archeops|base|567|main","trubbish|base|568|main","garbodor|base|569|main","zorua|base|570|main","regional-zorua-hisui|hisui|570","zoroark|base|571|main","regional-zoroark-hisui|hisui|571","minccino|base|572|main","cinccino|base|573|main","gothita|base|574|main","gothorita|base|575|main","gothitelle|base|576|main","solosis|base|577|main","duosion|base|578|main","reuniclus|base|579|main","ducklett|base|580|main","swanna|base|581|main","vanillite|base|582|main","vanillish|base|583|main","vanilluxe|base|584|main","deerling|base|585|main","sawsbuck|base|586|main","emolga|base|587|main","karrablast|base|588|main","escavalier|base|589|main","foongus|base|590|main","amoonguss|base|591|main","frillish-male|base|592|main","jellicent-male|base|593|main","alomomola|base|594|main","joltik|base|595|main","galvantula|base|596|main","ferroseed|base|597|main","ferrothorn|base|598|main","klink|base|599|main","klang|base|600|main","klinklang|base|601|main","tynamo|base|602|main","eelektrik|base|603|main","eelektross|base|604|main","elgyem|base|605|main","beheeyem|base|606|main","litwick|base|607|main","lampent|base|608|main","chandelure|base|609|main","axew|base|610|main","fraxure|base|611|main","haxorus|base|612|main","cubchoo|base|613|main","beartic|base|614|main","cryogonal|base|615|main","shelmet|base|616|main","accelgor|base|617|main","stunfisk|base|618|main","regional-stunfisk-galar|galar|618","mienfoo|base|619|main","mienshao|base|620|main","druddigon|base|621|main","golett|base|622|main","golurk|base|623|main","pawniard|base|624|main","bisharp|base|625|main","bouffalant|base|626|main","rufflet|base|627|main","braviary|base|628|main","regional-braviary-hisui|hisui|628","vullaby|base|629|main","mandibuzz|base|630|main","heatmor|base|631|main","durant|base|632|main","deino|base|633|main","zweilous|base|634|main","hydreigon|base|635|main","larvesta|base|636|main","volcarona|base|637|main","chespin|base|650|main","quilladin|base|651|main","chesnaught|base|652|main","fennekin|base|653|main","braixen|base|654|main","delphox|base|655|main","froakie|base|656|main","frogadier|base|657|main","greninja|base|658|main","bunnelby|base|659|main","diggersby|base|660|main","fletchling|base|661|main","fletchinder|base|662|main","talonflame|base|663|main","scatterbug|base|664|main","spewpa|base|665|main","vivillon|base|666|main","litleo|base|667|main","pyroar-male|base|668|main","flabebe|base|669|main","floette|base|670|main","florges|base|671|main","skiddo|base|672|main","gogoat|base|673|main","pancham|base|674|main","pangoro|base|675|main","furfrou|base|676|main","espurr|base|677|main","meowstic-male|base|678|main","honedge|base|679|main","doublade|base|680|main","aegislash-shield|base|681|main","spritzee|base|682|main","aromatisse|base|683|main","swirlix|base|684|main","slurpuff|base|685|main","inkay|base|686|main","malamar|base|687|main","binacle|base|688|main","barbaracle|base|689|main","skrelp|base|690|main","dragalge|base|691|main","clauncher|base|692|main","clawitzer|base|693|main","helioptile|base|694|main","heliolisk|base|695|main","tyrunt|base|696|main","tyrantrum|base|697|main","amaura|base|698|main","aurorus|base|699|main","sylveon|base|700|main","hawlucha|base|701|main","dedenne|base|702|main","carbink|base|703|main","goomy|base|704|main","sliggoo|base|705|main","regional-sliggoo-hisui|hisui|705","goodra|base|706|main","regional-goodra-hisui|hisui|706","klefki|base|707|main","phantump|base|708|main","trevenant|base|709|main","pumpkaboo-average|base|710|main","gourgeist-average|base|711|main","bergmite|base|712|main","avalugg|base|713|main","regional-avalugg-hisui|hisui|713","noibat|base|714|main","noivern|base|715|main","rowlet|base|722|main","cobblemon-hisui-bias-rowlet","dartrix|base|723|main","cobblemon-hisui-bias-dartrix","decidueye|base|724|main","regional-decidueye-hisui|hisui|724","litten|base|725|main","torracat|base|726|main","incineroar|base|727|main","popplio|base|728|main","brionne|base|729|main","primarina|base|730|main","pikipek|base|731|main","trumbeak|base|732|main","toucannon|base|733|main","yungoos|base|734|main","gumshoos|base|735|main","grubbin|base|736|main","charjabug|base|737|main","vikavolt|base|738|main","crabrawler|base|739|main","crabominable|base|740|main","oricorio-baile|base|741|main","cutiefly|base|742|main","ribombee|base|743|main","rockruff|base|744|main","lycanroc-midday|base|745|main","wishiwashi-solo|base|746|main","mareanie|base|747|main","toxapex|base|748|main","mudbray|base|749|main","mudsdale|base|750|main","dewpider|base|751|main","araquanid|base|752|main","fomantis|base|753|main","lurantis|base|754|main","morelull|base|755|main","shiinotic|base|756|main","salandit|base|757|main","salazzle|base|758|main","stufful|base|759|main","bewear|base|760|main","bounsweet|base|761|main","steenee|base|762|main","tsareena|base|763|main","comfey|base|764|main","oranguru|base|765|main","passimian|base|766|main","wimpod|base|767|main","golisopod|base|768|main","sandygast|base|769|main","palossand|base|770|main","pyukumuku|base|771|main","minior-red-meteor|base|774|main","komala|base|775|main","turtonator|base|776|main","togedemaru|base|777|main","mimikyu-disguised|base|778|main","bruxish|base|779|main","drampa|base|780|main","dhelmise|base|781|main","jangmo-o|base|782|main","hakamo-o|base|783|main","kommo-o|base|784|main","grookey|base|810|main","thwackey|base|811|main","rillaboom|base|812|main","scorbunny|base|813|main","raboot|base|814|main","cinderace|base|815|main","sobble|base|816|main","drizzile|base|817|main","inteleon|base|818|main","skwovet|base|819|main","greedent|base|820|main","rookidee|base|821|main","corvisquire|base|822|main","corviknight|base|823|main","blipbug|base|824|main","dottler|base|825|main","orbeetle|base|826|main","nickit|base|827|main","thievul|base|828|main","gossifleur|base|829|main","eldegoss|base|830|main","wooloo|base|831|main","dubwool|base|832|main","chewtle|base|833|main","drednaw|base|834|main","yamper|base|835|main","boltund|base|836|main","rolycoly|base|837|main","carkol|base|838|main","coalossal|base|839|main","applin|base|840|main","flapple|base|841|main","appletun|base|842|main","silicobra|base|843|main","sandaconda|base|844|main","cramorant|base|845|main","arrokuda|base|846|main","barraskewda|base|847|main","toxel|base|848|main","toxtricity-amped|base|849|main","sizzlipede|base|850|main","centiskorch|base|851|main","clobbopus|base|852|main","grapploct|base|853|main","sinistea|base|854|main","polteageist|base|855|main","hatenna|base|856|main","hattrem|base|857|main","hatterene|base|858|main","impidimp|base|859|main","morgrem|base|860|main","grimmsnarl|base|861|main","obstagoon|base|862|main","perrserker|base|863|main","cursola|base|864|main","sirfetchd|base|865|main","mr-rime|base|866|main","runerigus|base|867|main","milcery|base|868|main","alcremie|base|869|main","falinks|base|870|main","pincurchin|base|871|main","snom|base|872|main","frosmoth|base|873|main","stonjourner|base|874|main","eiscue-ice|base|875|main","indeedee-male|base|876|main","morpeko-full-belly|base|877|main","cufant|base|878|main","copperajah|base|879|main","duraludon|base|884|main","dreepy|base|885|main","drakloak|base|886|main","dragapult|base|887|main","wyrdeer|base|899|main","kleavor|base|900|main","ursaluna|base|901|main","basculegion-male|base|902|main","sneasler|base|903|main","overqwil|base|904|main","sprigatito|base|906|main","floragato|base|907|main","meowscarada|base|908|main","fuecoco|base|909|main","crocalor|base|910|main","skeledirge|base|911|main","quaxly|base|912|main","quaxwell|base|913|main","quaquaval|base|914|main","lechonk|base|915|main","oinkologne-male|base|916|main","tarountula|base|917|main","spidops|base|918|main","nymble|base|919|main","lokix|base|920|main","pawmi|base|921|main","pawmo|base|922|main","pawmot|base|923|main","tandemaus|base|924|main","fidough|base|926|main","dachsbun|base|927|main","smoliv|base|928|main","dolliv|base|929|main","arboliva|base|930|main","squawkabilly-green-plumage|base|931|main","nacli|base|932|main","naclstack|base|933|main","garganacl|base|934|main","charcadet|base|935|main","armarouge|base|936|main","ceruledge|base|937|main","tadbulb|base|938|main","bellibolt|base|939|main","wattrel|base|940|main","kilowattrel|base|941|main","maschiff|base|942|main","mabosstiff|base|943|main","shroodle|base|944|main","grafaiai|base|945|main","bramblin|base|946|main","brambleghast|base|947|main","toedscool|base|948|main","toedscruel|base|949|main","klawf|base|950|main","capsakid|base|951|main","scovillain|base|952|main","rellor|base|953|main","rabsca|base|954|main","flittle|base|955|main","espathra|base|956|main","tinkatink|base|957|main","tinkatuff|base|958|main","tinkaton|base|959|main","wiglett|base|960|main","wugtrio|base|961|main","bombirdier|base|962|main","finizen|base|963|main","palafin-zero|base|964|main","varoom|base|965|main","revavroom|base|966|main","cyclizar|base|967|main","orthworm|base|968|main","glimmet|base|969|main","glimmora|base|970|main","greavard|base|971|main","houndstone|base|972|main","flamigo|base|973|main","cetoddle|base|974|main","cetitan|base|975|main","veluza|base|976|main","dondozo|base|977|main","tatsugiri-curly|base|978|main","annihilape|base|979|main","clodsire|base|980|main","farigiraf|base|981|main","dudunsparce-two-segment|base|982|main","kingambit|base|983|main","frigibax|base|996|main","arctibax|base|997|main","baxcalibur|base|998|main","gimmighoul|base|999|main","dipplin|base|1011|main","hydrapple|base|1019|main","poltchageist|base|1012|main","sinistcha|base|1013|main","archaludon|base|1018|main"];
const DAILY_CATCH_SCHEDULE_2026={"2026-01-01":"spearow|base|21|main","2026-01-02":"chikorita|base|152|main","2026-01-03":"pumpkaboo-average|base|710|main","2026-01-04":"shuckle|base|213|main","2026-01-05":"cacnea|base|331|main","2026-01-06":"charcadet|base|935|main","2026-01-07":"mimikyu-disguised|base|778|main","2026-01-08":"blissey|base|242|main","2026-01-09":"maractus|base|556|main","2026-01-10":"gurdurr|base|533|main","2026-01-11":"charjabug|base|737|main","2026-01-12":"gothorita|base|575|main","2026-01-13":"wyrdeer|base|899|main","2026-01-14":"bronzor|base|436|main","2026-01-15":"sizzlipede|base|850|main","2026-01-16":"gumshoos|base|735|main","2026-01-17":"conkeldurr|base|534|main","2026-01-18":"barbaracle|base|689|main","2026-01-19":"psyduck|base|54|main","2026-01-20":"lillipup|base|506|main","2026-01-21":"regional-bias-104-alolan","2026-01-22":"nidorino|base|33|main","2026-01-23":"beheeyem|base|606|main","2026-01-24":"crocalor|base|910|main","2026-01-25":"oinkologne-male|base|916|main","2026-01-26":"gothita|base|574|main","2026-01-27":"escavalier|base|589|main","2026-01-28":"blipbug|base|824|main","2026-01-29":"electrike|base|309|main","2026-01-30":"mandibuzz|base|630|main","2026-01-31":"croagunk|base|453|main","2026-02-01":"staravia|base|397|main","2026-02-02":"regional-raichu-alola|alola|26","2026-02-03":"diglett|base|50|main","2026-02-04":"cobblemon-hisui-bias-oshawott","2026-02-05":"varoom|base|965|main","2026-02-06":"squawkabilly-green-plumage|base|931|main","2026-02-07":"regional-exeggutor-alola|alola|103","2026-02-08":"milcery|base|868|main","2026-02-09":"snivy|base|495|main","2026-02-10":"regional-typhlosion-hisui|hisui|157","2026-02-11":"budew|base|406|main","2026-02-12":"sneasler|base|903|main","2026-02-13":"regional-decidueye-hisui|hisui|724","2026-02-14":"quaxly|base|912|main","2026-02-15":"wailord|base|321|main","2026-02-16":"cyclizar|base|967|main","2026-02-17":"buneary|base|427|main","2026-02-18":"beheeyem|base|606|main","2026-02-19":"spoink|base|325|main","2026-02-20":"dottler|base|825|main","2026-02-21":"scorbunny|base|813|main","2026-02-22":"wingull|base|278|main","2026-02-23":"regional-zorua-hisui|hisui|570","2026-02-24":"frosmoth|base|873|main","2026-02-25":"basculegion-male|base|902|main","2026-02-26":"meganium|base|154|main","2026-02-27":"bellsprout|base|69|main","2026-02-28":"cherubi|base|420|main","2026-03-01":"vanillish|base|583|main","2026-03-02":"zigzagoon|base|263|main","2026-03-03":"spritzee|base|682|main","2026-03-04":"nidoran-m|base|32|main","2026-03-05":"emolga|base|587|main","2026-03-06":"flapple|base|841|main","2026-03-07":"budew|base|406|main","2026-03-08":"regional-lilligant-hisui|hisui|549","2026-03-09":"quaxly|base|912|main","2026-03-10":"aerodactyl|base|142|main","2026-03-11":"smoliv|base|928|main","2026-03-12":"seadra|base|117|main","2026-03-13":"ninjask|base|291|main","2026-03-14":"zweilous|base|634|main","2026-03-15":"regional-corsola-galar|galar|222","2026-03-16":"venusaur|base|3|main","2026-03-17":"espurr|base|677|main","2026-03-18":"amoonguss|base|591|main","2026-03-19":"haunter|base|93|main","2026-03-20":"pyukumuku|base|771|main","2026-03-21":"ludicolo|base|272|main","2026-03-22":"bagon|base|371|main","2026-03-23":"pansear|base|513|main","2026-03-24":"electrode|base|101|main","2026-03-25":"mudsdale|base|750|main","2026-03-26":"taillow|base|276|main","2026-03-27":"bellossom|base|182|main","2026-03-28":"skrelp|base|690|main","2026-03-29":"swanna|base|581|main","2026-03-30":"diggersby|base|660|main","2026-03-31":"electrode|base|101|main","2026-04-01":"popplio|base|728|main","2026-04-02":"pawmot|base|923|main","2026-04-03":"elekid|base|239|main","2026-04-04":"malamar|base|687|main","2026-04-05":"castform|base|351|main","2026-04-06":"naclstack|base|933|main","2026-04-07":"miltank|base|241|main","2026-04-08":"weedle|base|13|main","2026-04-09":"trapinch|base|328|main","2026-04-10":"mothim|base|414|main","2026-04-11":"nickit|base|827|main","2026-04-12":"croconaw|base|159|main","2026-04-13":"silicobra|base|843|main","2026-04-14":"thievul|base|828|main","2026-04-15":"rolycoly|base|837|main","2026-04-16":"makuhita|base|296|main","2026-04-17":"granbull|base|210|main","2026-04-18":"bounsweet|base|761|main","2026-04-19":"murkrow|base|198|main","2026-04-20":"whimsicott|base|547|main","2026-04-21":"tirtouga|base|564|main","2026-04-22":"amoonguss|base|591|main","2026-04-23":"heliolisk|base|695|main","2026-04-24":"quaxwell|base|913|main","2026-04-25":"skiploom|base|188|main","2026-04-26":"exeggutor|base|103|main","2026-04-27":"dwebble|base|557|main","2026-04-28":"octillery|base|224|main","2026-04-29":"shroomish|base|285|main","2026-04-30":"venonat|base|48|main","2026-05-01":"simisage|base|512|main","2026-05-02":"swanna|base|581|main","2026-05-03":"golurk|base|623|main","2026-05-04":"regional-ponyta-galar|galar|77","2026-05-05":"servine|base|496|main","2026-05-06":"escavalier|base|589|main","2026-05-07":"aipom|base|190|main","2026-05-08":"typhlosion|base|157|main","2026-05-09":"charcadet|base|935|main","2026-05-10":"appletun|base|842|main","2026-05-11":"cranidos|base|408|main","2026-05-12":"seismitoad|base|537|main","2026-05-13":"deerling|base|585|main","2026-05-14":"wiglett|base|960|main","2026-05-15":"skeledirge|base|911|main","2026-05-16":"regional-stunfisk-galar|galar|618","2026-05-17":"gallade|base|475|main","2026-05-18":"bellibolt|base|939|main","2026-05-19":"tyrantrum|base|697|main","2026-05-20":"cyclizar|base|967|main","2026-05-21":"rookidee|base|821|main","2026-05-22":"scolipede|base|545|main","2026-05-23":"gogoat|base|673|main","2026-05-24":"swalot|base|317|main","2026-05-25":"golem|base|76|main","2026-05-26":"zoroark|base|571|main","2026-05-27":"finizen|base|963|main","2026-05-28":"lilligant|base|549|main","2026-05-29":"dipplin|base|1011|main","2026-05-30":"araquanid|base|752|main","2026-05-31":"meowscarada|base|908|main","2026-06-01":"varoom|base|965|main","2026-06-02":"regional-weezing-galar|galar|110","2026-06-03":"regional-typhlosion-hisui|hisui|157","2026-06-04":"aipom|base|190|main","2026-06-05":"togetic|base|176|main","2026-06-06":"furfrou|base|676|main","2026-06-07":"kricketune|base|402|main","2026-06-08":"skrelp|base|690|main","2026-06-09":"electrike|base|309|main","2026-06-10":"bounsweet|base|761|main","2026-06-11":"stoutland|base|508|main","2026-06-12":"luvdisc|base|370|main","2026-06-13":"salandit|base|757|main","2026-06-14":"meganium|base|154|main","2026-06-15":"kricketune|base|402|main","2026-06-16":"slurpuff|base|685|main","2026-06-17":"raichu|base|26|main","2026-06-18":"lampent|base|608|main","2026-06-19":"regional-growlithe-hisui|hisui|58","2026-06-20":"lurantis|base|754|main","2026-06-21":"coalossal|base|839|main","2026-06-22":"rockruff|base|744|main","2026-06-23":"golduck|base|55|main","2026-06-24":"porygon-z|base|474|main","2026-06-25":"sandaconda|base|844|main","2026-06-26":"blissey|base|242|main","2026-06-27":"quilava|base|156|main","2026-06-28":"granbull|base|210|main","2026-06-29":"regional-darumaka-galar|galar|554","2026-06-30":"hatenna|base|856|main","2026-07-01":"regional-golem-alola|alola|76","2026-07-02":"tinkatink|base|957|main","2026-07-03":"fraxure|base|611|main","2026-07-04":"bellibolt|base|939|main","2026-07-05":"gastly|base|92|main","2026-07-06":"rampardos|base|409|main","2026-07-07":"doublade|base|680|main","2026-07-08":"vullaby|base|629|main","2026-07-09":"cascoon|base|268|main","2026-07-10":"delibird|base|225|main","2026-07-11":"ekans|base|23|main","2026-07-12":"crabrawler|base|739|main","2026-07-13":"blaziken|base|257|main","2026-07-14":"gothorita|base|575|main","2026-07-15":"drednaw|base|834|main","2026-07-16":"regional-ninetales-alola|alola|38","2026-07-17":"yamper|base|835|main","2026-07-18":"axew|base|610|main","2026-07-19":"wartortle|base|8|main","2026-07-20":"infernape|base|392|main","2026-07-21":"zigzagoon|base|263|main","2026-07-22":"basculegion-male|base|902|main","2026-07-23":"tsareena|base|763|main","2026-07-24":"regional-corsola-galar|galar|222","2026-07-25":"darumaka|base|554|main","2026-07-26":"swinub|base|220|main","2026-07-27":"cubchoo|base|613|main","2026-07-28":"throh|base|538|main","2026-07-29":"cufant|base|878|main","2026-07-30":"pidgeot|base|18|main","2026-07-31":"kricketune|base|402|main","2026-08-01":"igglybuff|base|174|main","2026-08-02":"wiglett|base|960|main","2026-08-03":"runerigus|base|867|main","2026-08-04":"glalie|base|362|main","2026-08-05":"comfey|base|764|main","2026-08-06":"regional-avalugg-hisui|hisui|713","2026-08-07":"gardevoir|base|282|main","2026-08-08":"drampa|base|780|main","2026-08-09":"arcanine|base|59|main","2026-08-10":"metang|base|375|main","2026-08-11":"simipour|base|516|main","2026-08-12":"chimecho|base|358|main","2026-08-13":"accelgor|base|617|main","2026-08-14":"seismitoad|base|537|main","2026-08-15":"rhyperior|base|464|main","2026-08-16":"drapion|base|452|main","2026-08-17":"conkeldurr|base|534|main","2026-08-18":"regional-geodude-alola|alola|74","2026-08-19":"tauros|base|128|main","2026-08-20":"purrloin|base|509|main","2026-08-21":"aurorus|base|699|main","2026-08-22":"shuppet|base|353|main","2026-08-23":"thievul|base|828|main","2026-08-24":"smeargle|base|235|main","2026-08-25":"regional-goodra-hisui|hisui|706","2026-08-26":"sandshrew|base|27|main","2026-08-27":"emolga|base|587|main","2026-08-28":"garchomp|base|445|main","2026-08-29":"scorbunny|base|813|main","2026-08-30":"carracosta|base|565|main","2026-08-31":"vespiquen|base|416|main","2026-09-01":"salandit|base|757|main","2026-09-02":"comfey|base|764|main","2026-09-03":"cubone|base|104|main","2026-09-04":"emolga|base|587|main","2026-09-05":"tynamo|base|602|main","2026-09-06":"regional-decidueye-hisui|hisui|724","2026-09-07":"bayleef|base|153|main","2026-09-08":"regional-meowth-galar|galar|52","2026-09-09":"hydreigon|base|635|main","2026-09-10":"clodsire|base|980|main","2026-09-11":"chikorita|base|152|main","2026-09-12":"tauros|base|128|main","2026-09-13":"drowzee|base|96|main","2026-09-14":"mudsdale|base|750|main","2026-09-15":"graveler|base|75|main","2026-09-16":"pawniard|base|624|main","2026-09-17":"ponyta|base|77|main","2026-09-18":"regional-persian-alola|alola|53","2026-09-19":"darumaka|base|554|main","2026-09-20":"ducklett|base|580|main","2026-09-21":"mantine|base|226|main","2026-09-22":"girafarig|base|203|main","2026-09-23":"dipplin|base|1011|main","2026-09-24":"lumineon|base|457|main","2026-09-25":"pansage|base|511|main","2026-09-26":"rockruff|base|744|main","2026-09-27":"finneon|base|456|main","2026-09-28":"togedemaru|base|777|main","2026-09-29":"copperajah|base|879|main","2026-09-30":"meganium|base|154|main","2026-10-01":"regional-electrode-hisui|hisui|101","2026-10-02":"cyndaquil|base|155|main","2026-10-03":"gothitelle|base|576|main","2026-10-04":"delcatty|base|301|main","2026-10-05":"pancham|base|674|main","2026-10-06":"clawitzer|base|693|main","2026-10-07":"galvantula|base|596|main","2026-10-08":"crabrawler|base|739|main","2026-10-09":"musharna|base|518|main","2026-10-10":"regional-bias-109-galarian","2026-10-11":"thwackey|base|811|main","2026-10-12":"jellicent-male|base|593|main","2026-10-13":"regional-tauros-paldea-blaze|paldea|128","2026-10-14":"manectric|base|310|main","2026-10-15":"regional-electrode-hisui|hisui|101","2026-10-16":"burmy|base|412|main","2026-10-17":"pichu|base|172|main","2026-10-18":"camerupt|base|323|main","2026-10-19":"rattata|base|19|main","2026-10-20":"omanyte|base|138|main","2026-10-21":"altaria|base|334|main","2026-10-22":"shinx|base|403|main","2026-10-23":"probopass|base|476|main","2026-10-24":"phantump|base|708|main","2026-10-25":"baxcalibur|base|998|main","2026-10-26":"plusle|base|311|main","2026-10-27":"pyukumuku|base|771|main","2026-10-28":"glalie|base|362|main","2026-10-29":"absol|base|359|main","2026-10-30":"drifblim|base|426|main","2026-10-31":"seel|base|86|main","2026-11-01":"cobblemon-hisui-bias-quilava","2026-11-02":"piloswine|base|221|main","2026-11-03":"rellor|base|953|main","2026-11-04":"starmie|base|121|main","2026-11-05":"regional-wooper-paldea|paldea|194","2026-11-06":"larvesta|base|636|main","2026-11-07":"magmortar|base|467|main","2026-11-08":"blitzle|base|522|main","2026-11-09":"jolteon|base|135|main","2026-11-10":"scraggy|base|559|main","2026-11-11":"poliwhirl|base|61|main","2026-11-12":"gogoat|base|673|main","2026-11-13":"vikavolt|base|738|main","2026-11-14":"mabosstiff|base|943|main","2026-11-15":"nacli|base|932|main","2026-11-16":"abra|base|63|main","2026-11-17":"smoliv|base|928|main","2026-11-18":"ferrothorn|base|598|main","2026-11-19":"regional-tauros-paldea-combat|paldea|128","2026-11-20":"shellos|base|422|main","2026-11-21":"cacturne|base|332|main","2026-11-22":"wailmer|base|320|main","2026-11-23":"mr-rime|base|866|main","2026-11-24":"kingler|base|99|main","2026-11-25":"sudowoodo|base|185|main","2026-11-26":"pignite|base|499|main","2026-11-27":"ceruledge|base|937|main","2026-11-28":"tympole|base|535|main","2026-11-29":"grafaiai|base|945|main","2026-11-30":"flareon|base|136|main","2026-12-01":"kakuna|base|14|main","2026-12-02":"cherrim|base|421|main","2026-12-03":"hatenna|base|856|main","2026-12-04":"cobblemon-hisui-bias-cyndaquil","2026-12-05":"metang|base|375|main","2026-12-06":"salandit|base|757|main","2026-12-07":"quaxwell|base|913|main","2026-12-08":"spoink|base|325|main","2026-12-09":"pichu|base|172|main","2026-12-10":"beartic|base|614|main","2026-12-11":"azumarill|base|184|main","2026-12-12":"exploud|base|295|main","2026-12-13":"furret|base|162|main","2026-12-14":"magmar|base|126|main","2026-12-15":"tarountula|base|917|main","2026-12-16":"voltorb|base|100|main","2026-12-17":"anorith|base|347|main","2026-12-18":"bombirdier|base|962|main","2026-12-19":"teddiursa|base|216|main","2026-12-20":"regional-slowpoke-galar|galar|79","2026-12-21":"varoom|base|965|main","2026-12-22":"regional-persian-alola|alola|53","2026-12-23":"thievul|base|828|main","2026-12-24":"tadbulb|base|938|main","2026-12-25":"hippopotas|base|449|main","2026-12-26":"caterpie|base|10|main","2026-12-27":"aegislash-shield|base|681|main","2026-12-28":"staraptor|base|398|main","2026-12-29":"tyrantrum|base|697|main","2026-12-30":"servine|base|496|main","2026-12-31":"zangoose|base|335|main"};
const dailyScheduleEntryById=id=>id?entries.find(e=>e.id===id)||null:null;
function dailyFrozenEntryForDate(key){
  const fixedId=DAILY_CATCH_SCHEDULE_2026[key];
  if(fixedId)return dailyScheduleEntryById(fixedId);
  const frozenPool=DAILY_CATCH_POOL_IDS.map(dailyScheduleEntryById).filter(Boolean);
  if(!frozenPool.length)return null;
  const ordered=seededDailyOrder(frozenPool,key);
  const previousKey=addDays(key,-1);
  const previous=dailyEntryCache.get(previousKey)||dailyFrozenEntryForDate(previousKey);
  const previousBiomes=previous?dailyBiomeKeys(previous):new Set();
  for(const candidate of ordered){
    if(previous&&sameEvolutionFamily(candidate,previous))continue;
    const biomes=dailyBiomeKeys(candidate);
    if(previousBiomes.size&&biomes.size&&[...biomes].some(b=>previousBiomes.has(b)))continue;
    return candidate;
  }
  return ordered[0]||null;
}

  const monthName = (year,month) => new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(new Date(year,month,1));
  const compareDateKey = (a,b) => a===b?0:(a<b?-1:1);
  const monthDays = (year,month) => new Date(year,month+1,0).getDate();
  const dailyEligibleEntries = () => dailyEligibleCache ||= mainEntries().filter(isDailyEligible);
  const dailyEntryForDate = key => {
    if(dailyEntryCache.has(key)) return dailyEntryCache.get(key);
    const fixed=dailyFrozenEntryForDate(key);
    if(fixed){ dailyEntryCache.set(key,fixed); return fixed; }
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
    queryAll('[data-daily-date]').forEach(b=>b.addEventListener('click',(ev)=>{
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
    const specialKeys=['vivillon','unown','furfrou','flabebe','minior','cobblemon-unique','arbok-patterns','minecraft-forms','magikarp-jump'];
    const specialNames={vivillon:'Vivillon',unown:'Unown',furfrou:'Furfrou',flabebe:'Flabebe lijn',minior:'Minior','cobblemon-unique':'Cobblemon Unique','arbok-patterns':'Arbok Patterns','minecraft-forms':'Minecraft Forms','magikarp-jump':'Jump Patterns'};
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
      queryAll('#trainingQuestion .quiz-choice').forEach(b=>b.onclick=()=>answer(b));
    }
    function answer(btn){if(trainingSession.answered)return;trainingSession.answered=true;trainingSession.total++;const elapsed=Math.max(0,Date.now()-(trainingSession.questionStartedAt||Date.now()));trainingSession.totalTimeMs=(trainingSession.totalTimeMs||0)+elapsed;trainingSession.times=(trainingSession.times||[]);trainingSession.times.push(elapsed);trainingSession.bestTimeMs=trainingSession.bestTimeMs==null?elapsed:Math.min(trainingSession.bestTimeMs,elapsed);if(elapsed<5000)trainingSession.fastAnswers=(trainingSession.fastAnswers||0)+1;const ok=btn.dataset.answer===String(trainingSession.q.correct);if(ok){trainingSession.score++;trainingSession.streak++;btn.classList.add('correct');}else{trainingSession.streak=0;btn.classList.add('wrong');queryAll('#trainingQuestion .quiz-choice').forEach(b=>{if(b.dataset.answer===String(trainingSession.q.correct))b.classList.add('correct');});}$('#trainingScore').textContent=trainingSession.score;$('#trainingStreak').textContent=trainingSession.streak;$('#trainingFeedback').textContent=ok?`${assistantName()}: Correct!`:`${assistantName()}: The answer was ${mode==='type'?typeLabel(trainingSession.q.correct):mode==='generation'?`Generation ${generationName(Number(trainingSession.q.correct))}`:trainingSession.q.correct}.`;$('#trainingNext').textContent=trainingSession.total>=10?'Finish':'Next question';$('#trainingNext').hidden=false;}
    function finish(){const key=mode;trainingStats[key]??={questions:0,correct:0,best:0};const ss=trainingStats[key];ss.questions+=trainingSession.total;ss.correct+=trainingSession.score;ss.best=Math.max(ss.best||0,trainingSession.score);ss.totalTimeMs=Number(ss.totalTimeMs||0)+Number(trainingSession.totalTimeMs||0);ss.timedQuestions=Number(ss.timedQuestions||0)+Number(trainingSession.total||0);ss.bestTimeMs=ss.bestTimeMs==null?trainingSession.bestTimeMs:Math.min(Number(ss.bestTimeMs),Number(trainingSession.bestTimeMs));ss.bestSessionTimeMs=ss.bestSessionTimeMs==null?Number(trainingSession.totalTimeMs||0):Math.min(Number(ss.bestSessionTimeMs),Number(trainingSession.totalTimeMs||0));trainingStats.__trainingSessions=Number(trainingStats.__trainingSessions||0)+1;trainingStats.__fastAnswers=Number(trainingStats.__fastAnswers||0)+Number(trainingSession.fastAnswers||0);trainingStats.__totalTimeMs=Number(trainingStats.__totalTimeMs||0)+Number(trainingSession.totalTimeMs||0);trainingStats.__timedQuestions=Number(trainingStats.__timedQuestions||0)+Number(trainingSession.total||0);trainingStats.__bestTimeMs=trainingStats.__bestTimeMs==null?trainingSession.bestTimeMs:Math.min(Number(trainingStats.__bestTimeMs),Number(trainingSession.bestTimeMs));trainingStats.__bestSessionTimeMs=trainingStats.__bestSessionTimeMs==null?Number(trainingSession.totalTimeMs||0):Math.min(Number(trainingStats.__bestSessionTimeMs),Number(trainingSession.totalTimeMs||0));if(trainingSession.score===10)trainingStats.__perfectSessions=Number(trainingStats.__perfectSessions||0)+1;recordActivity('training_complete',{mode,score:trainingSession.score,total:trainingSession.total});saveTraining();overlay.remove();renderTraining();}
    draw();
  }
  function renderTraining(){
    const labels={who:["Who's That Pokémon?",'Identify Pokémon from their sprite.'],type:['Type Learner','Learn weaknesses, resistances and super-effective matchups.'],evolution:['Evolution Training','Practice evolution relationships.'],pokedex:['Pokédex Training','Learn numbers and LivingDex order.'],generation:['Generation Training','Practice which generation each Pokémon belongs to.']};
    const sum=trainingSummary();
    const cards=Object.entries(labels).map(([k,v])=>{const ss=trainingStats[k]||{};const acc=ss.questions?pct(ss.correct||0,ss.questions):0;return `<article class="training-card"><div class="training-card-icon">${{who:'?',type:'T',evolution:'↗',pokedex:'#',generation:'G'}[k]}</div><div><div class="eyebrow">TRAINING</div><h3>${v[0]}</h3><p>${v[1]}</p><div class="training-statline"><span>Best <b>${ss.best||0}/10</b></span><span>Accuracy <b>${acc}%</b></span><span>Questions <b>${ss.questions||0}</b></span><span>Avg <b>${ss.timedQuestions?((ss.totalTimeMs/ss.timedQuestions)/1000).toFixed(2)+'s':'—'}</b></span><span>Best Time <b>${ss.bestTimeMs!=null?(ss.bestTimeMs/1000).toFixed(2)+'s':'—'}</b></span><span>Rank <b>${trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=95?'Master':trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=85?'Platinum':trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=75?'Gold':trainingSummaryFrom(trainingStats).modeSummary?.[k]?.accuracy>=60?'Silver':'Bronze'}</b></span></div></div><button class="primary training-start" data-training="${k}">Start</button></article>`;}).join('');
    $('#view').innerHTML=`<div class="page-card training-page v14-training"><div class="page-title"><div><div class="eyebrow">TRAINER SCHOOL</div><h2>Training</h2><p>Test your Pokémon knowledge and build your skills.</p></div><div class="training-rank-card"><span class="eyebrow">TRAINING RANK</span><strong>${sum.rank}</strong><small>${sum.totalCorrect} correct · ${sum.accuracy}% accuracy</small></div></div><div class="training-overview-grid"><div><b>${sum.totalQuestions}</b><span>Questions answered</span></div><div><b>${sum.totalCorrect}</b><span>Correct answers</span></div><div><b>${sum.accuracy}%</b><span>Overall accuracy</span></div><div><b>${sum.bestScore}/10</b><span>Best score</span></div><div><b>${sum.perfectModes}</b><span>Perfect modes</span></div><div><b>${sum.totalSessions}</b><span>Sessions</span></div><div><b>${sum.fastAnswers}</b><span>Fast answers</span></div><div><b>${trainingStats.__timedQuestions?((trainingStats.__totalTimeMs/trainingStats.__timedQuestions)/1000).toFixed(2)+'s':'—'}</b><span>Average time</span></div><div><b>${trainingStats.__bestTimeMs!=null?(trainingStats.__bestTimeMs/1000).toFixed(2)+'s':'—'}</b><span>Fastest answer</span></div></div><div class="training-grid">${cards}</div></div>`;
        queryAll('.training-start').forEach(b=>b.onclick=()=>startTraining(b.dataset.training));
  }
  // Type Knowledge is now reference-only. Quiz lives under Training.
  window.renderTypeKnowledge = function(){
    const selected=window.knowledgeTypes||[]; const q=norm(window.knowledgeQuery||''); const shown=TYPES.filter(t=>!q||norm(typeLabel(t)).includes(q)).slice(0,20); const defTypes=selected.length?selected:['Fire'];
    const rows=TYPES.map(t=>({type:t,m:effectiveness(defTypes,t)})); const weak=rows.filter(x=>x.m>1), resist=rows.filter(x=>x.m>0&&x.m<1), immune=rows.filter(x=>x.m===0);
    const chips=a=>a.map(x=>`<span class="knowledge-chip" style="${typeStyle(x.type)}">${escHtml(typeLabel(x.type))}<small>${x.m===0?'×0':x.m>=4?`${x.m}×`:x.m>1?'×2':x.m<1?'×½':'×1'}</small></span>`).join('')||'<span class="muted-dash">None</span>';
    $('#view').innerHTML=`<div class="page-card knowledge-page"><div class="page-title"><div><div class="eyebrow">TYPE DATABASE</div><h2>Type Knowledge</h2><p>Study exact type matchups. Training quizzes are now under Training.</p></div></div><div class="knowledge-selector"><div class="knowledge-search"><span>⌕</span><input id="knowledgeSearch" value="${escHtml(q)}" placeholder="Search types..."></div><div class="knowledge-selected-row">${selected.map(t=>`<button class="knowledge-selected" data-remove-type="${t}" style="${typeStyle(t)}">${escHtml(typeLabel(t))} ×</button>`).join('')||'<span class="selector-hint">Select up to two types</span>'}</div><div class="knowledge-options">${shown.map(t=>`<button class="knowledge-option ${selected.includes(t)?'selected':''}" data-add-type="${t}" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</button>`).join('')}</div></div><div class="knowledge-hero">${defTypes.map(t=>`<span class="big-type" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</span>`).join('<span class="combo-slash">/</span>')}<div><span class="eyebrow">DEFENSIVE PROFILE</span><h3>${escHtml(defTypes.map(typeLabel).join(' / '))}</h3><p>How attacking types interact with this combination.</p></div></div><div class="knowledge-columns"><section class="knowledge-panel offensive"><div class="panel-heading"><div><span class="eyebrow">ATTACKING</span><h3>Super effective</h3></div></div><div class="chip-cloud">${chips(weak)}</div><div class="knowledge-sub"><h4>Not very effective</h4><div class="chip-cloud">${chips(resist)}</div></div><div class="knowledge-sub"><h4>No effect</h4><div class="chip-cloud">${chips(immune)}</div></div></section><section class="knowledge-panel defensive"><div class="panel-heading"><div><span class="eyebrow">MULTIPLIERS</span><h3>Full matchup</h3></div></div><div class="type-multiplier-grid">${rows.map(x=>`<div class="type-multiplier"><span class="knowledge-chip mini" style="${typeStyle(x.type)}">${escHtml(typeLabel(x.type))}</span><strong>${x.m===0?'×0':x.m===1?'×1':x.m+'×'}</strong></div>`).join('')}</div></section></div></div>`;
    $('#knowledgeSearch').oninput=e=>{window.knowledgeQuery=e.target.value;renderTypeKnowledge();};
    queryAll('[data-add-type]').forEach(b=>b.onclick=()=>{const t=b.dataset.addType;if(selected.includes(t))window.knowledgeTypes=selected.filter(x=>x!==t);else if(selected.length<2)window.knowledgeTypes=[...selected,t];renderTypeKnowledge();});
    queryAll('[data-remove-type]').forEach(b=>b.onclick=()=>{window.knowledgeTypes=selected.filter(x=>x!==b.dataset.removeType);renderTypeKnowledge();});
  };

  // ================================================================
  // V2.0.0 — TRAINER OS FOUNDATION
  // New shell/navigation/home layered over the stable V1.7.15 core.
  // ================================================================
  const V2_NAV = [
    ['home','⌂','Home'],
    ['activity','≡','Feed'],
    ['dex','▦','LivingDex'],
    ['pokesnack','❖','PokéSnack Maker'],
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
    const primary=V2_NAV.filter(x=>['home','activity','dex','pokesnack','daily','training','team','types'].includes(x[0]));
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
    const resolvedEntry=v2FeedEntry({
      entryId:a?.entryId,entry_id:a?.entry_id,
      pokemonEntryId:a?.pokemonEntryId,pokemon_entry_id:a?.pokemon_entry_id,
      name:a?.name,entryName:a?.entryName,entry_name:a?.entry_name
    });
    const resolvedSource=v2FeedEntry({
      entryId:a?.sourceEntryId,entry_id:a?.source_entry_id,
      oldEntryId:a?.oldEntryId,old_entry_id:a?.old_entry_id,
      name:a?.sourceName,entryName:a?.sourceName,sourceName:a?.sourceName,source_name:a?.source_name
    });
    const name=resolvedEntry?.name||a?.name||a?.entryName||'';
    const source=resolvedSource?.name||a?.sourceName||'';
    switch(a?.type){
      case 'caught': return name?(a?.shiny?`Caught a shiny ${name} ✨`:`Caught ${name}`):(a?.shiny?'Caught a shiny Pokémon ✨':'Caught a Pokémon');
      case 'shiny_caught': return name?`Found a shiny ${name} ✨`:'Found a shiny Pokémon ✨';
      case 'shiny_added': return name?`Added another shiny ${name} ✨`:'Added another shiny Pokémon ✨';
      case 'shiny_uncaught': return name?`Removed shiny ${name} from the collection`:'Removed a shiny Pokémon from the collection';
      case 'uncaught': return name?`Removed ${name} from the collection`:'Removed a Pokémon from the collection';
      case 'favorite': return name?`Added ${name} to favorites`:'Added a favorite';
      case 'unfavorite': return name?`Removed ${name} from favorites`:'Removed a favorite';
      case 'evolved': return source&&name?`${source} evolved into ${name}`:name?`Evolved into ${name}`:'Completed an evolution';
      case 'traded': return source&&name?`Traded ${source} for ${name}`:name?`Traded for ${name}`:'Completed a trade';
      case 'daily_complete': return name?`Completed today’s Daily Catch by catching ${name}`:'Completed today’s Daily Catch';
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
  function v2FeedIcon(a){return a?.type==='caught'?'✦':a?.type?.startsWith('shiny_')?'✨':a?.type==='evolved'?'↗':a?.type==='traded'?'⇄':a?.type==='training_complete'?'⚔':a?.type?.startsWith('daily')?'★':'•';}
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
    const candidates=[
      a?.entryId,a?.entry_id,a?.pokemonEntryId,a?.pokemon_entry_id,
      a?.oldEntryId,a?.old_entry_id,a?.sourceEntryId,a?.source_entry_id,
      a?.name,a?.entryName,a?.entry_name,a?.sourceName,a?.source_name
    ].filter(v=>v!==undefined&&v!==null&&String(v).trim()!=='');
    for(const candidate of candidates){
      const value=String(candidate).trim();
      const lower=value.toLowerCase();
      let e=entries.find(x=>String(x.id).trim().toLowerCase()===lower);
      if(!e)e=entries.find(x=>String(x.name).trim().toLowerCase()===lower);
      if(e)return e;

      // Minecraft activity created by the bridge stores technical LivingDex IDs
      // such as "pineco|base|204|main" in name/sourceName.  Older rows can
      // therefore bypass the normal entry lookup.  Build a safe display entry
      // from that ID so the feed never prints the raw technical identifier.
      if(value.includes('|')){
        const parts=value.split('|');
        const raw=String(parts[0]||'').trim();
        const dex=Number(parts[2]||0)||0;
        let slug=raw;
        if(slug.startsWith('regional-'))slug=slug.slice(9);
        const formPart=String(parts[1]||'').trim();
        const regional=slug.match(/^(.*?)-(alola|galar|hisui|paldea)$/i);
        if(regional)slug=regional[1];
        const pretty=slug.replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
        const fallback={id:value,dex,name:pretty,raw:slug,form:regional?regional[2]:formPart,sprite:''};
        return fallback;
      }
    }
    return null;
  }
  function v2EvolutionMedia(a){
    const from=v2FeedEntry({
      entryId:a?.sourceEntryId,entry_id:a?.source_entry_id,
      oldEntryId:a?.oldEntryId,old_entry_id:a?.old_entry_id,
      name:a?.sourceName,entryName:a?.sourceName
    });
    const to=v2FeedEntry({
      entryId:a?.entryId,entry_id:a?.entry_id,
      name:a?.name,entryName:a?.entryName
    });
    if(!from&&!to)return '';
    const fromShiny=!!(a?.sourceShiny||a?.from_shiny);
    const toShiny=!!(a?.shiny||a?.to_shiny);
    const fromSrc=from?(fromShiny?shinySpritePath(from):spritePath(from)):'';
    const toSrc=to?(toShiny?shinySpritePath(to):spritePath(to)):'';
    return `<div class="v2-evolution-media">${from?`<div class="v2-evolution-pokemon"><img loading="lazy" decoding="async" src="${escHtml(fromSrc)}" alt="${escHtml(from.name)}${fromShiny?' shiny':''}"><span>${escHtml(from.name)}${fromShiny?' ✨':''}</span></div>`:''}<div class="v2-evolution-arrow">→</div>${to?`<div class="v2-evolution-pokemon"><img loading="lazy" decoding="async" src="${escHtml(toSrc)}" alt="${escHtml(to.name)}${toShiny?' shiny':''}"><span>${escHtml(to.name)}${toShiny?' ✨':''}</span></div>`:''}</div>`;
  }
  function v2FeedMedia(a){
    if(a?.type==='evolved')return v2EvolutionMedia(a);
    const e=v2FeedEntry(a);
    if(!e)return '';
    const src=a?.shiny?shinySpritePath(e):spritePath(e);
    return `<div class="v2-feed-pokemon-media ${a?.shiny?'is-shiny':''}"><div class="v2-feed-pokemon-glow"></div><img loading="lazy" decoding="async" src="${escHtml(src)}" alt="${escHtml(e.name)}${a?.shiny?' shiny':''}"><span>#${escHtml(String(e.num||e.id||''))}${a?.shiny?' · ✨ SHINY':''}</span></div>`;
  }
  function v2TradeMarkup(a){
    const from=v2FeedEntry({entryId:a.sourceEntryId,name:a.sourceName}),to=v2FeedEntry({entryId:a.entryId,name:a.name});
    const leftName=a.trainerName||'Trainer',rightName=a.tradePartnerName||'Unknown Trainer';
    const fromSrc=from?(a.sourceShiny?shinySpritePath(from):spritePath(from)):'';
    const toSrc=to?(a.shiny?shinySpritePath(to):spritePath(to)):'';
    return `<div class="v2-linked-trade"><div class="v2-linked-trainer"><span>${escHtml(leftName)}</span>${from?`<img loading="lazy" decoding="async" src="${escHtml(fromSrc)}" alt="${escHtml(from.name)}${a.sourceShiny?' shiny':''}">`:''}<b>${escHtml(from?.name||a.sourceName||'Pokémon')}${a.sourceShiny?' ✨':''}</b></div><div class="v2-linked-arrow">⇄</div><div class="v2-linked-trainer"><span>${escHtml(rightName)}</span>${to?`<img loading="lazy" decoding="async" src="${escHtml(toSrc)}" alt="${escHtml(to.name)}${a.shiny?' shiny':''}">`:''}<b>${escHtml(to?.name||a.name||'Pokémon')}${a.shiny?' ✨':''}</b></div></div>`;
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
    // Server-state sync must never hold up the Feed itself. It can update in the background.
    try{Promise.resolve(window.syncTrainerTradeStateV28?.()).catch(()=>{});}catch{}
    const now=Date.now();
    let posts;
    if(v2FeedRowsCache&&now-v2FeedRowsCacheAt<10000){ posts=v2FeedRowsCache.posts; }
    else {
      // Feed rendering must never depend on Community Posts or any secondary
      // Supabase query. The public activity RPC is the primary Feed source.
      // A slow/hung community query used to prevent the entire Feed from
      // rendering at all.
      // The primary RPC is also time-bounded. A stalled network request must
      // never make the Feed navigation appear broken.
      let globalRows=[];
      try{
        // getGlobalActivityV17 already has its own network timeout. Do not
        // race it here: doing so can render the Feed from an empty cache while
        // the real RPC response is still in flight.
        globalRows=await v2LoadGlobalActivity();
      }catch(err){console.warn('Global activity unavailable:',err);}
      // Paint the primary global activity immediately. Community posts are
      // secondary and are loaded only after the real activity rows are visible.
      posts=[];
      v2FeedRowsCache={posts,global:Array.isArray(globalRows)?globalRows:v2GlobalActivityRows()};
      v2FeedRowsCacheAt=Date.now();
    }
    if(!posts) posts=[];
    if(v2FeedRowsCache && !v2FeedRowsCache.global) v2FeedRowsCache.global=v2GlobalActivityRows();
    const rawActivityRows=(v2FeedRowsCache?.global||v2GlobalActivityRows()).filter(a=>!['team_add','team_remove'].includes(a?.type)).map(a=>({...a,__community:false,activity_id:a.id}));
    const seenLinkedTrades=new Set(); const activityRows=rawActivityRows.filter(a=>{
      if(a.type!=='traded')return true;
      const tradeKey=a.linkedTradeId||a.minecraftEventId||a.minecraft_event_id||'';
      if(!tradeKey)return true;
      const k=String(tradeKey);
      if(seenLinkedTrades.has(k))return false;
      seenLinkedTrades.add(k);
      return true;
    });
    const postRows=posts.map(a=>({...a,__community:true}));
    let rows=[...activityRows,...postRows].filter(v2FeedFilterMatch).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
    rows=v2CollapseDailyCatchRows(rows).slice(0,80);
    const ids=rows.map(a=>a.activity_id||a.id).filter(Boolean);

    const renderFeed=({comments=[],reactions=new Map()}={})=>{
      const byId=new Map();
      comments.forEach(c=>{const id=c.activity_id;if(!byId.has(id))byId.set(id,[]);byId.get(id).push(c);});
      const html=rows.length?rows.map(a=>{try{
        const id=a.activity_id||a.id, cs=byId.get(id)||[];
        if(a.__community)return v2CommunityPostMarkup(a,cs,reactions);
        const text=v2GlobalActivityText(a), e=v2FeedEntry(a), media=v2FeedMedia(a), reactionData=reactions.get(id)||{counts:{},mine:''};
        const actionLabel=a.type==='caught'?'CAUGHT':a.type==='evolved'?'EVOLVED':a.type==='traded'?'TRADE':a.type==='training_complete'?'TRAINING':a.type?.startsWith('daily')?'DAILY':'TRAINER UPDATE';
        const ownActivity=a.activityUserId===window.getCurrentTrainerIdV17?.();
        const deleteActivity=ownActivity?`<button type="button" class="v2-feed-delete" data-delete-activity="${escHtml(id)}" title="Delete post">Delete</button>`:'';
        return `<article class="v2-feed-post v2-social-post"><div class="v2-feed-post-top"><div class="v2-feed-author"><div class="v2-feed-avatar">${escHtml(String(a.trainerName||'Trainer').slice(0,1).toUpperCase())}</div><div><b>${a.type==='traded'?escHtml(a.trainerName||'Trainer')+' & '+escHtml(a.tradePartnerName||'Unknown Trainer'):escHtml(a.trainerName||'Trainer')}</b><small>${escHtml(v2FeedWhen(a))}</small></div></div><div class="v2-feed-post-head-actions"><span class="v2-feed-action-pill">${actionLabel}</span>${deleteActivity}</div></div><div class="v2-feed-copy"><strong>${a.type==='traded'?escHtml((a.trainerName||'Trainer')+' and '+(a.tradePartnerName||'Unknown Trainer')+' just had a trade.'):escHtml(text)}</strong>${a.type==='traded'?v2TradeMarkup(a):e?`<div class="v2-feed-pokemon-meta">${v2FeedMeta(a)}</div>`:''}</div>${a.type==='traded'?'':media}<div class="v2-feed-social-bar">${v2ReactionMarkup({id},reactionData)}<span class="v2-feed-comment-count">${cs.length} comments</span></div>${id?v2CommentMarkup({id},cs):''}</article>`;
      }catch(err){console.warn('Feed row render failed:',a,err);const id=a?.activity_id||a?.id||'';const trainer=escHtml(a?.trainerName||'Trainer');const action=escHtml(v2ActivityText(a));return `<article class="v2-feed-post v2-social-post"><div class="v2-feed-post-top"><div class="v2-feed-author"><div class="v2-feed-avatar">${escHtml(String(a?.trainerName||'T').slice(0,1).toUpperCase())}</div><div><b>${trainer}</b><small>${escHtml(v2FeedWhen(a))}</small></div></div><span class="v2-feed-action-pill">ACTIVITY</span></div><div class="v2-feed-copy"><strong>${action}</strong></div></article>`;}}).join(''):`<div class="v2-empty-feed"><strong>No posts here yet.</strong><span>Be the first Trainer to start the conversation.</span></div>`;
      $('#view').innerHTML=`<div class="page-card v2-rich-page v2-feed-page"><div class="v2-feed-hero"><div><div class="eyebrow">TRAINER COMMUNITY</div><h2>Feed</h2><p>Trade, find Pokémon, share discoveries and connect with other Trainers.</p></div><div class="v2-feed-hero-mark">✦<span>LIVE COMMUNITY</span></div></div>${v2CommunityFilters()}<div class="v2-feed-list">${html}</div></div>`;
      $('#v2CreateCommunityPost')?.addEventListener('click',v2CommunityPostComposer);
      queryAll('[data-feed-filter]').forEach(b=>b.onclick=()=>{v2FeedFilter=b.dataset.feedFilter;v2RenderFeed();});
      v2AttachFeedInteractions(document.querySelector('#view'));
      document.querySelectorAll('[data-community-help]').forEach(b=>b.onclick=()=>v2OpenTradeRequest(b.dataset.communityHelp));
    };

    // Paint the Feed from the primary activity RPC immediately.
    // Community posts and social metadata must never be allowed to delay this.
    renderFeed();

    if(!opts.skipCommunity){
      Promise.resolve().then(async()=>{
        try{
          const loadedPosts=await Promise.race([
            v2LoadCommunityPosts(),
            new Promise(resolve=>setTimeout(()=>resolve([]),2500))
          ]);
          if(!Array.isArray(loadedPosts))return;
          v2CommunityPostsCache=loadedPosts;
          if(v2FeedRowsCache){
            v2FeedRowsCache.posts=loadedPosts;
            v2FeedRowsCacheAt=Date.now();
          }
          // Repaint only after the primary Feed is already visible.
          await v2RenderFeed({silent:true,skipCommunity:true});
        }catch(err){console.warn('Community posts unavailable:',err);}
      });
    }

    v2StartFeedLive();

    // Comments + reactions are secondary; hydrate them after the Feed is visible.
    try{
      const social=await v2LoadFeedSocial(ids);
      renderFeed(social);
    }catch(err){console.warn('Feed social data unavailable:',err);}
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
    const tradeCard=n=>{const t=tradeMap.get(String(n.trainer_trade_id||''));if(!t)return '';const fromShiny=String(t.from_pokemon||'').startsWith('shiny:'),toShiny=String(t.to_pokemon||'').startsWith('shiny:'),fromId=fromShiny?String(t.from_pokemon).slice(6):t.from_pokemon,toId=toShiny?String(t.to_pokemon).slice(6):t.to_pokemon,from=entries.find(e=>String(e.id)===String(fromId)),to=entries.find(e=>String(e.id)===String(toId));return `<div class="v2-trade-notification-card"><div><span>${escHtml(t.from_trainer_name)}</span>${from?`<img src="${escHtml(fromShiny?shinySpritePath(from):spritePath(from))}" alt="">`:''}<b>${escHtml(from?.name||fromId)}${fromShiny?' ✨':''}</b></div><i>⇄</i><div><span>${escHtml(t.to_trainer_name)}</span>${to?`<img src="${escHtml(toShiny?shinySpritePath(to):spritePath(to))}" alt="">`:''}<b>${escHtml(to?.name||toId)}${toShiny?' ✨':''}</b></div></div>`;};
    wrap.innerHTML=`<div class="v2-community-modal v2-notifications-modal"><button class="info-close" data-close>×</button><div class="eyebrow">COMMUNITY</div><h2>Notifications ${unread?`<span class="v2-notification-count">${unread}</span>`:''}</h2><div class="v2-notification-list">${rows.length?rows.map(n=>{const isTrade=n.type==='trainer_trade_request',isDone=n.type==='trainer_trade_accepted',t=tradeMap.get(String(n.trainer_trade_id||''));return `<article class="v2-notification ${n.read?'read':'unread'}" data-notification="${escHtml(n.id)}"><div class="v2-notification-icon">${isTrade?'⇄':isDone?'✅':n.type==='trade_request'?'🤝':'🔔'}</div><div class="v2-notification-body"><b>${escHtml(n.title)}</b><p>${escHtml(n.body)}</p>${t?tradeCard(n):''}<small>${escHtml(n.created_at?new Date(n.created_at).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'')}</small>${isTrade&&t&&t.status==='pending'?`<div class="v2-notification-actions"><button data-linked-trade-action="accept" data-trade-id="${escHtml(t.id)}">Confirm trade</button><button data-linked-trade-action="decline" data-trade-id="${escHtml(t.id)}">Decline</button></div>`:n.type==='trade_request'&&!n.read?`<div class="v2-notification-actions"><button data-trade-action="accepted" data-trade-id="${escHtml(n.trade_request_id||'')}">Accept</button><button data-trade-action="declined" data-trade-id="${escHtml(n.trade_request_id||'')}">Decline</button></div>`:''}</div></article>`;}).join(''):`<div class="v2-empty-feed"><strong>All clear.</strong><span>No community notifications yet.</span></div>`}</div></div>`;
    document.body.appendChild(wrap);
    const unreadRows=rows.filter(n=>!n.read);
    if(unreadRows.length){
      await Promise.all(unreadRows.map(n=>window.markCommunityNotificationReadV18?.(n.id)));
      unreadRows.forEach(n=>wrap.querySelector(`[data-notification="${String(n.id).replace(/\"/g,'\\"')}"]`)?.classList.replace('unread','read'));
      wrap.querySelector('.v2-notification-count')?.remove();
      v2RefreshNotificationBell();
    }
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
    const draw=()=>{const q=norm($('#v2CommandInput').value);const list=actions.filter(a=>!q||norm(a[0]).includes(q));$('#v2CommandList').innerHTML=list.map(a=>`<button class="v2-command-item" data-cmd="${a[1]}"><span>${a[2]}</span>${a[0]}<kbd>↵</kbd></button>`).join('')||'<div class="v2-empty-feed">No matching action.</div>';queryAll('.v2-command-item').forEach(b=>b.onclick=()=>{el.hidden=true;v2Navigate(b.dataset.cmd);});};
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
    // db.js is intentionally loaded dynamically after the UI scripts. The Feed
    // must therefore wait briefly for its public loader instead of treating
    // "not defined yet" as a real empty Feed.
    let loader=window.getGlobalActivityV17;
    if(typeof loader!=='function'){
      const started=Date.now();
      while(typeof window.getGlobalActivityV17!=='function' && Date.now()-started<8000){
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      loader=window.getGlobalActivityV17;
    }
    if(typeof loader!=='function'){
      console.warn('Global activity loader was not ready after 8 seconds');
      return Array.isArray(window.__v2GlobalActivityCache)?window.__v2GlobalActivityCache:[];
    }
    try{
      const rows=await loader();
      window.__v2GlobalActivityCache=Array.isArray(rows)?rows:[];
      // Always return the freshly loaded rows. The Feed used to race this
      // loader against a timeout, which produced a blank Feed even when the
      // RPC itself had valid rows.
      if(view==='home'){
        const el=$('#v2HomeFeed');
        if(el && document.body.dataset.v2FeedMode==='global') v2RenderHomeFeed('global');
      }
      return window.__v2GlobalActivityCache;
    }catch(err){
      console.warn('Global activity unavailable',err);
      // Never overwrite a known-good cache with an empty array after a
      // transient request failure.
      return Array.isArray(window.__v2GlobalActivityCache)?window.__v2GlobalActivityCache:[];
    }
  }
  function v2CollapseDailyCatchRows(rows){
    const dailyRows=rows.filter(a=>a?.type==='daily_complete');
    if(!dailyRows.length)return rows;
    const sameEntry=(a,b)=>{
      const ea=v2FeedEntry(a), eb=v2FeedEntry(b);
      if(ea&&eb)return String(ea.id).toLowerCase()===String(eb.id).toLowerCase();
      return String(a?.entryId||a?.entry_id||'').toLowerCase()===String(b?.entryId||b?.entry_id||'').toLowerCase();
    };
    const sameDay=(a,b)=>{
      const ta=Number(a?.ts||0), tb=Number(b?.ts||0);
      if(!ta||!tb)return String(a?.date||'')===String(b?.date||'') && String(a?.date||'')!=='';
      return new Date(ta).toDateString()===new Date(tb).toDateString();
    };
    return rows.filter(a=>{
      if(a?.type!=='caught'&&a?.type!=='daily_duplicate')return true;
      return !dailyRows.some(d=>sameEntry(a,d)&&sameDay(a,d));
    });
  }
  function v2RenderHomeFeed(mode='personal'){
    const el=$('#v2HomeFeed'); if(!el)return;
    document.body.dataset.v2FeedMode=mode;
    let rows=[];
    if(mode==='global'){
      rows=v2GlobalActivityRows().filter(a=>!['team_add','team_remove'].includes(a?.type));
    }else{
      rows=(typeof activityLog==='function'?activityLog():[]).filter(a=>a&&a.type&&!['team_add','team_remove'].includes(a.type)).slice().sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
    }
    rows=v2CollapseDailyCatchRows(rows).slice(0,12);
    el.innerHTML=rows.length?rows.map(a=>`<div class="v2-feed-row"><span class="v2-feed-dot"></span><div class="v2-feed-row-main"><b>${escHtml(mode==='global'?v2GlobalActivityText(a):v2ActivityText(a))}</b><small>${escHtml(v2FeedWhen(a))}</small>${mode==='global'&&a.id?`<button class="v2-feed-comment-link" data-home-comment="${escHtml(a.id)}">Comment</button>`:''}</div></div>`).join(''):`<div class="v2-empty-feed">${mode==='global'?'No public player activity yet.':'Your Trainer activity will appear here as you play.'}</div>`;
    queryAll('#v2FeedPersonal,#v2FeedGlobal').forEach(b=>b.classList.toggle('active',(b.id==='v2FeedPersonal'&&mode==='personal')||(b.id==='v2FeedGlobal'&&mode==='global')));
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
    queryAll('[data-type-ring]').forEach(b=>b.addEventListener('click',()=>{selectedTypes=[b.dataset.typeRing];tab='main';page=1;query='';status='all';v2Navigate('dex');}));
    $('#v2QuickSearch')?.addEventListener('click',v2QuickSearch);
    $('#v2QuickStats')?.addEventListener('click',()=>v2Navigate('stats'));
    $('#v2QuickGoals')?.addEventListener('click',()=>v2Navigate('goals'));
    $('#v2QuickActivity')?.addEventListener('click',()=>v2Navigate('activity'));
  }
  window.renderV2Home=renderV2Home;
  window.v2Navigate=v2Navigate;
  window.v2CurrentView=()=>view;
  window.v2IconNav=v2IconNav;window.v2CurrentView=()=>view;


  // ================================================================
  // V2.0.39 — PokéSnack Maker simplified
  // Pokémon -> Target / Shiny -> exactly 2 recommended berry combinations.
  // ================================================================
  const SNACK_SEASONINGS = [
    {id:'chilan',name:'Chilan Berry',kind:'type',value:'normal'}, {id:'tanga',name:'Tanga Berry',kind:'type',value:'bug'},
    {id:'colbur',name:'Colbur Berry',kind:'type',value:'dark'}, {id:'haban',name:'Haban Berry',kind:'type',value:'dragon'},
    {id:'wacan',name:'Wacan Berry',kind:'type',value:'electric'}, {id:'roseli',name:'Roseli Berry',kind:'type',value:'fairy'},
    {id:'chople',name:'Chople Berry',kind:'type',value:'fighting'}, {id:'occa',name:'Occa Berry',kind:'type',value:'fire'},
    {id:'coba',name:'Coba Berry',kind:'type',value:'flying'}, {id:'kasib',name:'Kasib Berry',kind:'type',value:'ghost'},
    {id:'rindo',name:'Rindo Berry',kind:'type',value:'grass'}, {id:'shuca',name:'Shuca Berry',kind:'type',value:'ground'},
    {id:'yache',name:'Yache Berry',kind:'type',value:'ice'}, {id:'kebia',name:'Kebia Berry',kind:'type',value:'poison'},
    {id:'payapa',name:'Payapa Berry',kind:'type',value:'psychic'}, {id:'charti',name:'Charti Berry',kind:'type',value:'rock'},
    {id:'babiri',name:'Babiri Berry',kind:'type',value:'steel'}, {id:'passho',name:'Passho Berry',kind:'type',value:'water'},
    {id:'rawst',name:'Rawst Berry',kind:'egg',value:'field'}, {id:'pecha',name:'Pecha Berry',kind:'egg',value:'water 3|bug'},
    {id:'cheri',name:'Cheri Berry',kind:'egg',value:'grass|fairy'}, {id:'chesto',name:'Chesto Berry',kind:'egg',value:'human-like|flying'},
    {id:'aspear',name:'Aspear Berry',kind:'egg',value:'water 1|water 2'}, {id:'persim',name:'Persim Berry',kind:'egg',value:'mineral|amorphous'},
    {id:'lum',name:'Lum Berry',kind:'egg',value:'dragon|monster'}, {id:'starf',name:'Starf Berry',kind:'shiny',value:4}
  ];
  const snackSpecies=e=>speciesForEntry(e)||{};
  const snackTypesFor=e=>{const s=snackSpecies(e);return [...new Set([s.primaryType,s.secondaryType,...(Array.isArray(s.types)?s.types:[])].filter(Boolean).map(x=>String(x).toLowerCase()))]};
  const snackEggsFor=e=>(snackSpecies(e).eggGroups||[]).map(x=>String(x).toLowerCase().replace(/_/g,'-'));
  const snackMatch=(e,x)=>x.kind==='type'?snackTypesFor(e).includes(x.value):x.kind==='egg'?x.value.split('|').some(v=>snackEggsFor(e).includes(v)):x.kind==='shiny';
  const snackBerryIcon=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${id}-berry.png`;
  const snackBerryEffect=x=>{
    const effects={
      chilan:'10× Normal-type lure chance',tanga:'10× Bug-type lure chance',colbur:'10× Dark-type lure chance',haban:'10× Dragon-type lure chance',
      wacan:'10× Electric-type lure chance',roseli:'10× Fairy-type lure chance',chople:'10× Fighting-type lure chance',occa:'10× Fire-type lure chance',
      coba:'10× Flying-type lure chance',kasib:'10× Ghost-type lure chance',rindo:'10× Grass-type lure chance',shuca:'10× Ground-type lure chance',
      yache:'10× Ice-type lure chance',kebia:'10× Poison-type lure chance',payapa:'10× Psychic-type lure chance',charti:'10× Rock-type lure chance',
      babiri:'10× Steel-type lure chance',passho:'10× Water-type lure chance',rawst:'10× Field Egg Group lure chance',pecha:'10× Water 3 / Bug Egg Group lure chance',
      cheri:'10× Grass / Fairy Egg Group lure chance',chesto:'10× Human-Like / Flying Egg Group lure chance',aspear:'10× Water 1 / Water 2 Egg Group lure chance',
      persim:'10× Mineral / Amorphous Egg Group lure chance',lum:'10× Dragon / Monster Egg Group lure chance',starf:'5× shiny chance'
    };
    return effects[x.id]||'Bait seasoning effect applies to the Pokémon this snack targets.';
  };
  const snackBerryImage=x=>`<img class="snack-berry-icon" loading="lazy" decoding="async" src="${snackBerryIcon(x.id)}" alt="${escHtml(x.name)}" onerror="this.style.display='none'">`;
  const snackNorm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const snackTargetEntries=()=>entries.filter(e=>{const s=snackSpecies(e);return !!s&&s.name&&Number(e.dex)>0;});
  let snackTargetId=''; let snackQuery=''; let snackGoal='target';
  const snackEntry=()=>entryById(snackTargetId)||null;
  function snackRecipes(target,goal){
    if(!target)return [];
    const type=SNACK_SEASONINGS.filter(x=>x.kind==='type'&&snackMatch(target,x));
    const egg=SNACK_SEASONINGS.filter(x=>x.kind==='egg'&&snackMatch(target,x));
    const matches=[...type,...egg];
    const unique=[...new Map(matches.map(x=>[x.id,x])).values()];
    if(goal==='shiny'){
      const shiny=SNACK_SEASONINGS.find(x=>x.id==='starf');
      const a=unique[0]||SNACK_SEASONINGS.find(x=>x.id==='chilan');
      const b=unique[1]||unique[0]||SNACK_SEASONINGS.find(x=>x.id==='chilan');
      return [
        [shiny,a,a],
        [shiny,b,b]
      ].map((combo,i)=>({combo,title:`Shiny recipe ${i+1}`,desc:`Starf Berry boosts shiny rerolls while ${a===combo[1]?a.name:b.name} keeps the snack focused on ${target.name}.`}));
    }
    const first=unique[0]||SNACK_SEASONINGS.find(x=>x.id==='chilan');
    const second=unique[1]||unique[0]||SNACK_SEASONINGS.find(x=>x.id==='passho');
    const third=unique[2]||first;
    const combos=[ [first,first,second], [first,second,third] ];
    return combos.map((combo,i)=>({combo,title:`Target recipe ${i+1}`,desc:`Uses the berry effects that match ${target.name}'s ${snackTypesFor(target).join(' / ')||'target data'}.`}));
  }
  const snackRecipeCard=r=>`<article class="snack-recipe-card"><div class="snack-recipe-number">${r.title}</div><div class="snack-recipe-berries">${r.combo.map(x=>`<div class="snack-berry"><div>${snackBerryImage(x)}</div><b>${escHtml(x.name.replace(' Berry',''))}</b><small>${escHtml(snackBerryEffect(x))}</small></div>`).join('')}</div><p>${escHtml(r.desc)}</p></article>`;
  function renderPokeSnackMaker(){
    const targets=snackTargetEntries(); const target=snackEntry();
    const q=snackNorm(snackQuery); const shown=q?targets.filter(e=>snackNorm(e.name).includes(q)||String(e.dex).includes(q)).slice(0,18):[];
    const recipes=snackRecipes(target,snackGoal);
    $('#view').innerHTML=`<div class="page-card snack-maker-page"><section class="snack-hero"><div><span class="eyebrow">COBBLEMON • POKÉSNACK</span><h2>PokéSnack Maker</h2><p>Choose a Pokémon and get two simple berry combinations for your goal.</p></div><div class="snack-hero-berry">🍓</div></section><section class="snack-select-section"><div class="snack-search-wrap"><span>⌕</span><input id="snackTargetSearch" value="${escHtml(snackQuery)}" placeholder="Search Pokémon…" autocomplete="off"></div>${shown.length?`<div class="snack-search-results">${shown.map(e=>`<button type="button" data-snack-target="${escHtml(e.id)}"><img src="${escHtml(spritePath(e))}" alt=""><span><b>${escHtml(e.name)}</b><small>#${String(e.dex).padStart(3,'0')}</small></span></button>`).join('')}</div>`:''}${target?`<div class="snack-selected-pokemon"><img src="${escHtml(spritePath(target))}" alt="${escHtml(target.name)}"><div><span class="eyebrow">SELECTED POKÉMON</span><h3>${escHtml(target.name)}</h3><span>#${String(target.dex).padStart(3,'0')}</span></div><button type="button" class="secondary" id="snackChangePokemon">Change</button></div>`:`<div class="snack-empty-target">Search and choose a Pokémon to get started.</div>`}</section><section class="snack-goal-section"><div class="snack-goal-tabs"><button class="${snackGoal==='target'?'active':''}" data-snack-goal="target">🎯 Target</button><button class="${snackGoal==='shiny'?'active':''}" data-snack-goal="shiny">✨ Shiny</button></div>${target?`<div class="snack-goal-heading"><div><span class="eyebrow">${snackGoal==='shiny'?'SHINY RECIPES':'TARGET RECIPES'}</span><h3>${snackGoal==='shiny'?`Shiny ${escHtml(target.name)}`:`Attract ${escHtml(target.name)}`}</h3></div><span>2 combinations</span></div><div class="snack-recipe-grid">${recipes.map(snackRecipeCard).join('')}</div>`:`<div class="empty-panel">Choose a Pokémon first.</div>`}</section></div>`;
    const search=$('#snackTargetSearch'); search.oninput=e=>{snackQuery=e.target.value;renderPokeSnackMaker();const n=$('#snackTargetSearch');n?.focus();n?.setSelectionRange(n.value.length,n.value.length);};
    queryAll('[data-snack-target]').forEach(b=>b.onclick=()=>{snackTargetId=b.dataset.snackTarget;snackQuery='';renderPokeSnackMaker();});
    queryAll('[data-snack-goal]').forEach(b=>b.onclick=()=>{snackGoal=b.dataset.snackGoal;renderPokeSnackMaker();});
    $('#snackChangePokemon')?.addEventListener('click',()=>{snackTargetId='';snackQuery='';renderPokeSnackMaker();setTimeout(()=>$('#snackTargetSearch')?.focus(),0);});
  }
  window.renderPokeSnackMaker=renderPokeSnackMaker;

  window.renderTopNav = function(){
    const items=[['dex','LivingDex'],['pokesnack','PokéSnack Maker'],['daily','Catch Calendar'],['team','Team Builder'],['types','Type Knowledge'],['training','Training'],['achievements','Rewards'],['stats','Statistics'],['goals','Goals'],['activity','Activity']];
    $('#topNav').innerHTML=items.map(([k,n])=>`<button class="top-nav-btn ${view===k?'active':''}" data-view="${k}">${n}</button>`).join('');
    queryAll('.top-nav-btn').forEach(b=>b.onclick=()=>v2Navigate(b.dataset.view));
    v2IconNav(view);
  };
  window.renderView = function(){
    if(view==='home'){renderV2Home();return;}
    if(view==='dex'){
      const renderDexWhenReady=()=>{
        if(typeof window.renderDex==='function'){window.renderDex();return;}
        setTimeout(renderDexWhenReady,50);
      };
      renderDexWhenReady();
      return;
    }
    if(view==='pokesnack'){$('#dexView').hidden=true;$('#view').hidden=false;renderPokeSnackMaker();return;}
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

  async function showMinecraftLinkCode(){
    if(!window.isOnlineTrainerV17?.()){alert('Sign in to your LivingDex account first.');return;}
    const result=await window.createMinecraftLinkCodeV25?.();
    if(!result?.ok){alert(result?.error||'Could not create a Minecraft link code.');return;}
    const code=String(result.code||'');
    const wrap=document.createElement('div');
    wrap.className='online-modal-wrap';
    wrap.innerHTML=`<div class="online-modal minecraft-link-modal"><button class="info-close" data-close>×</button><div class="eyebrow">MINECRAFT CONNECTION</div><h2>Link your Minecraft account</h2><p>Open Minecraft and run this command while the LivingDex Bridge is installed on the server:</p><div class="minecraft-link-command"><code>/livingdex link ${escHtml(code)}</code><button class="secondary" id="copyMinecraftLink">Copy</button></div><p class="settings-note">This code expires in 15 minutes and can only be used once.</p></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-close]').onclick=()=>wrap.remove();
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
    wrap.querySelector('#copyMinecraftLink').onclick=async()=>{try{await navigator.clipboard.writeText(`/livingdex link ${code}`);wrap.querySelector('#copyMinecraftLink').textContent='Copied!';}catch{}};
  }

  function addBackupControls(){
    const menu=$('#settingsMenu'); if(!menu||$('#exportSaveBtn'))return;
    menu.insertAdjacentHTML('beforeend',`<div class="settings-divider"></div><div class="settings-heading">Minecraft</div><div class="settings-note">Link this Trainer to your Minecraft account. Minecraft catches, evolutions and completed trades are synced automatically from the server to your LivingDex.</div><div class="settings-save-actions"><button id="minecraftLinkBtn" class="secondary">Link Minecraft account</button></div><div class="settings-divider"></div><div class="settings-heading">Save data</div><div class="settings-note">Back up your caught Pokémon, favorites, notes, profile and training stats.</div><div class="settings-save-actions"><button id="exportSaveBtn" class="secondary">Export Save</button><button id="importSaveBtn" class="secondary">Import Save</button><input id="importSaveInput" type="file" accept="application/json" hidden></div>`);
    $('#minecraftLinkBtn').onclick=showMinecraftLinkCode;
    $('#exportSaveBtn').onclick=()=>{const payload={version:V11_VERSION,exportedAt:new Date().toISOString(),state,favorites,notes,team,profile:JSON.parse(localStorage.getItem('cobblemon-livingdex-profile')||'null'),training:trainingStats,theme:localStorage.getItem('livingdex-theme')||'dark'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${greetingName().replace(/[^A-Za-z0-9_-]+/g,'_')}_LivingDex_Save.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};
    $('#importSaveBtn').onclick=()=>$('#importSaveInput').click();
    $('#importSaveInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.state||typeof d.state!=='object')throw new Error('Invalid save');Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,d.state);Object.keys(favorites).forEach(k=>delete favorites[k]);Object.assign(favorites,d.favorites||{});Object.keys(notes).forEach(k=>delete notes[k]);Object.assign(notes,d.notes||{});team.splice(0,team.length,...(d.team||[]));if(d.profile)saveProfile(d.profile);trainingStats=d.training||{};saveAll();saveTraining();alert('Save imported successfully.');location.reload();}catch(err){alert('Could not import this save file.');}};
  }

  // Replace the settings label and add a compact trainer profile summary to Progress.
  const originalApplySettings=window.applySettings;
  window.applySettings=function(){if(originalApplySettings)originalApplySettings();addBackupControls();};

  // Boot V1.1 after the V1.0 app has loaded its data and local state.
  function boot(){
    document.title='Cobblemon LivingDex — V2.5';
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
    window.getPokemonCountV17=id=>pokemonCount(id);
    window.getShinyCountV17=id=>shinyCount(id);
    window.getShinyCountsV17=()=>({...shinyCounts()});
    window.setShinyCountV17=(id,count)=>setShinyCount(id,count);
    window.getShinySpritePathV17=e=>shinySpritePath(e);
    window.renderTopNav = renderTopNav;
    window.renderView = renderView;
    addBackupControls();
    v2CommunityNotificationBell();
    // Always boot into the LivingDex with the grid rendered immediately.
    // The V1.0 app initializes before this file loads, so explicitly render the
    // default view here as well; this prevents a blank first screen until the
    // LivingDex button is clicked.
    view='dex';
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
