from pathlib import Path
import re,json,zipfile,shutil
from PIL import Image,ImageDraw,ImageFont

root=Path('/mnt/data/v3611fix')
app=root/'app.js'
s=app.read_text(encoding='utf-8')
# Extract current override object.
m=re.search(r'const SPRITE_FILE_OVERRIDES=(\{.*?\});\n',s)
assert m
ov=json.loads(m.group(1))
# Force all Magikarp/Gyarados Jump entries through local bundled sprites.
for species,prefix in [('magikarp','0129_Magikarp'),('gyarados','0130_Gyarados')]:
    for i in range(31):
        # exact existing file based on current mapping if available
        key=f'{species}-jump-{i}'
        pat=re.search(rf'"{re.escape(key)}":"([^"]+)"',s)
        if pat:
            fname=pat.group(1).replace('—','#U2014').replace('.png','.webp')
        else:
            fname='SPRITE_MISSING_PLACEHOLDER.webp'
        if not (root/'sprites'/fname).exists():
            fname='SPRITE_MISSING_PLACEHOLDER.webp'
        ov[key]=fname
# Explicit problem forms.
ov.update({
 'regional-bias-25-alola-bias':'SPRITE_MISSING_PLACEHOLDER.webp',
 'cobblemon-official-1000-netherite':'SPRITE_MISSING_PLACEHOLDER.webp',
 'creepyon|base|9902|allthemons':'SPRITE_MISSING_PLACEHOLDER.webp',
 'piglich|base|9901|allthemons':'SPRITE_MISSING_PLACEHOLDER.webp',
})
new='const SPRITE_FILE_OVERRIDES='+json.dumps(ov,ensure_ascii=False,separators=(',',':'))+';\n'
s=s[:m.start()]+new+s[m.end():]
app.write_text(s,encoding='utf-8')

# Create clear missing-sprite placeholder: transparent, large question mark.
out=root/'sprites'/'SPRITE_MISSING_PLACEHOLDER.webp'
im=Image.new('RGBA',(512,512),(0,0,0,0)); d=ImageDraw.Draw(im)
# Use a large system font.
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font=ImageFont.truetype(font_path,330)
text='?'; bbox=d.textbbox((0,0),text,font=font,stroke_width=10)
w,h=bbox[2]-bbox[0],bbox[3]-bbox[1]
d.text(((512-w)//2-bbox[0],(512-h)//2-bbox[1]-5),text,font=font,fill=(150,150,150,255),stroke_width=10,stroke_fill=(40,40,40,255))
im.save(out,'WEBP',lossless=True)

# Replace broken Creepyon/Piglich/Gholdengo/Pikachu sprite entries with placeholder, but record exact manual names.
manual=root/'SPRITES_MANUAL_UPLOAD_V3_6_12.md'
manual.write_text('''# Manual sprite uploads — v3.6.12\n\nThese entries currently use `SPRITE_MISSING_PLACEHOLDER.webp` (large `?`) until the exact Cobblemon render is supplied. Do **not** silently use a normal Pokémon sprite for these forms.\n\n| Entry | Required file name | Source / note |\n|---|---|---|\n| Pikachu — Alola Bias | `0025_Pikachu_—_Alola_Bias.webp` | Exact Cobblemon Wiki model render |\n| Gholdengo — Netherite | `1000_Gholdengo_Netherite_Full.webp` | Exact Cobblemon Wiki Netherite Full render; current Wiki lists Netherite as a Cobblemon regional-bias/unique form |\n| Creepyon | `9902_Creepyon.webp` | Replace the current broken/cropped asset with the actual AllTheMons/Cobblemon render |\n| Piglich | `9901_Piglich.webp` | No verified usable sprite found; placeholder intentionally retained |\n\n## Magikarp / Gyarados Jump\n\nAll 31+31 IDs are now forced to local bundled files instead of the Showdown fallback. Two forms currently use the placeholder because no verified local render was bundled: `Orange Two-Tone` and `Pink Two-Tone` for both species.\n''',encoding='utf-8')

# Add an audit file.
audit=root/'SPRITE_FIX_AUDIT_V3_6_12.md'
audit.write_text('''# Sprite fix audit v3.6.12\n\n- Magikarp Jump: 31 IDs explicitly overridden to local assets/placeholders.\n- Gyarados Jump: 31 IDs explicitly overridden to local assets/placeholders.\n- Prevented dex 129/130 Showdown fallback from overriding these custom forms.\n- Creepyon current bundled image was inspected and is visibly cropped/broken; replaced by explicit placeholder.\n- Piglich has explicit placeholder pending a verified sprite.\n- Pikachu Alola Bias has explicit placeholder pending exact Cobblemon render.\n- Gholdengo Netherite has explicit placeholder pending exact Cobblemon render.\n- Placeholder is a transparent 512x512 WebP with a large question mark.\n''',encoding='utf-8')

# Validate override targets.
assert out.exists()
for k,v in ov.items():
    if k.startswith('magikarp-jump-') or k.startswith('gyarados-jump-') or k in {'regional-bias-25-alola-bias','cobblemon-official-1000-netherite','creepyon|base|9902|allthemons','piglich|base|9901|allthemons'}:
        assert (root/'sprites'/v).exists(), (k,v)
print('overrides',len(ov),'placeholder',out.stat().st_size)
