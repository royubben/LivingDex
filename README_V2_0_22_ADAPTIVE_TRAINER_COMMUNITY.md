# Cobblemon LivingDex V2.0.22 — Adaptive Trainer + Community Performance

Built from V2.0.21 Community Hub Polish.

## Changes
- Players public profile now uses the same V2 Trainer Card visual system as the owner's Trainer page.
- Public Trainer Card includes the selected favourite Pokémon artwork in the banner.
- Sign in / Sign out state is refreshed immediately across the V2 sidebar after logout.
- Feed initial data loading is parallelized.
- Feed comments/reactions are fetched in parallel and cached briefly.
- Community post rows are cached briefly and invalidated after mutations.
- LivingDex 6×5 layout is viewport-adaptive so the search bar and complete 30-slot box fit in the visible viewport across desktop, 1080p, 2K, 4K, ultrawide and vertical/mobile layouts.
- Public player card uses public profile/stat data only.

## Validation
- node --check v11.js: PASS
- node --check db.js: PASS
- node --check app.js: PASS
- CSS brace balance: PASS
- ZIP integrity: PASS

A real browser/device interaction test is still required for final visual validation.
