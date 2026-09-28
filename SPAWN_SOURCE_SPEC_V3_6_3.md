# Spawn Source Specification — v3.6.3

This build uses the sources supplied for the server's obtainability rules.

## Priority / sources

1. Base Cobblemon — local server-derived data in `data/cobblemon_local.js`.
2. Mega Showdown — supplied source/reference for Mega Showdown spawn coverage. The website does not invent spawn conditions from the wiki when a machine-readable spawn file is not available.
3. Complete Cobblemon Collection — supplied `resourcepack` 2.1 `data/cobblemon/spawn_pool_world` source. The website discovers the JSON files from that exact branch and loads their actual contents.
4. Cobblemon Raid Dens — supplied raid boss directory. Raid bosses are shown as an obtainability source, not as normal natural spawns.
5. AllTheMons — supplied `kubejs/data/cobblemon/spawn_pool_world` source.
6. Legendary Monuments — server-specific obtainability source.
7. Extra Structures — Rayquaza / Kyogre / Groudon structures supplied by the server configuration.
8. Other server mechanics — Zygarde / Mewtwo / Koraidon / Miraidon / Ultra Beasts / Paradox requirements supplied by the server configuration.

## Important rule

A Pokémon is not considered unavailable merely because it has no Base Cobblemon spawn file. CCC, AllTheMons, Raid Dens, structures and the supplied special acquisition methods are valid server sources.

## CCC rule

Only the supplied CCC `data/cobblemon/spawn_pool_world` natural-spawn directory is used for the CCC natural-spawn layer. Legendary / Ultra Beast / Paradox CCC folders are not silently substituted for the server's special mechanics.

## Daily Catch

Daily Catch uses the fixed calendar schedule and does not regenerate historical assignments when spawn sources change.
