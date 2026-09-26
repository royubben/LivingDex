# Cobblemon LivingDex V2.0.21 — Community Hub Polish

Built from V2.0.20. Keeps the working social reactions and Community Hub architecture.

## Changes
- Restored Sign in / Sign out in the Trainer sidebar.
- Community posts can be deleted by their owner.
- Composer simplified to Trainer Post + Looking For. Trade Offer removed; Discussion is no longer exposed as a separate composer option. Existing older posts remain readable.
- Default editable title/message templates for both post types; users can freely change or delete the text.
- Looking For is limited to 5 Pokémon per post.
- Looking For has a 20-minute cooldown, checked client-side and server-side. Run `supabase_community_hub_v2_migration.sql` as a new Supabase query.
- Trade requests now use a Pokémon picker containing only Pokémon currently owned by the Trainer, max 5.
- Community Pokémon cards scale with 1–5 selected Pokémon instead of staying tiny.
- Collection now stores a quantity per Pokémon while preserving existing boolean saves as quantity 1.
- Pokémon Info now shows the owned quantity and has “＋ Voeg nog één toe”.
- Extra copies can be stored without changing LivingDex completion.
- Community post comments now support community-post IDs.
- Comment submission preserves both page scroll and Feed scroll position.
- Cache-busting updated to V2.0.21.

## Validation
- `node --check` passed for app.js, v11.js and db.js.
- CSS appended cleanly.
- ZIP integrity checked after packaging.
- No real browser automation is available in this environment, so visual interaction still needs manual browser testing.
