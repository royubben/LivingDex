# v3.6.19 — Minior sprite fix

Minior sprites were still resolving to the old bundled corrupt local assets.

## Mapping
- 7 Meteor entries -> Showdown HOME `minior-meteor.png`
- 7 Core entries -> Showdown HOME color-specific sprites (`minior-red.png` through `minior-violet.png`)
- Main Red Meteor and special-tab Red Meteor both explicitly override the old local asset.

The Showdown HOME directory lists `minior-meteor.png`, `minior-blue.png`, `minior-green.png`, `minior-indigo.png`, `minior-orange.png`, `minior-violet.png`, and `minior-yellow.png`.
