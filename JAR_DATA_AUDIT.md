# LivingDex JAR data audit

This build uses the uploaded server JARs as the source for the local Cobblemon information dataset.

- Cobblemon: `1.7.3+1.21.1`
- AllTheMons: `0.6.2`

## Extracted data

- Cobblemon species JSON files: 1025
- AllTheMons custom species: 2 (`Piglich`, `Creepyon`)
- AllTheMons species additions: 11
- Final local species records: 1027
- Cobblemon spawn files: 824
- AllTheMons spawn files: 2
- Final local spawn files: 825

AllTheMons' `staryu` species addition is merged into the Cobblemon `staryu` record, including the `Patrickyu` form and `atm` feature. Its `0120_staryu` spawn data is represented in the final local spawn file.

No Pokémon/species data was obtained from an external API for this dataset.

LivingDex visibility fix: Gimmighoul Chest retained under existing entry ID; Gimmighoul Roaming added as a separate LivingDex entry. Spawn resolver now matches Cobblemon form-qualified spawn names.
