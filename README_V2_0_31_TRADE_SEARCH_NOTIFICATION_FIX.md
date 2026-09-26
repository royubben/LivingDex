# Cobblemon LivingDex V2.0.31 — Trade Search + Atomic Notification Fix

## Changes
- Added a dedicated search field when selecting the Pokémon being traded away.
- Live filtering searches the user's currently owned collection by Pokémon name.
- Added an empty state when no Pokémon matches the search.
- Replaced the browser-side `community_notifications` INSERT in linked-trade creation with the Supabase `create_trainer_trade(...)` RPC.
- The RPC creates the pending trade and recipient notification in one database transaction using `SECURITY DEFINER`.
- This avoids the notification being blocked by client-side RLS while preserving recipient-only notification reads.
- Existing linked trade acceptance/decline flow remains unchanged.

## Supabase migration
Run `supabase_trainer_trades_v3_atomic_create.sql` as a **new query** after the earlier trainer-trade migrations.
Do not replace previous migrations.

## Validation
- `node --check db.js` passed.
- `node --check app.js` passed.
- `node --check v11.js` passed.
- ZIP integrity verified after packaging.

## Manual test
1. Run the new SQL migration.
2. Sign in as Trainer A and open a Pokémon journey where you choose `Traded`.
3. Use the new search field to find the Pokémon being given away.
4. Select another Trainer and send the request.
5. Sign in as Trainer B in another browser/session.
6. Confirm the bell shows an unread notification.
7. Open it and verify both Pokémon are shown.
8. Confirm the trade and verify both collections update.
