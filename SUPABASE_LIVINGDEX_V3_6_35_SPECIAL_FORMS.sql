-- LivingDex v3.6.35 / Bridge v0.3.6 special-form synchronization
--
-- The LivingDex IDs are stored as JSONB keys in player_saves.state and
-- player_saves.training.__pokemonCounts / __shinies. No schema change is
-- required for the new IDs; the Minecraft RPC already accepts text entry IDs.
-- Run this migration after deploying the website/bridge mapping.

BEGIN;

-- Sanity checks: fail rather than silently applying against an unexpected schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='player_saves' AND column_name='state'
  ) THEN
    RAISE EXCEPTION 'player_saves.state is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='player_saves' AND column_name='training'
  ) THEN
    RAISE EXCEPTION 'player_saves.training is missing';
  END IF;
END $$;

-- Canonical IDs introduced/required by v3.6.35 / Bridge v0.3.6:
--   floette|eternal|670|special
--   pumpkaboo-small|base|710|special
--   pumpkaboo-large|base|710|special
--   pumpkaboo-super|base|710|special
--   furfrou|furfrou-matcha|676|special
--   furfrou|furfrou-lavender|676|special
--   furfrou|furfrou-cinnamon|676|special
--   furfrou|furfrou-crusader|676|special
--   furfrou|furfrou-rocker|676|special
--   furfrou|furfrou-mourner|676|special
--
-- Deoxys, Maushold and Gimmighoul use existing website IDs, so no data
-- migration is necessary for them; the bridge now resolves their aspects.

-- Merge legacy Flabebe/Floette/Florges flower IDs that older bridge builds
-- could have written as main IDs into the canonical special IDs.
DO $$
DECLARE
  r record;
  old_id text;
  new_id text;
  old_count integer;
  new_count integer;
  old_shiny integer;
  new_shiny integer;
  mapping jsonb := '{
    "flabebe|yellow|669|main":"flabebe|yellow|669|special",
    "flabebe|orange|669|main":"flabebe|orange|669|special",
    "flabebe|blue|669|main":"flabebe|blue|669|special",
    "flabebe|white|669|main":"flabebe|white|669|special",
    "floette|yellow|670|main":"floette|yellow|670|special",
    "floette|orange|670|main":"floette|orange|670|special",
    "floette|blue|670|main":"floette|blue|670|special",
    "floette|white|670|main":"floette|white|670|special",
    "florges|yellow|671|main":"florges|yellow|671|special",
    "florges|orange|671|main":"florges|orange|671|special",
    "florges|blue|671|main":"florges|blue|671|special",
    "florges|white|671|main":"florges|white|671|special"
  }'::jsonb;
BEGIN
  FOR r IN SELECT user_id, state, training FROM public.player_saves LOOP
    -- State: merge caught flags, then remove legacy key.
    FOR old_id, new_id IN SELECT key, value FROM jsonb_each_text(mapping) LOOP
      IF COALESCE(r.state->old_id, 'false'::jsonb) = 'true'::jsonb THEN
        UPDATE public.player_saves
        SET state = jsonb_set(COALESCE(state,'{}'::jsonb), ARRAY[new_id], 'true'::jsonb, true)
        WHERE user_id=r.user_id;
      END IF;
      UPDATE public.player_saves
      SET state = COALESCE(state,'{}'::jsonb) - old_id
      WHERE user_id=r.user_id AND state ? old_id;

      old_count := COALESCE((r.training->'__pokemonCounts'->>old_id)::integer,0);
      new_count := COALESCE((r.training->'__pokemonCounts'->>new_id)::integer,0);
      IF old_count > 0 THEN
        UPDATE public.player_saves
        SET training = jsonb_set(
          COALESCE(training,'{}'::jsonb),
          ARRAY['__pokemonCounts',new_id],
          to_jsonb(new_count + old_count), true)
        WHERE user_id=r.user_id;
      END IF;
      UPDATE public.player_saves
      SET training = jsonb_set(
        COALESCE(training,'{}'::jsonb),
        '{__pokemonCounts}',
        COALESCE(training->'__pokemonCounts','{}'::jsonb) - old_id,
        true)
      WHERE user_id=r.user_id AND COALESCE(training->'__pokemonCounts','{}'::jsonb) ? old_id;

      old_shiny := COALESCE((r.training->'__shinies'->>old_id)::integer,0);
      new_shiny := COALESCE((r.training->'__shinies'->>new_id)::integer,0);
      IF old_shiny > 0 THEN
        UPDATE public.player_saves
        SET training = jsonb_set(
          COALESCE(training,'{}'::jsonb),
          ARRAY['__shinies',new_id],
          to_jsonb(new_shiny + old_shiny), true)
        WHERE user_id=r.user_id;
      END IF;
      UPDATE public.player_saves
      SET training = jsonb_set(
        COALESCE(training,'{}'::jsonb),
        '{__shinies}',
        COALESCE(training->'__shinies','{}'::jsonb) - old_id,
        true)
      WHERE user_id=r.user_id AND COALESCE(training->'__shinies','{}'::jsonb) ? old_id;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
