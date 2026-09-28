const fs=require('fs'),vm=require('vm'); const s=fs.readFileSync('/mnt/data/flabebe_work/app.js','utf8');
const m=s.match(/const EMBEDDED_DATA = (\{[\s\S]*?\});\nconst pageEntriesCache/); if(!m){console.log('no match');process.exit(1)}
const ctx={}; vm.createContext(ctx); vm.runInContext('DATA='+m[1],ctx); const D=ctx.DATA;
let all=[]; for(const [k,v] of Object.entries(D)){ if(v&&Array.isArray(v.entries)) all.push(...v.entries); else if(Array.isArray(v)) all.push(...v); }
const fs2=require('fs'); const dir='/mnt/data/flabebe_work/sprites';
function localName(x){return String(x||'').replace(/\.png$/i,'.webp').replaceAll('—','#U2014').replaceAll('–','#U2013')}
for(const e of all){ if(typeof e.sprite==='string' && e.sprite.startsWith('sprites/')){const f=e.sprite.slice(8).split('?')[0]; const p=decodeURIComponent(f); const q=localName(p); if(!fs2.existsSync(dir+'/'+q)) console.log(e.id,'=>',q); }}
