# Cobblemon LivingDex V2.0.25 — Pokémon Info + Duplicate Collection

## Changes
- Duplicate Pokémon counts are now persisted separately from the boolean LivingDex ownership state.
- Pokémon Info shows the current owned quantity, e.g. `Currently owned · ×7`.
- `Add another` increments the quantity without creating another LivingDex entry.
- The collected action decrements one copy; the final copy removes the Pokémon from the current collection.
- Duplicate counts are synced inside the existing `player_saves.training.__pokemonCounts` payload, preserving the existing database schema.
- Leaderboard no longer depends on the legacy JSONB leaderboard view for collection counts; it derives unique caught counts from public player stats and avoids the jsonb numeric/boolean cast error.
- Move chips are clickable. Move details load on demand from the Pokémon move API and show type, damage class, priority, power, accuracy, PP, target and effect description.
- Move detail data is cached in memory after first load.

## Migration
No new Supabase migration is required for duplicate counts. The existing player_saves JSONB training payload stores `__pokemonCounts`.
