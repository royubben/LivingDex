import json,re,os,hashlib,shutil,zipfile
from pathlib import Path
root=Path('/mnt/data/v616')
app=root/'app.js'
s=app.read_text(encoding='utf-8')
# Parse embedded DATA
needle='const EMBEDDED_DATA = '
start=s.index(needle)+len(needle)
depth=0;ins=False;esc=False
for j,ch in enumerate(s[start:],start):
    if ins:
        if esc: esc=False
        elif ch=='\\': esc=True
        elif ch=='"': ins=False
    else:
        if ch=='"': ins=True
        elif ch=='{': depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:
                end=j+1; break
D=json.loads(s[start:end])
# Keep each regional bias directly after its original base form, without changing box membership.
bias_ids=['regional-bias-25-alola-bias','regional-bias-102-alolan','regional-bias-104-alolan','regional-bias-109-galarian']
for box in D['main']:
    entries=box['entries']
    by_id={e['id']:e for e in entries}
    for bid in bias_ids:
        if bid not in by_id: continue
        bias=by_id[bid]
        # Match by dex and non-bias identity. Put bias immediately after the base species.
        base_i=next((i for i,e in enumerate(entries) if e.get('dex')==bias.get('dex') and not e['id'].startswith('regional-bias-')),None)
        if base_i is None: continue
        entries.remove(bias)
        # Recompute base index after removal.
        base_i=next(i for i,e in enumerate(entries) if e.get('dex')==bias.get('dex') and not e['id'].startswith('regional-bias-'))
        entries.insert(base_i+1,bias)
    for slot,e in enumerate(entries,1):
        e['box']=box['box']; e['slot']=slot; e['position']=f"Box {box['box']:02d} • vak {slot:02d}"
# Sprite fixes: the previous bundled files for these targets were all bad placeholder/corrupt assets.
urls={
 'giratina-altered|base|487|main':'https://img.pokemondb.net/sprites/home/normal/1x/giratina.png',
 'oinkologne-male|base|916|main':'https://img.pokemondb.net/sprites/home/normal/1x/oinkologne.png',
 'mimikyu-disguised|base|778|main':'https://img.pokemondb.net/sprites/home/normal/1x/mimikyu.png',
 'tapu-koko|base|785|main':'https://img.pokemondb.net/sprites/home/normal/1x/tapu-koko.png',
 'tapu-lele|base|786|main':'https://img.pokemondb.net/sprites/home/normal/1x/tapu-lele.png',
 'tapu-bulu|base|787|main':'https://img.pokemondb.net/sprites/home/normal/1x/tapu-bulu.png',
 'tapu-fini|base|788|main':'https://img.pokemondb.net/sprites/home/normal/1x/tapu-fini.png',
 'zeraora|base|807|main':'https://img.pokemondb.net/sprites/home/normal/1x/zeraora.png',
 'meltan|base|808|main':'https://img.pokemondb.net/sprites/home/normal/1x/meltan.png',
 'melmetal|base|809|main':'https://img.pokemondb.net/sprites/home/normal/1x/melmetal.png',
 'minior-red-meteor|base|774|main':'https://img.pokemondb.net/sprites/home/normal/1x/minior-red-meteor.png',
 'minior-orange-meteor|base|10130':'https://img.pokemondb.net/sprites/home/normal/1x/minior-orange-meteor.png',
 'minior-yellow-meteor|base|10131':'https://img.pokemondb.net/sprites/home/normal/1x/minior-yellow-meteor.png',
 'minior-green-meteor|base|10132':'https://img.pokemondb.net/sprites/home/normal/1x/minior-green-meteor.png',
 'minior-blue-meteor|base|10133':'https://img.pokemondb.net/sprites/home/normal/1x/minior-blue-meteor.png',
 'minior-indigo-meteor|base|10134':'https://img.pokemondb.net/sprites/home/normal/1x/minior-indigo-meteor.png',
 'minior-violet-meteor|base|10135':'https://img.pokemondb.net/sprites/home/normal/1x/minior-violet-meteor.png',
 'minior-red|base|10136':'https://img.pokemondb.net/sprites/home/normal/1x/minior-red.png',
 'minior-orange|base|10137':'https://img.pokemondb.net/sprites/home/normal/1x/minior-orange.png',
 'minior-yellow|base|10138':'https://img.pokemondb.net/sprites/home/normal/1x/minior-yellow.png',
 'minior-green|base|10139':'https://img.pokemondb.net/sprites/home/normal/1x/minior-green.png',
 'minior-blue|base|10140':'https://img.pokemondb.net/sprites/home/normal/1x/minior-blue.png',
 'minior-indigo|base|10141':'https://img.pokemondb.net/sprites/home/normal/1x/minior-indigo.png',
 'minior-violet|base|10142':'https://img.pokemondb.net/sprites/home/normal/1x/minior-violet.png',
}
for form,slug in [('dandy','dandy'),('debutante','debutante'),('diamond','diamond'),('heart','heart'),('kabuki','kabuki'),('la-reine','la-reine'),('matron','matron'),('natural',''),('pharaoh','pharaoh'),('star','star')]:
    key='furfrou|furfrou-'+form+'|676|special'
    url='https://img.pokemondb.net/sprites/home/normal/1x/furfrou'+(('-'+slug) if slug else '')+'.png'
    urls[key]=url
# Replace/add entries in override object.
m=re.search(r'const SPRITE_FILE_OVERRIDES=({.*?});',s,re.S)
if not m: raise RuntimeError('override object not found')
obj=json.loads(m.group(1))
obj.update(urls)
newobj='const SPRITE_FILE_OVERRIDES='+json.dumps(obj,ensure_ascii=False,separators=(',',':'))+';'
s=s[:m.start()]+newobj+s[m.end():]
# Remove the bad targets from placeholder set so they are not considered unresolved.
m2=re.search(r'const PLACEHOLDER_SPRITE_IDS=new Set\((\[.*?\])\);',s,re.S)
if m2:
    arr=json.loads(m2.group(1))
    arr=[x for x in arr if x not in urls]
    s=s[:m2.start()]+'const PLACEHOLDER_SPRITE_IDS=new Set('+json.dumps(arr,separators=(',',':'))+');'+s[m2.end():]
# Update version marker.
s=s.replace('const APP_VERSION="3.6.16"','const APP_VERSION="3.6.17"')
# Re-serialize embedded data compactly.
newdata=json.dumps(D,ensure_ascii=False,separators=(',',':'))
s=s[:start]+newdata+s[end:]
app.write_text(s,encoding='utf-8')
# Copy a few correct local bias sprites if present; existing BIAS_SPRITES is empty, use remote URLs in overrides for bias later.
# Add explicit bias sprite overrides to avoid old wiki redirects and keep the local database identity intact.
# Re-open and inject four URL overrides.
s=app.read_text(encoding='utf-8')
m=re.search(r'const SPRITE_FILE_OVERRIDES=({.*?});',s,re.S)
obj=json.loads(m.group(1))
obj.update({
 'regional-bias-25-alola-bias':'https://wiki.cobblemon.com/images/b/b8/Pikachu_Alola_Bias_%28Model%29.png',
 'regional-bias-102-alolan':'https://wiki.cobblemon.com/images/8/8e/Exeggcute_Alolan_%28Model%29.png',
 'regional-bias-104-alolan':'https://wiki.cobblemon.com/images/0/09/Cubone_Alolan_%28Model%29.png',
 'regional-bias-109-galarian':'https://wiki.cobblemon.com/images/0/07/Koffing_Galarian_%28Model%29.png',
})
newobj='const SPRITE_FILE_OVERRIDES='+json.dumps(obj,ensure_ascii=False,separators=(',',':'))+';'
s=s[:m.start()]+newobj+s[m.end():]
app.write_text(s,encoding='utf-8')
