/* Cobblemon LivingDex V1.1 - LivingDex Plus */
(() => {
  const V11_VERSION = '1.4.1';
  const adv = { generation:'all', type:'all', status:'all', special:'all' };
  let trainingSession = null;
  let trainingStats = JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}');

  const saveTraining = () => { localStorage.setItem('cobblemon-livingdex-training', JSON.stringify(trainingStats)); try { window.LivingDexOnline?.queueSave?.(); } catch {} };
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
  const pct = (a,b) => b ? Math.round(a / b * 100) : 0;
  const escHtml = s => typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Rich Pokémon detail view — V1.1 BETA 4.
  window.openInfo = function(id){
    const e=entries.find(x=>x.id===id); if(!e)return;
    const sp=speciesForEntry(e);
    if(!sp){
      $('#infoContent').innerHTML=`<div class="info-error">${T('noInfo')}</div>`;
    } else {
      // Navigate inside the collection the Pokémon was opened from.
      const collection=pageEntries(tab);
      const all=collection.length?collection:mainEntries();
      const idx=Math.max(0,all.findIndex(x=>x.id===e.id));
      const prev=all.length>1?all[(idx-1+all.length)%all.length]:null;
      const next=all.length>1?all[(idx+1)%all.length]:null;
      const types=entryTypes(e);
      const caught=!!state[e.id], fav=!!favorites[e.id];
      const variants=entries.filter(x=>Number(x.dex)===Number(e.dex)&&x.id!==e.id).sort(sortEntry);
      const gen=genFor(e);
      const location=e.box?`Box ${e.box} · slot ${e.slot||'—'}`:'Special collection';
      const collectionLabel=e.box?'Main LivingDex':(tab==='main'?'LivingDex':(DATA.pages?.[tab]?.title||tab||'Special collection'));
      const formsHtml=variants.length?`
        <div class="info-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">FORMS & VARIANTS</span><h3>Other entries for #${String(e.dex).padStart(3,'0')}</h3></div><span class="section-note">${variants.length} other ${variants.length===1?'entry':'entries'}</span></div>
        <div class="detail-forms">${variants.map(v=>`<button class="detail-form-card" data-detail-form="${escHtml(v.id)}"><img src="${spritePath(v)}" alt="${escHtml(v.name)}"><span><b>${escHtml(v.name)}</b><small>${escHtml(v.form||'Base form')}</small></span></button>`).join('')}</div>
      </div>`:'';
      const navHtml=all.length>1?`<div class="detail-nav"><button id="detailPrev">← Previous</button><span>${idx+1} / ${all.length}</span><button id="detailNext">Next →</button></div>`:'';
      $('#infoContent').innerHTML=`<div class="detail-hero">
        <div class="detail-art"><img src="${spritePath(e)}" alt="${escHtml(e.name)}"></div>
        <div class="detail-main">
          <div class="eyebrow">POKÉDEX #${String(e.dex).padStart(3,'0')}</div><h2>${escHtml(e.name)}</h2>
          ${e.form?`<p class="detail-form">${escHtml(e.form)}</p>`:''}
          <div class="types detail-types">${types.map(t=>`<span class="type" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</span>`).join('')}</div>
          <div class="detail-status"><span class="detail-status-pill ${caught?'is-caught':''}">${caught?'✓ Caught':'○ Missing'}</span><span class="detail-status-pill ${fav?'is-favorite':''}">${fav?'★ Favorite':'☆ Not favorite'}</span></div>
          <div class="detail-actions"><button id="detailCaught" class="${caught?'primary':'secondary'}">${caught?'✓ Caught':'Mark caught'}</button><button id="detailFav" class="secondary">${fav?'★ Favorite':'☆ Favorite'}</button><button id="detailTeam" class="secondary">${team.includes(e.id)?'✓ In Team':'＋ Add to Team'}</button></div>
        </div>
      </div>${navHtml}
      <div class="info-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">OVERVIEW</span><h3>Pokédex information</h3></div></div><div class="info-grid">
        <div class="info-item"><b>Generation</b><span>${gen?`Generation ${generationName(gen)}`:'Special / Cobblemon'}</span></div>
        <div class="info-item"><b>Collection</b><span>${escHtml(collectionLabel)}</span></div>
        <div class="info-item"><b>Location</b><span>${escHtml(location)}</span></div>
        <div class="info-item"><b>Height</b><span>${sp.height!=null?(Number(sp.height)/10).toFixed(1)+' m':'—'}</span></div>
        <div class="info-item"><b>Weight</b><span>${sp.weight!=null?(Number(sp.weight)/10).toFixed(1)+' kg':'—'}</span></div>
        <div class="info-item"><b>Abilities</b><span>${escHtml((sp.abilities||[]).join(', ')||'—')}</span></div>
      </div></div>${formsHtml}
      <div class="info-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">EVOLUTION</span><h3>Evolution line</h3></div></div>${evoHtml(e)}</div>
      <div class="info-tabs"><button class="info-tab active" data-panel="stats">Base stats</button><button class="info-tab" data-panel="spawn">Spawn</button><button class="info-tab" data-panel="breeding">Breeding</button><button class="info-tab" data-panel="notes">My note</button></div>
      <div class="info-panel active" data-panel-content="stats">${statHtml(sp)}</div>
      <div class="info-panel" data-panel-content="spawn">${localSpawn(e).length?localSpawn(e).map(spawnCard).join(''):`<div class="empty-panel">No standard Cobblemon spawn entry.</div>`}</div>
      <div class="info-panel" data-panel-content="breeding"><div class="info-grid"><div class="info-item"><b>Egg groups</b><span>${escHtml((sp.eggGroups||[]).map(prettyLabel).join(', ')||'—')}</span></div><div class="info-item"><b>Experience group</b><span>${escHtml(prettyLabel(sp.experienceGroup||'')||'—')}</span></div><div class="info-item"><b>Base friendship</b><span>${sp.baseFriendship??'—'}</span></div></div></div>
      <div class="info-panel" data-panel-content="notes"><textarea id="pokemonNote" class="note-box">${escHtml(notes[e.id]||'')}</textarea><button id="saveNote" class="primary note-save">Save note</button></div>`;
      bindInfoTabs();
      $('#detailCaught')?.addEventListener('click',()=>{if(state[e.id])delete state[e.id];else state[e.id]=true;saveAll();touchDailyCompletion();openInfo(e.id);render();});
      $('#detailFav')?.addEventListener('click',()=>{favorites[e.id]=!favorites[e.id];if(!favorites[e.id])delete favorites[e.id];saveAll();openInfo(e.id);});
      $('#detailTeam')?.addEventListener('click',()=>{
        if(team.includes(e.id)){
          toggleTeam(e.id);
          openInfo(e.id);
          return;
        }
        if(team.length>=6){
          alert('Your team is already full (6/6). Remove a Pokémon before adding another one.');
          return;
        }
        toggleTeam(e.id);
        openInfo(e.id);
      });
      $('#detailPrev')?.addEventListener('click',()=>prev&&openInfo(prev.id));
      $('#detailNext')?.addEventListener('click',()=>next&&openInfo(next.id));
      $('#saveNote')?.addEventListener('click',()=>{notes[e.id]=$('#pokemonNote').value;saveAll();$('#saveNote').textContent='Saved ✓';});
      $$('[data-detail-form]').forEach(b=>b.onclick=()=>openInfo(b.dataset.detailForm));
    }
    $('#infoOverlay').hidden=false;$('#infoDropdown').hidden=false;document.body.classList.add('modal-open');$('#infoDropdown').scrollTop=0;
  };

  // V1.4.1 Progress, Daily Dex and Milestones.
  const dailyDateKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDays = (key, delta) => { const d=new Date(`${key}T12:00:00`); d.setDate(d.getDate()+delta); return dailyDateKey(d); };
  const dailyStats = () => {
    trainingStats.__daily ||= { streak:0, bestStreak:0, lastCompleted:'', totalCompleted:0 };
    return trainingStats.__daily;
  };
  const DAILY_EXCLUDED_LABELS = new Set(['legendary','mythical','ultra_beast','paradox','restricted']);
  function isDailyEligible(e){
    if(!e?.box) return false;
    const sp=speciesForEntry(e);
    const labels=(sp?.labels||[]).map(x=>String(x).toLowerCase());
    return !labels.some(x=>DAILY_EXCLUDED_LABELS.has(x));
  }
  function dailyDexEntry(){
    const list=mainEntries().filter(isDailyEligible); if(!list.length)return null;
    const key=dailyDateKey(); let h=0; for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))>>>0;
    return list[h%list.length];
  }
  function normalizeDailyStreak(){
    const ds=dailyStats(), key=dailyDateKey();
    if(ds.lastCompleted && ds.lastCompleted!==key && ds.lastCompleted!==addDays(key,-1)){
      ds.streak=0;
      ds.lastCompleted='';
      ds._streakBeforeToday=0;
    }
    return ds;
  }
  function syncDailyCompletion(entry=dailyDexEntry()){
    const ds=normalizeDailyStreak(), key=dailyDateKey();
    const completed=!!(entry && state[entry.id]);
    if(completed && ds.lastCompleted!==key){
      ds._streakBeforeToday=Number(ds.streak||0);
      ds._lastCompletedBeforeToday=ds.lastCompleted||'';
      ds.streak=ds.lastCompleted===addDays(key,-1)?Math.max(1,Number(ds.streak||0)+1):1;
      ds.bestStreak=Math.max(Number(ds.bestStreak||0),Number(ds.streak||0));
      ds.lastCompleted=key;
      ds.totalCompleted=Number(ds.totalCompleted||0)+1;
      saveTraining();
      return true;
    }
    if(!completed && ds.lastCompleted===key){
      ds.lastCompleted=ds._lastCompletedBeforeToday||'';
      ds.streak=Number(ds._streakBeforeToday||0);
      ds.totalCompleted=Math.max(0,Number(ds.totalCompleted||0)-1);
      delete ds._lastCompletedBeforeToday;
      delete ds._streakBeforeToday;
      saveTraining();
      return true;
    }
    return false;
  }
  const touchDailyCompletion=syncDailyCompletion;
  function trainingSummaryFrom(sourceTraining=trainingStats){
    const modes=['who','type','evolution','pokedex','generation'];
    const totalQuestions=modes.reduce((n,k)=>n+Number(sourceTraining[k]?.questions||0),0);
    const totalCorrect=modes.reduce((n,k)=>n+Number(sourceTraining[k]?.correct||0),0);
    const bestScore=modes.reduce((m,k)=>Math.max(m,Number(sourceTraining[k]?.best||0)),0);
    const perfectModes=modes.filter(k=>Number(sourceTraining[k]?.best||0)>=10).length;
    const accuracy=totalQuestions?Math.round(totalCorrect/totalQuestions*100):0;
    const rank=totalCorrect>=300?'Master':totalCorrect>=150?'Ace':totalCorrect>=75?'Trainer':totalCorrect>=25?'Learner':'Rookie';
    return {totalQuestions,totalCorrect,bestScore,perfectModes,accuracy,rank};
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
  function collectionStats(){ return collectionStatsFrom(state,favorites,trainingStats); }
  function milestoneDefinitions(stats){
    const s=stats||collectionStats(), gens=s.generations||[], types=s.types||[];
    return [
      {id:'first-catch',icon:'⚡',name:'First Catch',desc:'Catch your first Pokémon.',unlocked:s.caught>=1},
      {id:'ten-caught',icon:'◈',name:'10 Caught',desc:'Catch 10 Pokémon.',unlocked:s.caught>=10},
      {id:'hundred-caught',icon:'◇',name:'100 Caught',desc:'Catch 100 Pokémon.',unlocked:s.caught>=100},
      {id:'two-fifty-caught',icon:'◈',name:'250 Caught',desc:'Catch 250 Pokémon.',unlocked:s.caught>=250},
      {id:'five-hundred-caught',icon:'✦',name:'500 Caught',desc:'Catch 500 Pokémon.',unlocked:s.caught>=500},
      {id:'thousand-caught',icon:'★',name:'1,000 Caught',desc:'Catch 1,000 Pokémon.',unlocked:s.caught>=1000},
      {id:'halfway',icon:'½',name:'Halfway There',desc:'Reach 50% of the complete collection.',unlocked:s.total>0&&s.caught/s.total>=.5},
      {id:'generation-master',icon:'Ⅰ',name:'Generation Master',desc:'Complete at least one generation.',unlocked:gens.some(x=>x.total>0&&x.got===x.total)},
      {id:'type-master',icon:'T',name:'Type Master',desc:'Complete at least one type.',unlocked:types.some(x=>x.total>0&&x.got===x.total)},
      {id:'full-box',icon:'▦',name:'Full Box',desc:'Complete an entire PC box.',unlocked:s.fullBoxes>=1},
      {id:'favorite-collector',icon:'★',name:'Favorite Collector',desc:'Mark 25 Pokémon as favorites.',unlocked:s.favoriteCount>=25},
      {id:'daily-3',icon:'🔥',name:'Daily Starter',desc:'Reach a 3-day Daily Dex streak.',unlocked:Number(s.daily?.bestStreak||0)>=3},
      {id:'daily-7',icon:'🔥',name:'Daily Dedication',desc:'Reach a 7-day Daily Dex streak.',unlocked:Number(s.daily?.bestStreak||0)>=7},
      {id:'daily-30',icon:'🔥',name:'Daily Legend',desc:'Reach a 30-day Daily Dex streak.',unlocked:Number(s.daily?.bestStreak||0)>=30},
      {id:'training-50',icon:'T',name:'Training Student',desc:'Answer 50 Training questions.',unlocked:Number(s.training?.totalQuestions||0)>=50},
      {id:'training-perfect',icon:'10',name:'Perfect Score',desc:'Score 10/10 in a Training mode.',unlocked:Number(s.training?.bestScore||0)>=10},
      {id:'training-master',icon:'M',name:'Training Master',desc:'Earn five perfect Training mode scores.',unlocked:Number(s.training?.perfectModes||0)>=5},
      {id:'livingdex-complete',icon:'◆',name:'LivingDex Complete',desc:'Catch the entire main LivingDex.',unlocked:s.mainTotal>0&&s.mainCaught===s.mainTotal}
    ];
  }
  window.getMilestoneDefinitions=milestoneDefinitions;
  window.getCollectionStatsV14=collectionStats;
  window.getCollectionStatsFromV14=collectionStatsFrom;
  window.getDailyStatsV14=()=>({...dailyStats()});
  window.getTrainingSummaryV14=trainingSummary;
  window.touchDailyCompletion=syncDailyCompletion;

  function renderProgressPlus(){
    syncDailyCompletion();
    const s=collectionStats(),main=s.main;
    const generations=Array.from({length:9},(_,i)=>i+1).map(g=>{const list=main.filter(e=>genFor(e)===g),got=list.filter(e=>state[e.id]).length;return {g,total:list.length,got,p:pct(got,list.length)};}).filter(x=>x.total);
    const types=TYPES.map(t=>{const list=main.filter(e=>entryTypes(e).includes(t)),got=list.filter(e=>state[e.id]).length;return {t,total:list.length,got,p:pct(got,list.length)};}).filter(x=>x.total);
    const specialKeys=['vivillon','unown','furfrou','floette','minior','cobblemon-unique','arbok-patterns','minecraft-forms','magikarp-jump'];
    const specialNames={vivillon:'Vivillon',unown:'Unown',furfrou:'Furfrou',floette:'Floette',minior:'Minior','cobblemon-unique':'Cobblemon Unique','arbok-patterns':'Arbok Patterns','minecraft-forms':'Minecraft Forms','magikarp-jump':'Magikarp & Gyarados Jump'};
    const special=specialKeys.map(k=>{const list=pageEntries(k),got=list.filter(e=>state[e.id]).length;return {name:specialNames[k],got,total:list.length,p:pct(got,list.length)}}).filter(x=>x.total);
    const s2={...s,generations,types}, d=s.daily, daily=dailyDexEntry(), dailyDone=!!(daily&&state[daily.id]);
    const milestones=milestoneDefinitions(s2), unlocked=milestones.filter(m=>m.unlocked).length;
    $('#view').innerHTML=`<div class="page-card progress-plus v14-progress">
      <div class="achievement-hero"><div><div class="eyebrow">COLLECTION DASHBOARD</div><h2>Progress</h2><p>${escHtml(greetingName())}'s complete LivingDex overview.</p></div><div class="achievement-total"><strong>${s.mainCaught}</strong><span>/ ${s.mainTotal} main caught</span><i style="width:${pct(s.mainCaught,s.mainTotal)}%"></i></div></div>
      <section class="progress-stat-grid"><div><b>${s.caught}</b><span>Total caught</span></div><div><b>${s.missing}</b><span>Total missing</span></div><div><b>${pct(s.caught,s.total)}%</b><span>Total complete</span></div><div><b>${s.favoriteCount}</b><span>Favorites</span></div><div><b>${s.fullBoxes}</b><span>Full boxes</span></div><div class="stat-accent"><b>${d.streak||0}</b><span>Daily streak</span></div></section>
      <section class="daily-dex-card ${dailyDone?'daily-complete':''}"><div class="daily-dex-art">${daily?`<img src="${spritePath(daily)}" alt="${escHtml(daily.name)}">`:''}</div><div class="daily-dex-copy"><span class="eyebrow">DAILY DEX • ${escHtml(dailyDateKey())}</span><h3>${daily?escHtml(daily.name):'Daily Dex'}</h3><p>${dailyDone?'Completed today. Keep the streak alive tomorrow.':'Complete today’s Daily Dex by having this Pokémon in your collection.'}</p><div class="daily-meta"><span class="daily-status">${dailyDone?'✓ Completed today':'○ Not completed today'}</span><span>🔥 ${d.streak||0} day streak</span><span>Best ${d.bestStreak||0}</span></div></div><button id="dailyDexView" class="secondary" ${daily?'':'disabled'}>View Pokémon</button></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">GENERATIONS</span><h3>Generation completion</h3></div><span class="section-note">${generations.filter(x=>x.got===x.total).length} / ${generations.length} complete</span></div><div class="progress-grid generation-progress">${generations.map(x=>`<article class="progress-card ${x.got===x.total?'progress-complete':''}"><div class="progress-card-top"><span>Generation ${generationName(x.g)}</span><strong>${x.got} / ${x.total}</strong></div><div class="progress-track"><i style="width:${x.p}%"></i></div><small>${x.p}% complete</small></article>`).join('')}</div></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">TYPES</span><h3>Completion per type</h3></div><span class="section-note">${types.filter(x=>x.got===x.total).length} / ${types.length} complete</span></div><div class="progress-grid type-progress">${types.map(x=>`<article class="progress-card ${x.got===x.total?'progress-complete':''}"><div class="progress-card-top"><span class="knowledge-chip mini" style="${typeStyle(x.t)}">${escHtml(typeLabel(x.t))}</span><strong>${x.got} / ${x.total}</strong></div><div class="progress-track"><i style="width:${x.p}%"></i></div><small>${x.p}% complete</small></article>`).join('')}</div></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">SPECIAL COLLECTIONS</span><h3>Special forms</h3></div></div><div class="progress-grid special-progress">${special.map(x=>`<article class="progress-card ${x.got===x.total?'progress-complete':''}"><div class="progress-card-top"><span>${escHtml(x.name)}</span><strong>${x.got} / ${x.total}</strong></div><div class="progress-track"><i style="width:${x.p}%"></i></div><small>${x.p}% complete</small></article>`).join('')}</div></section>
      <section class="progress-footer-grid"><article class="progress-summary-card"><div class="summary-icon">🏅</div><div><span class="eyebrow">MILESTONES</span><h3>${unlocked} / ${milestones.length} badges earned</h3><p>Badges for collection, Daily Dex and Training achievements.</p></div><button id="progressMilestones" class="secondary">View Milestones</button></article><article class="progress-summary-card"><div class="summary-icon">◎</div><div><span class="eyebrow">TRAINING</span><h3>${escHtml(s.training.rank)} Rank</h3><p>${s.training.totalQuestions} questions · ${s.training.accuracy}% accuracy · best ${s.training.bestScore}/10</p></div><button id="progressTraining" class="secondary">Open Training</button></article></section>
    </div>`;
    $('#dailyDexView')?.addEventListener('click',()=>daily&&openInfo(daily.id));
    $('#progressMilestones')?.addEventListener('click',()=>window.LivingDexNavigate?.('milestones'));
    $('#progressTraining')?.addEventListener('click',()=>window.LivingDexNavigate?.('training'));
  }
  function renderMilestones(){
    const main=mainEntries().filter(e=>e.box);
    const generations=Array.from({length:9},(_,i)=>i+1).map(g=>{const list=main.filter(e=>genFor(e)===g),got=list.filter(e=>state[e.id]).length;return {g,total:list.length,got};}).filter(x=>x.total);
    const types=TYPES.map(t=>{const list=main.filter(e=>entryTypes(e).includes(t)),got=list.filter(e=>state[e.id]).length;return {t,total:list.length,got};}).filter(x=>x.total);
    const s=collectionStats(), ms=milestoneDefinitions({...s,generations,types}), unlocked=ms.filter(m=>m.unlocked).length;
    $('#view').innerHTML=`<div class="page-card online-page milestones-page v14-page"><div class="achievement-hero"><div><div class="eyebrow">BADGE COLLECTION</div><h2>Milestones</h2><p>Earn badges through collection, Daily Dex and Training achievements.</p></div><div class="achievement-total"><strong>${unlocked}</strong><span>/ ${ms.length} earned</span><i style="width:${pct(unlocked,ms.length)}%"></i></div></div><div class="milestone-grid v14-milestones">${ms.map(m=>`<article class="milestone-badge ${m.unlocked?'unlocked':''}"><div class="badge-art">${escHtml(m.icon)}</div><div><b>${escHtml(m.name)}</b><p>${escHtml(m.desc)}</p></div><span class="badge-state">${m.unlocked?'EARNED':'LOCKED'}</span></article>`).join('')}</div></div>`;
  }
  // Training hub and quizzes.
  const shuffle=a=>a.slice().sort(()=>Math.random()-.5);
  const pickEntry=pool=>pool[Math.floor(Math.random()*pool.length)];
  function trainingQuestion(mode){
    const pool=mainEntries().filter(e=>entryTypes(e).length);
    const e=pickEntry(pool); let choices=[], prompt='', correct='';
    if(mode==='who'){
      correct=e.name; choices=shuffle([correct,...shuffle(pool.filter(x=>x.id!==e.id).map(x=>x.name)).slice(0,3)]); prompt='Who is this Pokémon?';
    } else if(mode==='type'){
      const def=entryTypes(e); const eff=TYPES.filter(t=>effectiveness(def,t)>1); correct=pickEntry(eff.length?eff:TYPES); choices=shuffle([correct,...shuffle(TYPES.filter(t=>t!==correct && !eff.includes(t))).slice(0,3)]); prompt=`Which attacking type is super effective against ${e.name}?`;
    } else if(mode==='evolution'){
      const basePool=mainEntries().filter(e=>e.box&&!e.form);
      const bySpecies=new Map();
      basePool.forEach(entry=>{const key=speciesKeyFromName(entry.raw||entry.name||'')||norm(entry.name||''); if(!bySpecies.has(key))bySpecies.set(key,entry);});
      const pairs=[];
      for(const [key,sp] of Object.entries(LOCAL_SPECIES)){
        if(!sp?.preEvolution) continue;
        const sourceKey=speciesKeyFromName(sp.preEvolution)||norm(sp.preEvolution).replace(/[^a-z0-9]+/g,'');
        const source=bySpecies.get(sourceKey), target=bySpecies.get(key);
        if(source&&target&&source.id!==target.id) pairs.push({source,target});
      }
      const pair=pickEntry(pairs);
      if(!pair){ return trainingQuestion('who'); }
      const target=pair.target; correct=pair.source.name;
      const distractorPool=basePool.filter(x=>x.id!==pair.source.id).map(x=>x.name);
      choices=shuffle([correct,...shuffle(distractorPool.filter(n=>n!==correct)).slice(0,3)]);
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
      if(trainingSession.total>=10){finish();return;} trainingSession.q=trainingQuestion(mode);trainingSession.answered=false;const q=trainingSession.q;
      $('#trainingTitle').textContent={who:"Who's That Pokémon?",type:'Type Learner',evolution:'Evolution Training',pokedex:'Pokédex Training',generation:'Generation Training'}[mode];
      const art=mode==='who'?`<div class="training-art"><img src="${spritePath(q.e)}"></div>`:mode==='evolution'?`<div class="training-target evolution-target"><div class="evolution-target-art"><img src="${spritePath(q.e)}"><span>Target Pokémon</span></div><div><b>${escHtml(q.e.name)}</b><small>${escHtml(q.prompt)}</small></div></div>`:`<div class="training-target"><img src="${spritePath(q.e)}"><div><b>${escHtml(q.prompt)}</b></div></div>`;
      $('#trainingQuestion').innerHTML=`${art}<div class="quiz-prompt">${mode==='who'?'':escHtml(q.prompt)}</div><div class="quiz-choices">${q.choices.map(c=>`<button class="quiz-choice" data-answer="${escHtml(c)}">${escHtml(mode==='type'?typeLabel(c):mode==='generation'?`Generation ${generationName(Number(c))}`:c)}</button>`).join('')}</div>`;
      $('#trainingFeedback').textContent='';$('#trainingNext').hidden=true;$('#trainingNumber').textContent=trainingSession.total+1;
      $$('#trainingQuestion .quiz-choice').forEach(b=>b.onclick=()=>answer(b));
    }
    function answer(btn){if(trainingSession.answered)return;trainingSession.answered=true;trainingSession.total++;const ok=btn.dataset.answer===String(trainingSession.q.correct);if(ok){trainingSession.score++;trainingSession.streak++;btn.classList.add('correct');}else{trainingSession.streak=0;btn.classList.add('wrong');$$('#trainingQuestion .quiz-choice').forEach(b=>{if(b.dataset.answer===String(trainingSession.q.correct))b.classList.add('correct');});}$('#trainingScore').textContent=trainingSession.score;$('#trainingStreak').textContent=trainingSession.streak;$('#trainingFeedback').textContent=ok?`${assistantName()}: Correct!`:`${assistantName()}: The answer was ${mode==='type'?typeLabel(trainingSession.q.correct):mode==='generation'?`Generation ${generationName(Number(trainingSession.q.correct))}`:trainingSession.q.correct}.`;$('#trainingNext').textContent=trainingSession.total>=10?'Finish':'Next question';$('#trainingNext').hidden=false;}
    function finish(){const key=mode;trainingStats[key]??={questions:0,correct:0,best:0};trainingStats[key].questions+=trainingSession.total;trainingStats[key].correct+=trainingSession.score;trainingStats[key].best=Math.max(trainingStats[key].best,trainingSession.score);saveTraining();overlay.remove();renderTraining();}
    draw();
  }
  function renderTraining(){
    const labels={who:["Who's That Pokémon?",'Identify Pokémon from their sprite.'],type:['Type Learner','Learn weaknesses, resistances and super-effective matchups.'],evolution:['Evolution Training','Practice evolution relationships.'],pokedex:['Pokédex Training','Learn numbers and LivingDex order.'],generation:['Generation Training','Practice which generation each Pokémon belongs to.']};
    const sum=trainingSummary();
    const cards=Object.entries(labels).map(([k,v])=>{const ss=trainingStats[k]||{};const acc=ss.questions?pct(ss.correct||0,ss.questions):0;return `<article class="training-card"><div class="training-card-icon">${{who:'?',type:'T',evolution:'↗',pokedex:'#',generation:'G'}[k]}</div><div><div class="eyebrow">TRAINING</div><h3>${v[0]}</h3><p>${v[1]}</p><div class="training-statline"><span>Best <b>${ss.best||0}/10</b></span><span>Accuracy <b>${acc}%</b></span><span>Questions <b>${ss.questions||0}</b></span></div></div><button class="primary training-start" data-training="${k}">Start</button></article>`;}).join('');
    $('#view').innerHTML=`<div class="page-card training-page v14-training"><div class="page-title"><div><div class="eyebrow">TRAINER SCHOOL</div><h2>Training</h2><p>Test your Pokémon knowledge and build your skills.</p></div><div class="training-rank-card"><span class="eyebrow">TRAINING RANK</span><strong>${sum.rank}</strong><small>${sum.totalCorrect} correct answers</small></div></div><div class="training-overview-grid"><div><b>${sum.totalQuestions}</b><span>Questions answered</span></div><div><b>${sum.totalCorrect}</b><span>Correct answers</span></div><div><b>${sum.accuracy}%</b><span>Overall accuracy</span></div><div><b>${sum.bestScore}/10</b><span>Best score</span></div><div><b>${sum.perfectModes}</b><span>Perfect modes</span></div></div><div class="training-grid">${cards}</div></div>`;
    $$('.training-start').forEach(b=>b.onclick=()=>startTraining(b.dataset.training));
  }

  // Type Information is now reference-only. Quiz lives under Training.
  window.renderTypeKnowledge = function(){
    const selected=window.knowledgeTypes||[]; const q=norm(window.knowledgeQuery||''); const shown=TYPES.filter(t=>!q||norm(typeLabel(t)).includes(q)).slice(0,20); const defTypes=selected.length?selected:['Fire'];
    const rows=TYPES.map(t=>({type:t,m:effectiveness(defTypes,t)})); const weak=rows.filter(x=>x.m>1), resist=rows.filter(x=>x.m>0&&x.m<1), immune=rows.filter(x=>x.m===0);
    const chips=a=>a.map(x=>`<span class="knowledge-chip" style="${typeStyle(x.type)}">${escHtml(typeLabel(x.type))}<small>${x.m===0?'×0':x.m>=4?`${x.m}×`:x.m>1?'×2':x.m<1?'×½':'×1'}</small></span>`).join('')||'<span class="muted-dash">None</span>';
    $('#view').innerHTML=`<div class="page-card knowledge-page"><div class="page-title"><div><div class="eyebrow">TYPE DATABASE</div><h2>Type Information</h2><p>Study exact type matchups. Training quizzes are now under Training.</p></div></div><div class="knowledge-selector"><div class="knowledge-search"><span>⌕</span><input id="knowledgeSearch" value="${escHtml(q)}" placeholder="Search types..."></div><div class="knowledge-selected-row">${selected.map(t=>`<button class="knowledge-selected" data-remove-type="${t}" style="${typeStyle(t)}">${escHtml(typeLabel(t))} ×</button>`).join('')||'<span class="selector-hint">Select up to two types</span>'}</div><div class="knowledge-options">${shown.map(t=>`<button class="knowledge-option ${selected.includes(t)?'selected':''}" data-add-type="${t}" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</button>`).join('')}</div></div><div class="knowledge-hero">${defTypes.map(t=>`<span class="big-type" style="${typeStyle(t)}">${escHtml(typeLabel(t))}</span>`).join('<span class="combo-slash">/</span>')}<div><span class="eyebrow">DEFENSIVE PROFILE</span><h3>${escHtml(defTypes.map(typeLabel).join(' / '))}</h3><p>How attacking types interact with this combination.</p></div></div><div class="knowledge-columns"><section class="knowledge-panel offensive"><div class="panel-heading"><div><span class="eyebrow">ATTACKING</span><h3>Super effective</h3></div></div><div class="chip-cloud">${chips(weak)}</div><div class="knowledge-sub"><h4>Not very effective</h4><div class="chip-cloud">${chips(resist)}</div></div><div class="knowledge-sub"><h4>No effect</h4><div class="chip-cloud">${chips(immune)}</div></div></section><section class="knowledge-panel defensive"><div class="panel-heading"><div><span class="eyebrow">MULTIPLIERS</span><h3>Full matchup</h3></div></div><div class="type-multiplier-grid">${rows.map(x=>`<div class="type-multiplier"><span class="knowledge-chip mini" style="${typeStyle(x.type)}">${escHtml(typeLabel(x.type))}</span><strong>${x.m===0?'×0':x.m===1?'×1':x.m+'×'}</strong></div>`).join('')}</div></section></div></div>`;
    $('#knowledgeSearch').oninput=e=>{window.knowledgeQuery=e.target.value;renderTypeKnowledge();};
    $$('[data-add-type]').forEach(b=>b.onclick=()=>{const t=b.dataset.addType;if(selected.includes(t))window.knowledgeTypes=selected.filter(x=>x!==t);else if(selected.length<2)window.knowledgeTypes=[...selected,t];renderTypeKnowledge();});
    $$('[data-remove-type]').forEach(b=>b.onclick=()=>{window.knowledgeTypes=selected.filter(x=>x!==b.dataset.removeType);renderTypeKnowledge();});
  };

  window.renderTopNav = function(){
    const items=[['dex','LivingDex'],['team','Team Builder'],['types','Type Information'],['training','Training'],['achievements','Progress']];
    $('#topNav').innerHTML=items.map(([k,n])=>`<button class="top-nav-btn ${view===k?'active':''}" data-view="${k}">${n}</button>`).join('');
    $$('.top-nav-btn').forEach(b=>b.onclick=()=>{closeInfo();view=b.dataset.view;renderTopNav();renderView();});
  };
  window.renderView = function(){
    if(view==='dex'){renderDex();return;}
    $('#dexView').hidden=true;$('#view').hidden=false;
    if(view==='team')renderTeam();
    else if(view==='types')renderTypeKnowledge();
    else if(view==='training')renderTraining();
    else if(view==='achievements')renderProgressPlus();
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
    document.title='Cobblemon LivingDex — V1.4';
    // Expose the V1.1/V1.2 views explicitly so the database layer and navigation
    // always call the same implementations.
    window.renderTraining = renderTraining;
    window.renderProgressPlus = renderProgressPlus;
    window.renderProgressV13 = renderProgressPlus;
    window.renderMilestones = renderMilestones;
    window.__dailyDexEntry = dailyDexEntry;
    window.renderTopNav = renderTopNav;
    window.renderView = renderView;
    addBackupControls();
    // Always boot into the LivingDex with the grid rendered immediately.
    // The V1.0 app initializes before this file loads, so explicitly render the
    // default view here as well; this prevents a blank first screen until the
    // LivingDex button is clicked.
    view='dex';
    renderTopNav();
    renderView();
    // Re-bind navigation with delegation. This prevents an older V1.0 handler
    // from swallowing the new Training/Progress views.
    document.addEventListener('click', e=>{
      const b=e.target.closest?.('.top-nav-btn');
      if(!b)return;
      const target=b.dataset.view;
      if(!['dex','team','types','training','achievements'].includes(target))return;
      e.preventDefault();
      closeInfo();
      view=target;
      window.renderTopNav();
      window.renderView();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && typeof closeFilterModal==='function')closeFilterModal();});
  }
  boot();
})();
