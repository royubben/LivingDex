# Cobblemon LivingDex V2.0.32 — Trade Accept Fix

## Fix
- Fixed PostgreSQL `x.value must appear in the GROUP BY clause or be used in an aggregate function` error when confirming a linked Trainer trade.
- The activity history is now limited to 1000 rows in a subquery before `jsonb_agg`.
- No client-side trade flow changes are required.

## Supabase
Run `supabase_trainer_trades_v4_accept_fix.sql` as a **new query** after the existing trainer-trade migrations.

Do not replace the previous migrations.
