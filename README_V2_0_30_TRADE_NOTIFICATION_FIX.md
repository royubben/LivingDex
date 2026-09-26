# Cobblemon LivingDex V2.0.30 — Trade Notification Fix

## Fix
Fixed linked Trainer Trade requests not appearing for the receiving Trainer.

### Root cause
`community_notifications` had an INSERT grant but no matching RLS INSERT policy. Supabase therefore rejected the client-side notification insert while the trade request itself was created successfully. The previous client code also ignored that notification insert error.

### Changes
- Added an idempotent RLS INSERT policy for authenticated trade notification creators.
- The policy requires `auth.uid() = actor_id`, preventing a client from impersonating another Trainer when creating a notification.
- Added/verified `trainer_trade_id` and its index.
- Client now surfaces a clear error if notification delivery fails instead of silently reporting success.
- Existing linked-trade acceptance/decline flow remains unchanged.

## Supabase migration
Run:
`supabase_trainer_trades_v2_notification_fix.sql`

Run it as a **new query** after the earlier Community Hub and linked-trade migrations.

## Verification
- JavaScript syntax checked with Node.
- ZIP integrity checked after packaging.
- Full two-account Supabase/browser trade flow still requires a real connected environment for final end-to-end verification.
