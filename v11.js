/* Cobblemon LivingDex V1.1 - LivingDex Plus */
(() => {
  const V11_VERSION = '1.1.0';
  const adv = { generation:'all', type:'all', status:'all', special:'all' };
  let trainingSession = null;
  let trainingStats = JSON.parse(localStorage.getItem('cobblemon-livingdex-training') || '{}');

  const saveTraining = () => localStorage.setItem('cobblemon-livingdex-training', JSON.stringify(trainingStats));
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

  // Advanced filters extend the existing search without changing the 6x5 PC layout.
  window.filtered = function() {
    let a = pageEntries(tab);
    if (query) {
      const r = boxSearchEntries(a);
      a = r.items;
      a = a.filter(e => {
        if (adv.generation !== 'all' && String(genFor(e)) !== adv.generation) return false;
        if (adv.type !== 'all' && !entryTypes(e).includes(adv.type)) return false;
        if (adv.status === 'caught' && !state[e.id]) return false;
        if (adv.status === 'missing' && state[e.id]) return false;
        if (adv.status === 'favorite' && !favorites[e.id]) return false;
        if (adv.special !== 'all' && adv.special !== 'main' && !pageEntries(adv.special).some(x=>x.id===e.id)) return false;
        if (adv.special === 'main' && !e.box) return false;
        return true;
      });
      return {items:a, matches:r.matches};
    }
    a = a.filter(e => {
      const c=!!state[e.id];
      if (status !== 'all' && ((status==='collected'&&!c) || (status==='missing'&&c) || (status==='favorites'&&!favorites[e.id]))) return false;
      if (!selectedTypeMatches(e)) return false;
      if (adv.generation !== 'all' && String(genFor(e)) !== adv.generation) return false;
      if (adv.type !== 'all' && !entryTypes(e).includes(adv.type)) return false;
      if (adv.status === 'caught' && !c) return false;
      if (adv.status === 'missing' && c) return false;
      if (adv.status === 'favorite' && !favorites[e.id]) return false;
      if (adv.special !== 'all' && adv.special !== 'main' && !pageEntries(adv.special).some(x=>x.id===e.id)) return false;
      if (adv.special === 'main' && !e.box) return false;
      return true;
    });
    return {items:a,matches:new Set()};
  };

  function addAdvancedFilterUI(){
    if (!document.querySelector('#advancedFilterBtn')) {
      const typesBtn = document.querySelector('#typesBtn');
      const b = document.createElement('button'); b.id='advancedFilterBtn'; b.className='types-btn'; b.textContent='Filters';
      typesBtn?.parentNode?.insertBefore(b, typesBtn);
      b.onclick=()=>openFilterModal();
    }
    if (!document.querySelector('#advancedFilterModal')) {
      const wrap=document.createElement('div'); wrap.innerHTML=`
        <div id="advancedFilterOverlay" class="picker-overlay" hidden></div>
        <div id="advancedFilterModal" class="filter-modal" hidden>
          <button class="info-close" id="advancedFilterClose">×</button>
          <div class="eyebrow">SMART FILTERS</div><h2>Filter your LivingDex</h2>
          <div class="filter-form">
            <label>Generation<select id="filterGeneration"><option value="all">All generations</option>${[1,2,3,4,5,6,7,8,9].map(n=>`<option value="${n}">Generation ${generationName(n)}</option>`).join('')}</select></label>
            <label>Type<select id="filterType"><option value="all">All types</option>${TYPES.map(x=>`<option value="${x}">${escHtml(typeLabel(x))}</option>`).join('')}</select></label>
            <label>Status<select id="filterStatus"><option value="all">All</option><option value="caught">Caught</option><option value="missing">Missing</option><option value="favorite">Favorites</option></select></label><label>Collection<select id="filterSpecial"><option value="all">All collections</option><option value="main">Main LivingDex</option>${[['vivillon','Vivillon'],['unown','Unown'],['furfrou','Furfrou'],['floette','Floette'],['minior','Minior'],['cobblemon-unique','Cobblemon Unique'],['arbok-patterns','Arbok Patterns'],['minecraft-forms','Minecraft Forms'],['magikarp-jump','Magikarp & Gyarados Jump']].map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}</select></label>
          </div>
          <div class="filter-actions"><button id="clearAdvancedFilters" class="secondary">Clear</button><button id="applyAdvancedFilters" class="primary">Apply Filters</button></div>
        </div>`;
      document.body.appendChild(wrap);
      $('#advancedFilterClose').onclick=closeFilterModal; $('#advancedFilterOverlay').onclick=closeFilterModal;
      $('#clearAdvancedFilters').onclick=()=>{Object.assign(adv,{generation:'all',type:'all',status:'all',special:'all'});syncFilterForm();closeFilterModal();page=1;render();};
      $('#applyAdvancedFilters').onclick=()=>{adv.generation=$('#filterGeneration').value;adv.type=$('#filterType').value;adv.status=$('#filterStatus').value;adv.special=$('#filterSpecial').value;closeFilterModal();page=1;render();};
    }
    syncFilterForm();
  }
  function syncFilterForm(){ if($('#filterGeneration')) $('#filterGeneration').value=adv.generation; if($('#filterType')) $('#filterType').value=adv.type; if($('#filterStatus')) $('#filterStatus').value=adv.status; if($('#filterSpecial')) $('#filterSpecial').value=adv.special; }
  function openFilterModal(){addAdvancedFilterUI();syncFilterForm();$('#advancedFilterOverlay').hidden=false;$('#advancedFilterModal').hidden=false;document.body.classList.add('modal-open');}
  function closeFilterModal(){if($('#advancedFilterOverlay'))$('#advancedFilterOverlay').hidden=true;if($('#advancedFilterModal'))$('#advancedFilterModal').hidden=true;document.body.classList.remove('modal-open');}

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
          <div class="detail-actions"><button id="detailCaught" class="${caught?'primary':'secondary'}">${caught?'✓ Caught':'Mark caught'}</button><button id="detailFav" class="secondary">${fav?'★ Favorite':'☆ Favorite'}</button></div>
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
      $('#detailCaught')?.addEventListener('click',()=>{if(state[e.id])delete state[e.id];else state[e.id]=true;saveAll();openInfo(e.id);render();});
      $('#detailFav')?.addEventListener('click',()=>{favorites[e.id]=!favorites[e.id];if(!favorites[e.id])delete favorites[e.id];saveAll();openInfo(e.id);});
      $('#detailPrev')?.addEventListener('click',()=>prev&&openInfo(prev.id));
      $('#detailNext')?.addEventListener('click',()=>next&&openInfo(next.id));
      $('#saveNote')?.addEventListener('click',()=>{notes[e.id]=$('#pokemonNote').value;saveAll();$('#saveNote').textContent='Saved ✓';});
      $$('[data-detail-form]').forEach(b=>b.onclick=()=>openInfo(b.dataset.detailForm));
    }
    $('#infoOverlay').hidden=false;$('#infoDropdown').hidden=false;document.body.classList.add('modal-open');$('#infoDropdown').scrollTop=0;
  };

  // Progress + milestones dashboard.
  function renderProgressPlus(){
    const main=mainEntries(), done=caughtCount(), total=main.length;
    const gens=Array.from({length:9},(_,i)=>i+1).map(g=>{const list=main.filter(e=>genFor(e)===g);const got=list.filter(e=>state[e.id]).length;return {g,total:list.length,got,p:pct(got,list.length)};}).filter(x=>x.total);
    const specialKeys=['vivillon','unown','furfrou','floette','minior','cobblemon-unique','arbok-patterns','minecraft-forms','magikarp-jump'];
    const specialNames={vivillon:'Vivillon',unown:'Unown',furfrou:'Furfrou',floette:'Floette',minior:'Minior','cobblemon-unique':'Cobblemon Unique','arbok-patterns':'Arbok Patterns','minecraft-forms':'Minecraft Forms','magikarp-jump':'Magikarp & Gyarados Jump'};
    const special=specialKeys.map(k=>{const l=pageEntries(k),g=l.filter(e=>state[e.id]).length;return [specialNames[k],g,l.length,pct(g,l.length)]});
    const milestones=[
      ['first','First Catch','Catch your first Pokémon.',done>=1],['ten','10 Club','Catch 10 Pokémon.',done>=10],['hundred','100 Club','Catch 100 Pokémon.',done>=100],['fivehundred','500 Club','Catch 500 Pokémon.',done>=500],['thousand','1,000 Club','Catch 1,000 Pokémon.',done>=1000],['half','Halfway There','Reach 50% completion.',pct(done,total)>=50],['threequarters','Three Quarters','Reach 75% completion.',pct(done,total)>=75],['complete','LivingDex Complete','Complete the main LivingDex.',done===total],['favorites','Favorite Collector','Mark 10 favorites.',Object.keys(favorites).length>=10],['fire','Fire Trainer','Catch 25 Fire Pokémon.',main.filter(e=>entryTypes(e).includes('Fire')&&state[e.id]).length>=25]
    ];
    const stats=JSON.parse(localStorage.getItem('cobblemon-livingdex-training')||'{}');
    $('#view').innerHTML=`<div class="page-card progress-plus"><div class="achievement-hero"><div><div class="eyebrow">LIVINGDEX PROGRESS</div><h2>Progress</h2><p>${escHtml(greetingName())}'s collection overview.</p></div><div class="achievement-total"><strong>${done}</strong><span>/ ${total} caught</span><i style="width:${pct(done,total)}%"></i></div></div>
      <div class="profile-stat-grid"><div><b>${pct(done,total)}%</b><span>Complete</span></div><div><b>Lv. ${Math.max(1,Math.floor(done/50)+1)}</b><span>Trainer level</span></div><div><b>${Object.keys(favorites).length}</b><span>Favorites</span></div><div><b>${gens.filter(x=>x.got===x.total).length}</b><span>Generations complete</span></div><div><b>${Object.values(stats).reduce((n,x)=>n+(x.questions||0),0)}</b><span>Training questions</span></div></div>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">GENERATIONS</span><h3>Regional Pokédex progress</h3></div></div><div class="progress-grid generation-progress">${gens.map(x=>`<div class="progress-card"><div class="progress-card-top"><span>Generation ${generationName(x.g)}</span><strong>${x.got} / ${x.total}</strong></div><div class="progress-track"><i style="width:${x.p}%"></i></div><small>${x.p}% complete</small></div>`).join('')}</div></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">SPECIAL COLLECTIONS</span><h3>Special forms</h3></div></div><div class="progress-grid">${special.map(x=>`<div class="progress-card"><div class="progress-card-top"><span>${escHtml(x[0])}</span><strong>${x[1]} / ${x[2]}</strong></div><div class="progress-track"><i style="width:${x[3]}%"></i></div><small>${x[3]}% complete</small></div>`).join('')}</div></section>
      <section class="achievement-section"><div class="section-heading"><div><span class="eyebrow">MILESTONES</span><h3>Trainer milestones</h3></div></div><div class="milestone-grid">${milestones.map(x=>`<article class="milestone ${x[3]?'unlocked':''}"><div class="milestone-icon">${x[3]?'✓':'○'}</div><div><b>${x[1]}</b><p>${x[2]}</p></div></article>`).join('')}</div></section></div>`;
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
      const candidates=pool.filter(x=>speciesForEntry(x)?.preEvolution); const target=pickEntry(candidates.length?candidates:pool); const sp=speciesForEntry(target); const pre=sp?.preEvolution||''; correct=pre || pickEntry(pool.filter(x=>x.id!==target.id)).name; choices=shuffle([correct,...shuffle(pool.filter(x=>x.name!==correct).map(x=>x.name)).slice(0,3)]); prompt=`Which Pokémon evolves into ${target.name}?`;
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
      const art=mode==='who'?`<div class="training-art"><img src="${spritePath(q.e)}"></div>`:`<div class="training-target"><img src="${spritePath(q.e)}"><div><b>${escHtml(q.prompt)}</b></div></div>`;
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
    const cards=Object.entries(labels).map(([k,v])=>{const s=trainingStats[k]||{};const acc=s.questions?pct(s.correct||0,s.questions):0;return `<article class="training-card"><div class="training-card-icon">${{who:'?',type:'T',evolution:'↗',pokedex:'#',generation:'G'}[k]}</div><div><div class="eyebrow">TRAINING</div><h3>${v[0]}</h3><p>${v[1]}</p><div class="training-statline"><span>Best <b>${s.best||0}/10</b></span><span>Accuracy <b>${acc}%</b></span></div></div><button class="primary training-start" data-training="${k}">Start</button></article>`;}).join('');
    $('#view').innerHTML=`<div class="page-card training-page"><div class="page-title"><div><div class="eyebrow">TRAINER SCHOOL</div><h2>Training</h2><p>Test your Pokémon knowledge and build your streak.</p></div><div class="training-total"><b>${Object.values(trainingStats).reduce((n,s)=>n+(s.questions||0),0)}</b><span>questions answered</span></div></div><div class="training-grid">${cards}</div></div>`;
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
    document.title='Cobblemon LivingDex — V1.2';
    // Expose the V1.1/V1.2 views explicitly so the database layer and navigation
    // always call the same implementations.
    window.renderTraining = renderTraining;
    window.renderProgressPlus = renderProgressPlus;
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
