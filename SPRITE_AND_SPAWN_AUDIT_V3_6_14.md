# Cobblemon LivingDex v3.6.14 — sprite + spawn audit

## Sprite fixes
- Dewott — Hisui-bias restored to the previous local Dewott render (`0502_Dewott.webp`).
- All Unown glyphs were tightly cropped from their transparent 256×256 source canvas and rescaled to a 220px maximum glyph area.
- The reported missing-sprite set now uses an explicit PokeAPI override instead of the bundled placeholder/wrong local assets.
- The Sun/Moon legendary + Ultra Beast block (National Dex 789–806) is included in the PokeAPI override set; this also covers Poipole, Naganadel, Magearna and Marshadow.
- Existing user-supplied local sprites (Magikarp/Gyarados Jump, Gholdengo, Pikachu, Flabébé line, regional/bias sprites) remain local and are not replaced by the new override.

## Unown
- Unown assets processed: 29 files.

## Spawn data source audit
- Bundled local species records: 1027.
- Bundled local spawn files: 825.
- Enabled Pokémon spawn rows in the bundled data: 2859.
- Spawn biome extraction now uses only `condition.biomes`. `anticondition.biomes` is treated as an exclusion and is no longer reported as a spawn region by `getSpawnBiomeKeysForEntry`.
- The underlying local spawn JSON is kept unchanged; no biome was invented or substituted.

## Requested missing sprite names
- Oranguru
- Passimian
- Type Null
- Silvally
- Tapu Koko
- Tapu Lele
- Tapu Bulu
- Tapu Fini
- Nihilego
- Buzzwole
- Pheromosa
- Xurkitree
- Celesteela
- Kartana
- Guzzlord
- Stakataka
- Blacephalon
- Cosmog
- Cosmoem
- Solgaleo
- Lunala
- Necrozma
- Poipole
- Naganadel
- Magearna
- Marshadow
- Blipbug
- Dottler
- Orbeetle
- Coalossal
- Applin
- Flapple
- Appletun
- Runerigus
- Mr Rime
- Snom
- Frosmoth
- Duraludon
- Zacian
- Zamazenta
- Eternatus
- Kubfu
- Glastrier
- Urshifu
- Spectrier
- Calyrex
- Basculegion
- Enamorus
- Nymble
- Lokix
- Pawmi
- Pawmo
- Pawmot
- Squawkabilly
- Bombirdier
- Palafin
- Greavard
- Houndstone
- Tatsugiri
