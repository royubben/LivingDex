# Cobblemon LivingDex — V2 Roadmap

## Basis

**V1.7.15 TEST is de performance baseline.** V2 builds start from that build and must preserve its smooth scrolling, lazy loading, 6×5 LivingDex PC grid, save behavior, Catch Calendar, Training, Profile, Players and existing collection logic.

The goal of V2 is to evolve the app from a collection tracker into a **Cobblemon Trainer OS**: a cohesive trainer home, PC, progression system, activity/social layer, detailed Pokémon knowledge base and polished mini-game experience.

---

# Version plan

## V2.0.0 — Trainer OS Foundation
**Status: foundation implemented**

- Completely new app shell and information hierarchy.
- Desktop Trainer OS sidebar.
- Mobile bottom navigation.
- New Trainer Home / HQ.
- Trainer header with name and IGN context.
- LivingDex progress summary.
- Trainer Level/XP presentation foundation.
- Daily Pokémon mission card with Daily XP presentation.
- Recent activity foundation.
- Quick access to LivingDex, Rewards and PC Mode.
- Fullscreen PC Mode.
- PC Mode keeps the exact **6 columns × 5 rows** layout, including vertical/mobile screens.
- Existing V1.7.15 functionality remains the underlying engine.
- Dark-only visual language remains the baseline.
- V2.0.1 Foundation+ adds Statistics, Goals, Activity/Trainer Journal, daily +100 XP reward, Quick Actions and Command Palette.
- Keyboard shortcut: Ctrl/⌘ K opens Command Palette; Escape closes it.

## V2.1.0 — LivingDex / PC 2.0

- Rebuild the LivingDex as a premium Pokémon PC experience.
- Keep 6×5 boxes permanently.
- Cleaner card hierarchy and Pokémon information actions.
- PC fullscreen experience expanded.
- Collection heatmap.
- Generation completion cards.
- Box artwork/themes only where they improve clarity; no arbitrary automatic box sorting.
- Smart completion summaries.
- Collection journey presentation.

## V2.2.0 — Pokémon Database 2.0

- Redesign Pokémon Info into a clean, fast knowledge panel.
- Full basic information.
- Full base stats.
- Evolution chains and branches.
- Evolution conditions.
- Spawn information.
- Breeding information.
- Forms/variants.
- Personal notes.
- Catch/ownership history.
- Evolution history.
- Trade history.
- Pokémon-specific activity history.
- Consistent data source for Info, Evolution Center, Spawn Explorer, Search and Statistics.

### Data audit required before completion

For every Pokémon, audit the current local Cobblemon dataset for:

- evolution relations
- evolution methods/conditions
- spawn biome/location
- dimension
- time/weather/conditions
- breeding data
- egg groups
- forms
- Cobblemon-specific overrides

If the current dataset is incomplete, stop the UI expansion for the missing sections and collect/verify the data first rather than inventing values.

## V2.3.0 — Ownership, Evolution & Trade History

- Distinguish **currently owned**, **previously owned**, **evolved**, and **traded away**.
- When a newly registered Pokémon is an evolution, ask whether it was evolved.
- If evolved, select the current Pokémon it evolved from.
- Remove the previous Pokémon from current ownership while keeping its historical record.
- Record date and evolution relation.
- Show evolution events in activity.
- Replace “Other” with **Trade**.
- Trade flow only offers currently owned Pokémon as the outgoing Pokémon.
- Receiving a traded Pokémon makes it current.
- Store trade history without destroying the historical record.
- Future friend-to-friend trading can connect both sides of the event.

## V2.4.0 — Trainer Progression

- Trainer Level.
- Trainer XP.
- XP from collection actions.
- Extra XP for completing the Daily Pokémon.
- Training XP.
- Achievement XP.
- Goals and goal progress.
- Trainer titles.
- Titles shown on Trainer Cards.
- Large Trainer Card redesign.
- Banner, bio, IGN, favorite Pokémon/type, team and featured rewards.
- Expanded achievement/reward catalogue.
- Secret achievements.
- Achievement showcase.
- Achievement rarity as a collection property, not a player ranking.
- Big 100% LivingDex celebration.
- More collection milestones.

## V2.5.0 — Catch Calendar 2.0

- Rework Catch Calendar as a first-class daily journey.
- Calendar-first visual design.
- Monthly themes/seasons.
- Daily Pokémon presentation.
- Completed/missed/today states.
- Streak milestones.
- Monthly completion statistics.
- Calendar season progress.
- Calendar history.
- Daily Pokémon grants bonus XP.
- Random daily Pokémon selection remains controlled and consistent.
- Daily Pokémon opens directly into Pokémon Info.

## V2.6.0 — Training Center

- New Training Center hub.
- Multiple mini-games rather than one quiz system.
- Who's That Pokémon.
- Type Challenge.
- Evolution Challenge.
- Pokédex Challenge.
- Sprite Challenge.
- Evolution Order.
- Optional Pokémon/Cobblemon sound challenge where legally/technically appropriate assets are available.
- Speed-based challenges.
- 10-question runs.
- Combo system.
- Small XP rewards.
- Personal records.
- Result screen.
- Fast, responsive interactions.
- Training statistics remain persistent.

## V2.7.0 — Social / Activity Feed

- Friends.
- Friend profiles.
- Public/private profile controls.
- Trainer Card sharing.
- Activity feed.
- Feed events for catches.
- Feed events for evolutions.
- Feed events for trades.
- Feed events for achievements.
- Feed events for Trainer Level milestones.
- Feed events for Calendar completion.
- Feed events for Training personal records.
- Feed events for generation/form completion.
- Friend reactions.
- Comments/replies where technically appropriate.
- Facebook-style feed structure without copying branding/UI.
- Personal feed filters.

## V2.8.0 — Statistics & Comparison

- Personal analytics.
- Collection timeline.
- Catch rate over time.
- Most collected types.
- Missing analysis.
- Historical Pokémon count.
- Evolution count.
- Form count.
- Calendar statistics.
- Training statistics.
- Compare yourself with selected players.
- Multi-player comparison table.
- Select which friends to compare.
- Visual progress comparison without declaring a universal “best” player.

## V2.9.0 — Evolution / Spawn / Exploration Tools

- Evolution Center.
- Branching evolution tree.
- Evolution condition viewer.
- Spawn Explorer.
- Biome Explorer.
- “What can spawn here?” views.
- “Where can I find this Pokémon?” views.
- Type-aware visual presentation.
- Regional/generation completion views.
- Pokémon spawn context linked directly from Pokémon Info.

## V2.10.0 — Search / Navigation Power Tools

- Global search.
- Search suggestions.
- Advanced search operators.
- Examples: `type:water`, `missing:true`, `generation:4`, `form:alolan`, `caught:false`.
- Command Palette.
- Keyboard shortcuts.
- Fast navigation between PC, Pokémon, players and rewards.
- Mobile search remains simple; advanced syntax remains optional.

## V2.11.0 — Visual / Interaction Polish

- Dynamic type ambience in Pokémon Info.
- Clean type visual language.
- Rarity presentation where supported by reliable data.
- Legendary/Mythical presentation.
- Better empty states.
- Reward unlock animations.
- Pokémon selection feedback.
- Optional sound design.
- Notification center.
- PC presentation refinements.
- Mobile-specific interaction polish.
- Desktop-specific hover/keyboard polish.
- Maintain V1.7.15-level smoothness as a hard requirement.

## V2.12.0 — Seasons & Reward Shop

- Monthly seasons.
- Seasonal progress.
- Seasonal rewards.
- Reward shop.
- Cosmetics purchased with earned rewards.
- Trainer Card frames.
- PC themes.
- Profile cosmetics.
- Banners.
- Unlockable presentation elements.
- No pay-to-win mechanics.

## V2.13.0 — Trainer Journal / Long-Term Journey

- Trainer Journal.
- Automatic important-event entries.
- Manual journal entries.
- Collection milestones.
- Evolution milestones.
- Trade milestones.
- Calendar milestones.
- Training milestones.
- Personal timeline.
- “What should I do next?” suggestions.
- Personal goals.
- Goal progress cards.

## V2.14.0 — Final Experience Pass

- Full UX consistency pass.
- Mobile and desktop parity.
- Performance profiling.
- Memory/cache review.
- Render/rerender audit.
- Accessibility pass.
- Keyboard navigation.
- Modal/scroll audit.
- Asset loading audit.
- Supabase sync audit.
- Offline/local save audit.
- Export/import compatibility.
- No regressions against V1.7.15.

---

# Core design rules for every V2 build

1. **V1.7.15 smoothness is the minimum bar.**
2. Never sacrifice the fixed **6×5 PC grid**.
3. Desktop and vertical/mobile screens are designed intentionally, not simply scaled.
4. Pokémon Info must stay fast; heavy data is lazy-loaded and cached.
5. No fake Pokémon/Cobblemon data. Missing data gets audited and sourced before UI claims it exists.
6. Existing saves remain compatible wherever possible.
7. Supabase changes are incremental and minimized.
8. Every build is a new ZIP; V1.6 remains untouched.
9. Every build gets syntax, asset, route, ZIP-integrity and static regression checks.
10. Real browser interaction is only claimed when it has actually been performed.
11. New features should be modular so later V2 releases do not require rewriting the stable core.
12. The UI should feel like one **Trainer OS**, not a collection of unrelated pages.
