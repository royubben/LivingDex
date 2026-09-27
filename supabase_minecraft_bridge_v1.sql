-- Cobblemon LivingDex v2.5 — Minecraft server bridge
-- Source of truth: completed Cobblemon trades on the Minecraft server.
-- Run AFTER the existing LivingDex schema/trade migrations.
--
-- Security model:
--   * Website users create one-time link codes while authenticated.
--   * The server-side bridge sends a private server token.
--   * The bridge never receives a Supabase service_role key.
--   * Completed Minecraft trades are idempotent by minecraft_event_id.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists minecraft_uuid uuid unique;
alter table public.profiles add column if not exists minecraft_username text;
alter table public.profiles add column if not exists minecraft_linked_at timestamptz;
create index if not exists profiles_minecraft_uuid_idx on public.profiles(minecraft_uuid);

create table if not exists public.minecraft_bridge_config (
  id integer primary key check (id=1),
  server_token text not null,
  updated_at timestamptz not null default now()
);

insert into public.minecraft_bridge_config(id,server_token)
values (1,'CHANGE_ME_TO_A_LONG_RANDOM_SECRET')
on conflict (id) do nothing;

revoke all on public.minecraft_bridge_config from anon, authenticated;

create table if not exists public.minecraft_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists minecraft_link_codes_user_idx on public.minecraft_link_codes(user_id,created_at desc);
create index if not exists minecraft_link_codes_code_idx on public.minecraft_link_codes(code);
alter table public.minecraft_link_codes enable row level security;

drop policy if exists "Users manage own Minecraft link codes" on public.minecraft_link_codes;
create policy "Users manage own Minecraft link codes"
on public.minecraft_link_codes for select to authenticated
using (auth.uid()=user_id);

grant select on public.minecraft_link_codes to authenticated;

alter table public.trainer_trades add column if not exists source text not null default 'website';
alter table public.trainer_trades add column if not exists minecraft_event_id uuid;
create unique index if not exists trainer_trades_minecraft_event_uidx
  on public.trainer_trades(minecraft_event_id)
  where minecraft_event_id is not null;
create index if not exists trainer_trades_source_idx on public.trainer_trades(source,created_at desc);

-- Website: create a short-lived code that the player can enter in Minecraft.
create or replace function public.create_minecraft_link_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
begin
  if v_user is null then raise exception 'You must be signed in.'; end if;

  delete from public.minecraft_link_codes
  where user_id=v_user and (used_at is not null or expires_at < now());

  v_code := upper(substr(encode(gen_random_bytes(4),'hex'),1,8));
  insert into public.minecraft_link_codes(user_id,code,expires_at)
  values(v_user,v_code,now()+interval '15 minutes');

  return jsonb_build_object('ok',true,'code',v_code,'expires_at',now()+interval '15 minutes');
end;
$$;
grant execute on function public.create_minecraft_link_code() to authenticated;

-- Server: consume a code and bind the Minecraft UUID to the authenticated Trainer.
create or replace function public.claim_minecraft_link_code(
  p_code text,
  p_minecraft_uuid uuid,
  p_minecraft_username text,
  p_server_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.minecraft_link_codes%rowtype;
  v_user uuid;
begin
  if p_server_token is null or p_server_token <> (select server_token from public.minecraft_bridge_config where id=1) then
    raise exception 'Invalid server token.';
  end if;
  if p_minecraft_uuid is null then raise exception 'Minecraft UUID is required.'; end if;

  select * into c
  from public.minecraft_link_codes
  where code=upper(trim(p_code)) and used_at is null and expires_at > now()
  for update;

  if not found then raise exception 'Link code is invalid or expired.'; end if;
  v_user := c.user_id;

  update public.profiles
  set minecraft_uuid=p_minecraft_uuid,
      minecraft_username=coalesce(nullif(trim(p_minecraft_username),''),minecraft_username),
      minecraft_linked_at=clock_timestamp(),
      updated_at=clock_timestamp()
  where id=v_user;

  update public.minecraft_link_codes set used_at=clock_timestamp() where id=c.id;

  return jsonb_build_object('ok',true,'user_id',v_user,'minecraft_uuid',p_minecraft_uuid,'minecraft_username',p_minecraft_username);
end;
$$;
grant execute on function public.claim_minecraft_link_code(text,uuid,text,text) to anon,authenticated;

-- Server: ingest one completed Minecraft trade atomically.
-- p_payload shape is produced by LivingDex Bridge v0.1.0.
create or replace function public.ingest_minecraft_trade(
  p_server_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
  v_a_uuid uuid;
  v_b_uuid uuid;
  v_a_user uuid;
  v_b_user uuid;
  v_a_entry text;
  v_b_entry text;
  v_a_shiny boolean;
  v_b_shiny boolean;
  v_a_name text;
  v_b_name text;
  v_a_mc text;
  v_b_mc text;
  a public.player_saves%rowtype;
  b public.player_saves%rowtype;
  state_a jsonb;
  state_b jsonb;
  training_a jsonb;
  training_b jsonb;
  counts_a jsonb;
  counts_b jsonb;
  shinies_a jsonb;
  shinies_b jsonb;
  ca integer;
  cb integer;
  trade_id uuid;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  activity_a jsonb;
  activity_b jsonb;
  trimmed_a jsonb;
  trimmed_b jsonb;
  v_existing uuid;
begin
  if p_server_token is null or p_server_token <> (select server_token from public.minecraft_bridge_config where id=1) then
    raise exception 'Invalid server token.';
  end if;

  v_event := nullif(p_payload->>'event_id','')::uuid;
  if v_event is null then raise exception 'event_id is required.'; end if;

  select id into v_existing from public.trainer_trades where minecraft_event_id=v_event limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok',true,'duplicate',true,'trade_id',v_existing);
  end if;

  v_a_uuid := nullif(p_payload->>'a_uuid','')::uuid;
  v_b_uuid := nullif(p_payload->>'b_uuid','')::uuid;
  v_a_entry := nullif(trim(p_payload->>'a_entry_id'),'');
  v_b_entry := nullif(trim(p_payload->>'b_entry_id'),'');
  v_a_shiny := coalesce((p_payload->>'a_shiny')::boolean,false);
  v_b_shiny := coalesce((p_payload->>'b_shiny')::boolean,false);
  v_a_name := coalesce(nullif(trim(p_payload->>'a_name'),''),'Trainer');
  v_b_name := coalesce(nullif(trim(p_payload->>'b_name'),''),'Trainer');
  v_a_mc := coalesce(nullif(trim(p_payload->>'a_mc_name'),''),v_a_name);
  v_b_mc := coalesce(nullif(trim(p_payload->>'b_mc_name'),''),v_b_name);

  if v_a_uuid is null or v_b_uuid is null or v_a_entry is null or v_b_entry is null then
    raise exception 'Minecraft trade payload is incomplete or the Pokémon form is not mapped to the LivingDex.';
  end if;
  if v_a_uuid=v_b_uuid then raise exception 'Minecraft trade participants must be different.'; end if;

  select id into v_a_user from public.profiles where minecraft_uuid=v_a_uuid for update;
  select id into v_b_user from public.profiles where minecraft_uuid=v_b_uuid for update;

  if v_a_user is null or v_b_user is null then
    raise exception 'Both Minecraft players must link their LivingDex accounts first.';
  end if;

  -- Lock in deterministic UUID order to avoid deadlocks when two trades arrive together.
  if v_a_user < v_b_user then
    select * into a from public.player_saves where user_id=v_a_user for update;
    select * into b from public.player_saves where user_id=v_b_user for update;
  else
    select * into b from public.player_saves where user_id=v_b_user for update;
    select * into a from public.player_saves where user_id=v_a_user for update;
  end if;

  if a.user_id is null then
    insert into public.player_saves(user_id) values(v_a_user) on conflict(user_id) do nothing;
    select * into a from public.player_saves where user_id=v_a_user for update;
  end if;
  if b.user_id is null then
    insert into public.player_saves(user_id) values(v_b_user) on conflict(user_id) do nothing;
    select * into b from public.player_saves where user_id=v_b_user for update;
  end if;

  state_a := coalesce(a.state,'{}'::jsonb);
  state_b := coalesce(b.state,'{}'::jsonb);
  training_a := coalesce(a.training,'{}'::jsonb);
  training_b := coalesce(b.training,'{}'::jsonb);
  counts_a := coalesce(training_a->'__pokemonCounts','{}'::jsonb);
  counts_b := coalesce(training_b->'__pokemonCounts','{}'::jsonb);
  shinies_a := coalesce(training_a->'__shinies','{}'::jsonb);
  shinies_b := coalesce(training_b->'__shinies','{}'::jsonb);

  ca := case when v_a_shiny then coalesce((shinies_a->>v_a_entry)::integer,0)
       else coalesce((counts_a->>v_a_entry)::integer,case when coalesce((state_a->>v_a_entry)::boolean,false) then 1 else 0 end) end;
  cb := case when v_b_shiny then coalesce((shinies_b->>v_b_entry)::integer,0)
       else coalesce((counts_b->>v_b_entry)::integer,case when coalesce((state_b->>v_b_entry)::boolean,false) then 1 else 0 end) end;

  if ca < 1 then raise exception '% no longer has the traded Pokémon in the LivingDex.',v_a_name; end if;
  if cb < 1 then raise exception '% no longer has the traded Pokémon in the LivingDex.',v_b_name; end if;

  if v_a_shiny then
    if ca=1 then shinies_a := shinies_a - v_a_entry; else shinies_a := jsonb_set(shinies_a,array[v_a_entry],to_jsonb(ca-1),true); end if;
  else
    if ca=1 then state_a := state_a - v_a_entry; counts_a := counts_a - v_a_entry; else counts_a := jsonb_set(counts_a,array[v_a_entry],to_jsonb(ca-1),true); end if;
  end if;

  if v_b_shiny then
    if cb=1 then shinies_b := shinies_b - v_b_entry; else shinies_b := jsonb_set(shinies_b,array[v_b_entry],to_jsonb(cb-1),true); end if;
  else
    if cb=1 then state_b := state_b - v_b_entry; counts_b := counts_b - v_b_entry; else counts_b := jsonb_set(counts_b,array[v_b_entry],to_jsonb(cb-1),true); end if;
  end if;

  if v_b_shiny then shinies_a := jsonb_set(shinies_a,array[v_b_entry],to_jsonb(greatest(1,coalesce((shinies_a->>v_b_entry)::integer,0)+1)),true);
  else state_a := jsonb_set(state_a,array[v_b_entry],'true'::jsonb,true); counts_a := jsonb_set(counts_a,array[v_b_entry],to_jsonb(greatest(1,coalesce((counts_a->>v_b_entry)::integer,0)+1)),true); end if;
  if v_a_shiny then shinies_b := jsonb_set(shinies_b,array[v_a_entry],to_jsonb(greatest(1,coalesce((shinies_b->>v_a_entry)::integer,0)+1)),true);
  else state_b := jsonb_set(state_b,array[v_a_entry],'true'::jsonb,true); counts_b := jsonb_set(counts_b,array[v_a_entry],to_jsonb(greatest(1,coalesce((counts_b->>v_a_entry)::integer,0)+1)),true); end if;

  activity_a := coalesce(training_a->'__activity','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id','minecraft_trade_'||gen_random_uuid()::text,'ts',now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded',
    'entryId',v_b_entry,'name',v_b_entry,'shiny',v_b_shiny,'sourceEntryId',v_a_entry,'sourceName',v_a_entry,'sourceShiny',v_a_shiny,
    'tradePartnerId',v_b_user,'tradePartnerName',v_b_name,'minecraft',true,'minecraftEventId',v_event));
  activity_b := coalesce(training_b->'__activity','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id','minecraft_trade_'||gen_random_uuid()::text,'ts',now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded',
    'entryId',v_a_entry,'name',v_a_entry,'shiny',v_a_shiny,'sourceEntryId',v_b_entry,'sourceName',v_b_entry,'sourceShiny',v_b_shiny,
    'tradePartnerId',v_a_user,'tradePartnerName',v_a_name,'minecraft',true,'minecraftEventId',v_event));

  select coalesce(jsonb_agg(q.value),'[]'::jsonb) into trimmed_a from (
    select x.value from jsonb_array_elements(activity_a) x(value) order by (x.value->>'ts')::bigint desc limit 1000
  ) q;
  select coalesce(jsonb_agg(q.value),'[]'::jsonb) into trimmed_b from (
    select x.value from jsonb_array_elements(activity_b) x(value) order by (x.value->>'ts')::bigint desc limit 1000
  ) q;

  training_a := jsonb_set(jsonb_set(jsonb_set(training_a,'{__pokemonCounts}',counts_a,true),'{__shinies}',shinies_a,true),'{__activity}',trimmed_a,true);
  training_b := jsonb_set(jsonb_set(jsonb_set(training_b,'{__pokemonCounts}',counts_b,true),'{__shinies}',shinies_b,true),'{__activity}',trimmed_b,true);

  insert into public.trainer_trades(
    from_user_id,to_user_id,from_pokemon,to_pokemon,from_trainer_name,to_trainer_name,status,source,minecraft_event_id
  ) values(
    v_a_user,v_b_user,
    case when v_a_shiny then 'shiny:'||v_a_entry else v_a_entry end,
    case when v_b_shiny then 'shiny:'||v_b_entry else v_b_entry end,
    v_a_name,v_b_name,'accepted','minecraft',v_event
  ) returning id into trade_id;

  update public.player_saves set state=state_a,training=training_a,updated_at=clock_timestamp() where user_id=v_a_user;
  update public.player_saves set state=state_b,training=training_b,updated_at=clock_timestamp() where user_id=v_b_user;

  insert into public.community_notifications(user_id,type,actor_id,actor_name,title,body,trainer_trade_id)
  values
    (v_a_user,'minecraft_trade',v_b_user,v_b_name,'Minecraft trade completed',v_a_name||' and '||v_b_name||' just completed a trade in Minecraft.',trade_id),
    (v_b_user,'minecraft_trade',v_a_user,v_a_name,'Minecraft trade completed',v_a_name||' and '||v_b_name||' just completed a trade in Minecraft.',trade_id);

  return jsonb_build_object('ok',true,'trade_id',trade_id,'source','minecraft','event_id',v_event,'from_user_id',v_a_user,'to_user_id',v_b_user);
end;
$$;
grant execute on function public.ingest_minecraft_trade(text,jsonb) to anon,authenticated;
