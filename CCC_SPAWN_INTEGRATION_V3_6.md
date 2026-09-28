# v3.6 Spawn integration

The website now loads the Complete Cobblemon Collection 1.7.0 natural-world spawn pool at runtime and merges it with the local Cobblemon 1.7.3 + AllTheMons spawn dataset.

Source: https://github.com/Complete-Cobblemon-Collection-Team/datapack/tree/1.7.0/main/data/cobblemon/spawn_pool_world

The CCC JSON is fetched and cached locally in the browser; it is not bundled into the ZIP. This keeps the site small and allows the source spawn data to remain authoritative.

Natural-world CCC files in the manifest: 98.

Important: legendary, paradox and Ultra Beast acquisition systems are intentionally not merged into the ordinary natural spawn pool. Those require the server-specific acquisition rules described separately by the server owner.
