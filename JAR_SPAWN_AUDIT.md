# JAR spawn audit — final rebuild

Source JARs: Cobblemon 1.7.3+1.21.1 and AllTheMons 0.6.2.

## Dataset
- Final local species records: **1027**
- Spawn files: **825**
- Enabled Pokémon spawn rows: **2859**
- Empty spawn files: **0**
- Gimmighoul spawn rows: **6** — 3 Chest + 3 Roaming
- AllTheMons Staryu spawn rows: **17** — 10 normal + 7 `atm`/Patrickyu
- AllTheMons Creepyon spawn rows: **1**

## LivingDex coverage
- Main LivingDex entries: **1097**
- All visible entries including special pages: **1290**
- All 1027 local species now have a visible entry/page representation.
- Added missing Deoxys (base + Attack/Defense/Speed), Maushold (base + Four), and AllTheMons custom species Creepyon/Piglich.
- Added AllTheMons Staryu / Patrickyu as a visible form.

## Gimmighoul
- Chest = **Box 41, slot 5**
- Roaming = **Box 41, slot 6**
- They are consecutive in the main LivingDex.

## Spawn resolver
The UI resolver now handles normal species names, form names, regional aliases, Cobblemon aspect/parameter syntax, and orphan aspect rows. It prevents spawn rows from disappearing just because the UI form name differs from the `pokemon` string in the JAR.

Examples verified: Gimmighoul Chest 3 rows, Gimmighoul Roaming 3 rows, Staryu Patrickyu 7 form-specific rows.

## Catch Calendar
The calendar's existing eligible pool was compared against the previous working app: **962 eligible entries before and after**. The set is identical. Newly added LivingDex entries are explicitly excluded from the daily pool so adding JAR-derived forms/species cannot reshuffle the existing calendar schedule.

`node --check app.js` and `node --check v11.js` pass.
