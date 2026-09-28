# LivingDex data audit — v3.6.9

This build was audited by comparing the LivingDex entry database against the bundled Cobblemon species/spawn data and the bundled sprite map.

## Counts

- LivingDex entries: 1,324
- Main LivingDex entries: 1,126
- Local Cobblemon species records: 1,027
- Local Cobblemon spawn files: 825
- Bundled sprite mappings: 1,222
- Bundled sprite mapping targets verified on disk: 1,222 / 1,222

## Sprite rule

1. A verified bundled Cobblemon sprite is always preferred.
2. If no bundled Cobblemon sprite exists, the entry uses the Showdown HOME fallback.
3. Special Cobblemon/custom entries keep their explicit sprite overrides.
4. Form-specific Showdown aliases are used where the Cobblemon/database name differs from the Showdown filename.

The previous placeholder list no longer overrides valid bundled sprites. This was the cause of several Pokémon showing no sprite even though their correct local sprite was already present in the ZIP.

## Database / spawn principle

The Pokémon identity comes from the Cobblemon species database (species + national dex + forms/aspects). Spawn availability is read separately from the spawn files and server-obtainability sources. A display name is not used as the Minecraft identity key.

For Flabébé/Floette/Florges, the canonical Cobblemon species are `flabebe`, `floette`, and `florges`; their flower forms are represented by the `flower-*` aspect system.
