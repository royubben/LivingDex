# Cobblemon LivingDex v2.5 — Server Data + Smart Trades

## Server data
This release uses the uploaded server-side mod data as the source of truth:
- Cobblemon NeoForge 1.7.3 + Minecraft 1.21.1
- AllTheMons 0.6.2
- 1025 base Cobblemon species plus 2 AllTheMons custom species (`piglich`, `creepyon`)
- AllTheMons species additions, including the Patrickyu/Staryu form
- 824 exact Cobblemon spawn pool files plus the AllTheMons spawn pool additions/merged entries
- Evolution data comes from the Cobblemon species JSON and is used by the existing Evolution Explorer/detail view.

## Smart Trades
Smart Trades are opt-in. When enabled, the website can automatically send at most one normal-Pokemon trade offer every 10 minutes when it finds a reciprocal duplicate/missing match between public Trainer collections.

The trade is never auto-confirmed. The receiving Trainer must still accept it, after which the existing atomic trade flow handles the collection updates.

Shiny auto-trading is intentionally not enabled by default.
