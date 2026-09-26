# Cobblemon LivingDex V2.0.9 — Full Performance TEST

Base: V2.0.7 (Phase 1–6)

Performance pass:
- preserved search match glow
- removed remaining card-action blur/compositor cost
- removed welcome overlay blur
- added layout/style containment to heavy V2 surfaces and journey/calendar/training modals
- reduced background local-online polling from 2s to 5s and pause checks while hidden
- retained lazy/async sprites and existing modal/scroll optimizations
- cache/version bumped to V2.0.9

No feature changes intended beyond performance behavior.
