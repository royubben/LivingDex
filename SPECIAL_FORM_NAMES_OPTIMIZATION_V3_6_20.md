# Cobblemon LivingDex v3.6.20 — Special Form Names + Optimization Audit

## Requested change
All entries inside their own Special Forms tabs now display the form/pattern name only, without repeating the Pokémon species name.

Examples:
- Vivillon — Monsoon -> Monsoon
- Unown — A -> A
- Furfrou — La Reine -> La Reine
- Flabebe — Yellow Flower -> Yellow Flower
- Arbok — Attack -> Attack
- Magikarp — Orange Two-Tone -> Orange Two Tone
- Gyarados — Orange Two-Tone -> Orange Two Tone
- Cobblemon unique — Valencia -> Valencia
- Minecraft forms — Cherry Torterra -> Cherry Torterra
- Minior Orange Meteor -> Orange Meteor

The change is scoped strictly to Special Forms tabs. Main LivingDex names remain unchanged.

## Special tabs covered
vivillon, unown, furfrou, flabebe, minior, cobblemon-unique, arbok-patterns, regional-bias, minecraft-forms, magikarp-jump, gyarados-jump, allthemons.

## Data audit
- Main boxes: 42
- Main entries: 1126
- Special entries: 204
- Main duplicate IDs: 0
- Duplicate IDs inside individual special tabs: 0
- Vivillon: 23
- Unown: 28
- Furfrou: 10
- Flabebe: 18
- Minior: 13
- Cobblemon Unique: 10
- Arbok Patterns: 21
- Regional Bias: 4
- Minecraft Forms: 13
- Magikarp Jump: 31
- Gyarados Jump: 31
- AllTheMons: 2

## Validation
- `node --check app.js`: PASS
- Embedded data JSON parse: PASS
- Special tab IDs: PASS
- Local sprite override audit: 119/120 present; one known pre-existing Staryu Patrickyu override remains missing and was not changed by this task.
- Special display logic is isolated to the Special Forms tab set; Main LivingDex remains untouched.

## Browser test note
Headless Chromium was attempted, but the local app did not complete within the available headless runtime in this environment. Static JavaScript/data validation therefore remains the completed automated validation for this build.
