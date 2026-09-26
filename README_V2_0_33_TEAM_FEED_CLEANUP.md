# Cobblemon LivingDex V2.0.33 — Team Feed Cleanup

Based on V2.0.32.

## Changes
- Team add/remove no longer creates `team_add` / `team_remove` activity events.
- Existing historical `team_add` / `team_remove` activity records are filtered out of the Home/Feed activity views.
- Pokémon detail history remains unchanged; old team history is not deleted from stored data.
- No Supabase migration required.

## Validation
- app.js: node --check passed
- v11.js: node --check passed
- db.js: node --check passed
