# Sprite upload audit — v3.6.13

This build replaces the remaining broken/remote sprite mappings with the exact assets supplied in the conversation. All supplied raster images are bundled locally as lossless WebP files.

## Supplied and mapped

- Magikarp Jump — Orange Two-Tone → `magikarp-jump-5`
- Magikarp Jump — Pink Two-Tone → `magikarp-jump-8`
- Gyarados Jump — Orange Two-Tone → `gyarados-jump-5`
- Gyarados Jump — Pink Two-Tone → `gyarados-jump-8`
- Gholdengo — Netherite → `cobblemon-official-1000-netherite`
- Pikachu — Alola Bias → `regional-bias-25-alola-bias`
- Exeggcute — Alolan → `regional-bias-102-alolan`
- Cubone — Alolan → `regional-bias-104-alolan`
- Koffing — Galarian → `regional-bias-109-galarian`
- Cyndaquil — Hisui-bias → `cobblemon-hisui-bias-cyndaquil`
- Quilava — Hisui-bias → `cobblemon-hisui-bias-quilava`
- Oshawott — Hisui-bias → `cobblemon-hisui-bias-oshawott`
- Dewott — Hisui-bias → `cobblemon-hisui-bias-dewott`
- Rowlet — Hisui-bias → `cobblemon-hisui-bias-rowlet`
- Dartrix — Hisui-bias → `cobblemon-hisui-bias-dartrix`
- Mime Jr. — Galarian Bias → `mime-jr|galarbias|439|main`
- Flabebe — Pink → `flabebe|pink|669|special`
- Floette — Pink → `floette|pink|670|special`
- Florges — Pink → `florges|pink|671|special`

## Important

The sprite resolver checks these exact entry IDs before generic Showdown/PokeAPI fallback, so dex 129/130 custom forms and regional-bias forms cannot be silently replaced by a generic sprite.

Creepyon and Piglich were not included in this upload batch and therefore remain on the existing large `?` placeholder. No unrelated sprite was substituted for them.


## v3.6.14 follow-up
- Dewott Hisui-bias restored to previous `0502_Dewott.webp`.
- Unown glyphs cropped/scaled.
- Reported missing sprite IDs switched to explicit PokeAPI overrides.
- Sun/Moon legendary + Ultra Beast block 789–806 covered.
- Spawn-region helper now excludes anti-biome conditions.
