# V2.0.27 — Move Details Fix

- Fixed move-detail lookup for Cobblemon move IDs that omit separators, e.g. `vinewhip` → `vine-whip` and `doubleedge` → `double-edge`.
- Added a lazy PokeAPI move index cache so move details resolve against canonical move slugs.
- Existing move-detail modal, Pokémon Info, collection counts, Feed and LivingDex functionality preserved.
- No Supabase migration required.
