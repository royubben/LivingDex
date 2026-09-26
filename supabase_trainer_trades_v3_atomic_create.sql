-- Cobblemon LivingDex V2.0.31 — Atomic linked-trade creation + notification
-- Run this as a NEW Supabase query after the previous trainer-trade migrations.
-- This removes the client-side notification INSERT from the critical trade flow.

create or replace function public.create_trainer_trade(
  p_to_user_id uuid,
  p_from_pokemon text,
  p_to_pokemon text,
  p_from_trainer_name text,
  p_to_trainer_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_to_name text;
begin
  if v_from_user_id is null then
    raise exception 'You must be signed in to create a trade.';
  end if;
  if p_to_user_id is null or p_to_user_id = v_from_user_id then
    raise exception 'Choose another Trainer.';
  end if;
  if nullif(trim(coalesce(p_from_pokemon,'')),'') is null
     or nullif(trim(coalesce(p_to_pokemon,'')),'') is null then
    raise exception 'Choose both Pokémon.';
  end if;

  -- Resolve the recipient from the same visibility rules used by the client.
  select display_name into v_to_name
  from public.profiles
  where id = p_to_user_id
    and show_profile = true
    and show_in_players = true;

  if not found then
    raise exception 'Trainer not found or not visible.';
  end if;

  insert into public.trainer_trades(
    from_user_id,to_user_id,from_pokemon,to_pokemon,
    from_trainer_name,to_trainer_name,status
  ) values (
    v_from_user_id,p_to_user_id,trim(p_from_pokemon),trim(p_to_pokemon),
    coalesce(nullif(trim(p_from_trainer_name),''),'Trainer'),
    coalesce(nullif(trim(p_to_trainer_name),''),v_to_name,'Trainer'),
    'pending'
  ) returning id into v_trade_id;

  -- SECURITY DEFINER means this insert is performed by the trusted database
  -- function, not by the browser's client role/RLS policy.
  insert into public.community_notifications(
    user_id,type,actor_id,actor_name,title,body,trainer_trade_id
  ) values (
    p_to_user_id,
    'trainer_trade_request',
    v_from_user_id,
    coalesce(nullif(trim(p_from_trainer_name),''),'Trainer'),
    'New trade request',
    coalesce(nullif(trim(p_from_trainer_name),''),'Trainer')
      || ' wants to trade ' || trim(p_from_pokemon)
      || ' for ' || trim(p_to_pokemon) || '.',
    v_trade_id
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_trade_id,
    'to_user_id', p_to_user_id,
    'from_pokemon', trim(p_from_pokemon),
    'to_pokemon', trim(p_to_pokemon)
  );
end;
$$;

grant execute on function public.create_trainer_trade(uuid,text,text,text,text) to authenticated;
