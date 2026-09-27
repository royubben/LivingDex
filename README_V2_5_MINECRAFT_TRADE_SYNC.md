# Cobblemon LivingDex v2.5 — Minecraft Trade Sync

This update changes the trade architecture to **server-authoritative Minecraft sync**.

## What changed

- Removed the automatic website Smart Trade offer system.
- A trade is only considered a Minecraft trade when Cobblemon itself emits `TRADE_EVENT_POST`.
- The server-side LivingDex Bridge sends the completed trade to Supabase.
- Supabase atomically updates both Trainers' collections.
- Normal and shiny Pokémon remain separate.
- A Minecraft trade is recorded as an accepted trade with `source = minecraft`.
- Both Trainers receive a notification.
- The website polls for new server trades while visible, so the collection can update without manually opening Feed.
- Website settings now contain a Minecraft account-link flow that creates a 15-minute one-time code.

## Required Supabase migration

Run:

`supabase_minecraft_bridge_v1.sql`

in the same Supabase project used by the LivingDex.

Before enabling the server bridge, replace the placeholder value in:

`public.minecraft_bridge_config.server_token`

with a long private random secret.

## Required server mod

The separate project:

`/mnt/data/livingdex_bridge`

contains `LivingDex Bridge v0.1.0` for:

- Minecraft 1.21.1
- NeoForge 21.1.249
- Cobblemon 1.7.3

The build uses the exact Cobblemon 1.7.3 Modrinth artifact and Java 21. The final JAR needs to be built in an environment with Maven/Gradle internet access because this workspace cannot resolve external Maven hosts.

## Player linking

1. Sign in to the LivingDex.
2. Settings → Minecraft → Link Minecraft account.
3. Copy `/livingdex link XXXXXXXX`.
4. Run it in Minecraft on the server.
5. The server binds that Minecraft UUID to the LivingDex account.

After both players are linked, a normal Cobblemon trade automatically becomes a LivingDex trade.

## Important source-of-truth rule

The website does **not** create or confirm a Minecraft trade. Minecraft completes the trade first; the bridge reports the completed event; Supabase applies it atomically; the website displays the resulting state.
