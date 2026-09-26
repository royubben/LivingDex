# V2.0.35 — Shiny Collection

## Added
- Shiny tracking is separate from the normal LivingDex collection.
- Clicking a Pokémon opens a dedicated ✨ Shiny Collection card.
- Mark a shiny as collected, add additional shiny copies, or remove one.
- Shiny counts are stored in `training.__shinies` and therefore sync through the existing cloud save without a new Supabase migration.
- Shiny artwork is lazy-loaded only in the Pokémon detail view, so the 6×5 LivingDex cards remain unchanged.
- Base species use the public PokeAPI sprite repository; common regional forms use Pokémon Showdown shiny sprites.

## Preserved
- Normal LivingDex sprites and 6×5 layout are unchanged.
- Existing duplicate counts remain separate from shiny counts.
- Existing trade, notification and Feed functionality is untouched.

## Validation
- `node --check app.js`
- `node --check v11.js`
- `node --check db.js`
- ZIP integrity check passed.
