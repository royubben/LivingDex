# Cobblemon LivingDex V1.7

## New in V1.7
- Trainer Card on profile with featured badges.
- AI-generated badge artwork for collection, Daily Dex and Training milestones.
- Featured badge picker: up to 5 unlocked badges, synced through existing player_saves training JSON.
- Public player profiles show Trainer Card and featured/earned badges.
- Daily Dex leaderboard supports current streak and best streak.
- Daily Dex calendar day details now show an activity timeline for that date.
- Activity history records catches/uncatches, favorites, team changes, training completion and Daily Dex completion.
- Catch History on Profile, with a full history modal.
- Training Rank ladder: Rookie, Bronze, Silver, Gold, Platinum, Master.
- Per-mode training rank indicators.
- Training milestone badges include session count, Evolution, Type, Generation, perfect score, quiz volume, speed and flawless-session goals.
- Training tracks fast answers and perfect sessions.

## Data / persistence
No new Supabase migration is required. Existing `player_saves.training` stores the new profile/badge/activity metadata. Existing Daily Streak leaderboard migration remains sufficient because streak data stays under `training.__daily`.

## Badge artwork
Badge image assets in `assets/badges/` were generated with AI and integrated as local PNG assets; UI labels are rendered as normal app text.
