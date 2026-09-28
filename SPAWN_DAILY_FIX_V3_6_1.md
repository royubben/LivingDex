# v3.6.1 Spawn + Daily Catch Fix

## Spawn / obtainability

The website keeps the existing Cobblemon 1.7.3 + AllTheMons 0.6.2 spawn dataset and CCC 1.7.0 natural-spawn integration.

A server-specific obtainability layer is now added for sources that are not represented by ordinary `spawn_pool_world` files.

Known server sources encoded:
- Rayquaza — Sky Pillar
- Kyogre — Origin Cave
- Groudon — Origin Tomb
- Ho-Oh — Legendary Monuments
- Regirock / Regice / Registeel — Legendary Monuments
- Mewtwo — Ancient DNA
- Zygarde 50% — Battle Tower
- Koraidon / Miraidon — pinned Paradox information
- Ultra Beasts — The Other portal + Alolan Pika Star + Beast Ball
- Paradox Pokémon — Region Pika Star requirement
- Other legendary entries — Legendary Monuments
- Mew — Complete Cobblemon Collection source

These are represented as obtainability records in `data/server_obtainability.js` and surfaced by Spawn Explorer / Pokémon details.

## Daily Catch

The old Daily Catch resolver depended directly on the current spawn pool. Adding spawn files could therefore change the result for an existing date.

v3.6.1 freezes the 2026 calendar to a versioned schedule:
- `DAILY_CATCH_SCHEDULE_VERSION = 3.6-fixed-2026`
- 365 dated assignments are stored explicitly.
- The 37 v3.5-added LivingDex forms remain excluded from the legacy Daily Catch pool.
- Future dates use a frozen pool snapshot instead of the live, mutable spawn dataset.

The known 25 September 2026 test assignment remains **Pansage**.

## Verification

- `node --check app.js` — PASS
- `node --check v11.js` — PASS
- Frozen 2026 schedule — 365/365 dates populated
- Frozen Daily Catch pool — 955 entries
- v3.5 form exclusions in frozen pool — 0
- Server obtainability records — 68
