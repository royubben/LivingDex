# Cobblemon LivingDex V2.0.9 — Navigation + Info Scroll TEST

Based on V2.0.8 Full Performance Test.

## Fixes
- V2 Trainer OS navigation is no longer overwritten by the legacy db.js router.
- Home, LivingDex, Catch Calendar, Training, Team Builder, Type Knowledge, Rewards, Statistics, Goals and Activity use the V2 router.
- Players and Leaderboard are reconnected to their existing database renderers.
- Sidebar PC Mode button is wired directly.
- Sidebar Home button returns to the V2 Home screen.
- Pokémon Info tab switching preserves the current modal scroll position instead of jumping to the top.
- Cache-busting bumped to V2.0.9.

## Validation
- app.js syntax: PASS
- v11.js syntax: PASS
- db.js syntax: PASS
- ZIP integrity: PASS
- Interactive browser test: not available/reliable in this environment; manual UI verification remains required.
