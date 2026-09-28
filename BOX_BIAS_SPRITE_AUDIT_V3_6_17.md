# Cobblemon LivingDex v3.6.17 — Bias + Sprite Audit

## Bias placement
Regional Bias entries in the main LivingDex are now immediately after their original/base species, without changing their generation/box membership:

- Pikachu #25 → Pikachu — Alola Bias: Box 1 slots 27–28
- Exeggcute #102 → Exeggcute — Alolan: Box 5 slots 13–14
- Cubone #104 → Cubone — Alolan: Box 5 slots 17–18
- Koffing #109 → Koffing — Galarian: Box 5 slots 24–25

All four are directly adjacent to their base species.

## Sprite fixes
The previous v3.6.16 bundled assets for several targets were identical placeholder/corrupt files. v3.6.17 overrides those targets with explicit Pokémon HOME sprite URLs:

- Giratina (Altered)
- Oinkologne (male)
- Mimikyu
- Tapu Koko
- Tapu Lele
- Tapu Bulu
- Tapu Fini
- Zeraora
- Meltan
- Melmetal
- Minior Red/Orange/Yellow/Green/Blue/Indigo/Violet Meteor
- Minior Red/Orange/Yellow/Green/Blue/Indigo/Violet Core

Furfrou's ten trims are also explicitly mapped to HOME sprites:
Natural, Heart, Star, Diamond, Debutante, Matron, Dandy, La Reine, Kabuki, Pharaoh.

## External source references
- Project Pokémon HOME sprite index, Gen 7: https://projectpokemon.org/home/docs/spriteindex_148/home-sprites-gen-7-r134/
- Project Pokémon HOME sprite index, Gen 6: https://projectpokemon.org/home/docs/spriteindex_148/home-sprites-gen-6-r133/
- Pokémon Database Giratina sprites: https://pokemondb.net/sprites/giratina
- Pokémon Database Oinkologne sprites: https://pokemondb.net/sprites/oinkologne

## Validation
- app.js `node --check`: PASS
- Embedded main entries: 1,125
- Main boxes: 43
- Regional Bias adjacency checks: 4/4 PASS
- Minior sprite override mappings: 14/14 present
- Furfrou sprite override mappings: 10/10 present
