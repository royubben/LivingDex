# Cobblemon LivingDex V2.0.36 — Shiny Feed + Trade

## Changes
- Shiny collection now creates Feed activity when a shiny is found/added/removed.
- Shiny Feed posts use the shiny sprite.
- Shiny Pokémon appear separately in the Journey trade selection with a ✨ label and quantity.
- Unknown Trainer trades can transfer a shiny without removing the normal Pokémon entry.
- Linked Trainer trades support shiny assets using `shiny:<entry_id>`.
- Linked trade acceptance transfers shiny counts through `training.__shinies` and records shiny-aware Feed activity.
- Trade notifications display shiny assets correctly.
- Normal Pokémon counts and existing trade behavior remain separate from shiny counts.

## Supabase
Run `supabase_trainer_trades_v5_shiny_support.sql` once in Supabase after the existing trainer-trade migrations.
