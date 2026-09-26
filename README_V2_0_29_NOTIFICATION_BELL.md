# Cobblemon LivingDex V2.0.29 — Trainer Notification Bell

## Based on
V2.0.28 Linked Trainer Trades.

## Changes
- Added a fixed notification bell to the Trainer Hub top bar, directly next to Profile.
- Unread notification badge shows the current number of unread notifications, capped visually at 9+.
- Bell opens the existing Community Notifications panel.
- Linked Trainer Trade requests can be confirmed or declined directly from the notification panel.
- Notification count refreshes every 30 seconds while the page is visible.
- Bell is hidden from the unread state when the user is signed out/no notification data is available.
- Removed the Feed-only bell placement; notifications are now globally accessible from the top bar.
- Existing V2.0.28 trade flow and Supabase migration remain unchanged.

## Validation
- `node --check v11.js` passed.
- `node --check db.js` passed.
- `node --check app.js` passed.
- ZIP integrity verified after packaging.

## Important
A real two-account browser test is still required to verify the complete Supabase notification/trade flow in the deployed environment.
