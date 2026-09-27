# Minecraft Full Sync — based on LivingDex V2.5

## Supabase
1. Run the existing `supabase_minecraft_bridge_v1.sql` once if the base bridge tables/linking are not already installed.
2. Run `supabase_minecraft_full_sync_v2.sql`.
3. Set `minecraft_bridge_config.server_token` to a long random secret.

## Server bridge
Build `LivingDex_Bridge_v0_2_0_FULL_SYNC_SOURCE.zip` with Java 21.
Install the resulting `livingdex-bridge-0.2.0.jar` on the server and remove older LivingDex Bridge jars.

The bridge listens for Cobblemon 1.7.3 catch, evolution-complete and completed-trade events. It stores events locally and retries them until Supabase accepts them.

Minecraft is authoritative for Minecraft-originated collection changes:
- catch: increments normal count; shiny catch also increments shiny count
- evolution: moves one owned copy from source entry to target entry, including shiny counts
- trade: removes the sent copy and adds the received copy for every linked participant
- if a trade participant is not linked, that participant is recorded as `Unknown Player`; only linked participants' collections are changed
- feed activity is written into the existing `training.__activity` structure
