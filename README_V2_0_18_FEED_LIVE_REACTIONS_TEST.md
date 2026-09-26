# Cobblemon LivingDex V2.0.18 — Feed Live + Reactions Test

Base: V2.0.17 Social Feed.

Changes:
- Removed duplicate Feed entry from V2 navigation.
- Feed refreshes every 30 seconds while the Feed page is open.
- Refresh pauses while the browser tab is hidden.
- Feed scroll position is preserved during live refresh.
- Live timer stops when leaving Feed.
- Reaction persistence changed from PostgREST upsert to explicit delete/insert, avoiding ON CONFLICT inference issues.
- Reaction failures are surfaced instead of silently refreshing.
- Existing social comments/feed remain intact.

Supabase requirement:
- Run `supabase_feed_social_migration.sql` once if `activity_reactions` does not yet exist.

Validation:
- JS syntax checked for app.js, v11.js, db.js.
- Feed navigation entry count: 1.
- ZIP integrity checked after packaging.
- No interactive browser automation available in this environment.
