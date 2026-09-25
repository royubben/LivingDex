# Cobblemon LivingDex V1.2 BETA 3 FIXED

Based on the verified V1.2 BETA 2 Accounts build.

Fixes:
- Restored the working V1.2 BETA 2 account/profile/login flow.
- Added safe cloud synchronization for notes, team, training and theme without replacing the working auth/navigation layer.
- Preserved existing caught/favorite/profile/leaderboard sync.
- Added an explicit full-team warning when trying to add a seventh Pokémon.
- Preserved the Pokémon detailscreen Add to Team function.

Supabase:
- Uses the existing Project URL and publishable key from db-config.js.
- No secret/service-role key is included.
