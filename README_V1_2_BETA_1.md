# Cobblemon LivingDex — V1.2 BETA 2

This version adds the online/community layer on top of V1.1 BETA 4:

- Supabase email/password accounts
- Online LivingDex save synchronization
- Public Players directory
- Public player profiles
- Optional public team display
- Leaderboard views for LivingDex, Training and Favorites
- Privacy controls for Players, Leaderboard and Team
- Local/offline mode remains available when Supabase is not configured

## Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run **supabase_schema.sql** in full.
4. In Supabase Auth settings, configure the email/password provider and your GitHub Pages site URL/redirect URL.
5. Open **db-config.js** and enter:
   - `url`: your Supabase Project URL
   - `key`: your browser-safe publishable key (older projects may label this `anon`)
6. Do **not** put a `service_role` or secret key in `db-config.js`.
7. Open `index.html` locally and test account creation/login first.
8. Only after local testing, upload the files to GitHub Pages.

Supabase Auth uses the browser client and persistent sessions. Database access is protected with Row Level Security policies. The public leaderboard/profile views expose only the fields needed by the community features.

## First-login behavior

The existing local collection is retained. When a newly created online account has an empty remote save, the current local collection is uploaded instead of being overwritten.

After that, changes are synchronized to the user's own online save.

## Security

The frontend must only contain the Supabase publishable/anon key. Never expose a Supabase service-role/secret key in the GitHub repository.

## V1.2 BETA 2 scope

This is the first database/accounts/community build. It does not yet add friends, private messaging, achievements for the community, moderation tools, or social activity feeds.
