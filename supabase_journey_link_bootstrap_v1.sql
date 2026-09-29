-- Journey-first Minecraft link bootstrap
-- Existing player_saves are preserved; Journey is used only when no Save exists.

CREATE OR REPLACE FUNCTION public.apply_minecraft_player_import(p_minecraft_uuid uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_payload jsonb; v_state jsonb:='{}'; v_training jsonb:='{}'; v_counts jsonb:='{}'; v_shinies jsonb:='{}'; v_journey_owned jsonb:='{}'; v_owned jsonb:='{}';
 v_raw_key text; v_key text; v_in_count int; v_in_shiny int; v_old_count int; v_old_shiny int; v_applied int:=0; v_shiny_applied int:=0; v_event_count int:=0; v_had_save boolean; v_event record;
 v_uuid text; v_entry text; v_shiny boolean; v_partner_name text; v_from_entry text; v_to_entry text; v_from_shiny boolean; v_to_shiny boolean;
 v_trade_remove_uuid uuid; v_trade_add_uuid uuid; v_trade_remove_entry text; v_trade_add_entry text; v_trade_add_shiny boolean;
begin
 if p_minecraft_uuid is null or p_user_id is null then raise exception 'Minecraft UUID and user ID are required.'; end if;
 select exists(select 1 from public.player_saves where user_id=p_user_id) into v_had_save;
 select count(*) into v_event_count from public.minecraft_journey_events where minecraft_uuid=p_minecraft_uuid;

 if not v_had_save and v_event_count>0 then
  for v_event in select * from public.minecraft_journey_events where minecraft_uuid=p_minecraft_uuid order by occurred_at asc,event_id asc loop
   if coalesce((v_event.metadata->>'journey_only')::boolean,false) then continue; end if;
   if v_event.event_type='catch' then
    v_uuid:=coalesce(v_event.pokemon_uuid::text,nullif(v_event.metadata->>'pokemon_uuid',''));
    v_entry:=coalesce(nullif(v_event.entry_id,''),nullif(v_event.metadata->>'pokemon_entry_id',''),nullif(v_event.metadata->>'entry_id',''));
    v_shiny:=coalesce(v_event.shiny,false);
    if v_uuid is null or v_entry is null then continue; end if;
    v_owned:=jsonb_set(v_owned,array[v_uuid],jsonb_build_object('entry_id',v_entry,'shiny',v_shiny,'obtainedAt',v_event.occurred_at,'obtainedMethod','minecraft_catch'),true);
   elsif v_event.event_type='evolution' then
    v_uuid:=coalesce(v_event.pokemon_uuid::text,nullif(v_event.metadata->>'pokemon_uuid',''));
    v_from_entry:=coalesce(nullif(v_event.metadata->>'old_entry_id',''),nullif(v_event.metadata->>'from_entry_id',''));
    v_to_entry:=coalesce(nullif(v_event.entry_id,''),nullif(v_event.metadata->>'entry_id',''));
    v_from_shiny:=coalesce((v_event.metadata->>'from_shiny')::boolean,v_event.shiny,false);
    v_to_shiny:=coalesce((v_event.metadata->>'to_shiny')::boolean,v_event.shiny,v_from_shiny);
    if v_uuid is null or v_to_entry is null then continue; end if;
    v_owned:=jsonb_set(v_owned,array[v_uuid],jsonb_build_object('entry_id',v_to_entry,'shiny',v_to_shiny,'obtainedAt',v_event.occurred_at,'obtainedMethod','minecraft_evolution','obtainedFrom',v_from_entry),true);
   elsif v_event.event_type='release' then
    v_uuid:=coalesce(v_event.pokemon_uuid::text,nullif(v_event.metadata->>'pokemon_uuid',''));
    if v_uuid is null then continue; end if;
    v_owned:=v_owned-v_uuid;
   elsif v_event.event_type='trade' then
    if coalesce(v_event.metadata->>'journey_role','')='a' then
     v_trade_remove_uuid:=nullif(v_event.metadata->>'a_pokemon_uuid','')::uuid; v_trade_add_uuid:=nullif(v_event.metadata->>'b_pokemon_uuid','')::uuid;
     v_trade_remove_entry:=nullif(v_event.metadata->>'a_entry_id',''); v_trade_add_entry:=nullif(v_event.metadata->>'b_entry_id','');
     v_trade_add_shiny:=coalesce((v_event.metadata->>'b_shiny')::boolean,false);
    elsif coalesce(v_event.metadata->>'journey_role','')='b' then
     v_trade_remove_uuid:=nullif(v_event.metadata->>'b_pokemon_uuid','')::uuid; v_trade_add_uuid:=nullif(v_event.metadata->>'a_pokemon_uuid','')::uuid;
     v_trade_remove_entry:=nullif(v_event.metadata->>'b_entry_id',''); v_trade_add_entry:=nullif(v_event.metadata->>'a_entry_id','');
     v_trade_add_shiny:=coalesce((v_event.metadata->>'a_shiny')::boolean,false);
    else continue; end if;
    if v_trade_remove_uuid is not null then v_owned:=v_owned-v_trade_remove_uuid::text; end if;
    if v_trade_add_uuid is not null and v_trade_add_entry is not null then
     v_partner_name:=coalesce(nullif(v_event.metadata->>'trade_partner_name',''),'Unknown Trainer');
     v_owned:=jsonb_set(v_owned,array[v_trade_add_uuid::text],jsonb_build_object('entry_id',v_trade_add_entry,'shiny',v_trade_add_shiny,'obtainedAt',v_event.occurred_at,'obtainedMethod','minecraft_trade','obtainedFrom',v_trade_remove_entry,'tradePartnerName',v_partner_name),true);
    end if;
   end if;
  end loop;

  for v_event in select key,value from jsonb_each(v_owned) loop
   v_entry:=v_event.value->>'entry_id'; if v_entry is null or trim(v_entry)='' then continue; end if;
   v_in_count:=coalesce((v_counts->>v_entry)::int,0)+1; v_counts:=jsonb_set(v_counts,array[v_entry],to_jsonb(v_in_count),true); v_state:=jsonb_set(v_state,array[v_entry],'true',true);
   if coalesce((v_event.value->>'shiny')::boolean,false) then v_in_shiny:=coalesce((v_shinies->>v_entry)::int,0)+1; v_shinies:=jsonb_set(v_shinies,array[v_entry],to_jsonb(v_in_shiny),true); end if;
   v_journey_owned:=jsonb_set(v_journey_owned,array[v_entry],jsonb_build_object('obtainedAt',v_event.value->>'obtainedAt','obtainedMethod',v_event.value->>'obtainedMethod','minecraftPokemonUuid',v_event.key,'shiny',coalesce((v_event.value->>'shiny')::boolean,false)),true);
   v_applied:=v_applied+1;
  end loop;
  select count(*) into v_shiny_applied from jsonb_each(v_owned) where coalesce((value->>'shiny')::boolean,false);
  v_training:=jsonb_build_object('__pokemonCounts',v_counts,'__shinies',v_shinies,'__journey',jsonb_build_object('owned',v_journey_owned,'version',1),'__activity','[]'::jsonb);
  insert into public.player_saves(user_id,state,favorites,notes,team,training,updated_at) values(p_user_id,v_state,'{}','{}','[]',v_training,clock_timestamp()) on conflict(user_id) do nothing;
  return jsonb_build_object('ok',true,'imported',true,'source','minecraft_journey','event_count',v_event_count,'pokemon_count',v_applied,'shiny_count',v_shiny_applied);
 end if;

 select payload into v_payload from public.minecraft_player_imports where minecraft_uuid=p_minecraft_uuid for update;
 if not found then
  insert into public.player_saves(user_id) values(p_user_id) on conflict(user_id) do nothing;
  return jsonb_build_object('ok',true,'imported',false,'source','none','count',0,'shiny_count',0);
 end if;

 select state into v_state from public.player_saves where user_id=p_user_id for update;
 v_state:=coalesce(v_state,'{}'); v_counts:=coalesce(v_state->'__pokemonCounts','{}'); v_shinies:=coalesce(v_state->'__shinies','{}');
 for v_raw_key in select key from jsonb_each(coalesce(v_payload->'counts','{}')) loop
  v_key:=regexp_replace(v_raw_key,'\\|forms$','|main'); v_in_count:=coalesce((v_payload->'counts'->>v_raw_key)::int,0); v_old_count:=coalesce((v_counts->>v_key)::int,0);
  if v_in_count>v_old_count then v_counts:=jsonb_set(v_counts,array[v_key],to_jsonb(v_in_count),true); end if;
  if v_in_count>0 then v_state:=jsonb_set(v_state,array[v_key],'true',true); end if; v_applied:=v_applied+v_in_count;
 end loop;
 for v_raw_key in select key from jsonb_each(coalesce(v_payload->'shinies','{}')) loop
  v_key:=regexp_replace(v_raw_key,'\\|forms$','|main'); v_in_shiny:=coalesce((v_payload->'shinies'->>v_raw_key)::int,0); v_old_shiny:=coalesce((v_shinies->>v_key)::int,0);
  if v_in_shiny>v_old_shiny then v_shinies:=jsonb_set(v_shinies,array[v_key],to_jsonb(v_in_shiny),true); end if; v_shiny_applied:=v_shiny_applied+v_in_shiny;
 end loop;
 v_state:=jsonb_set(v_state,array['__pokemonCounts'],v_counts,true); v_state:=jsonb_set(v_state,array['__shinies'],v_shinies,true);
 update public.player_saves set state=v_state,updated_at=clock_timestamp() where user_id=p_user_id;
 update public.minecraft_player_imports set applied_user_id=p_user_id,applied_at=clock_timestamp() where minecraft_uuid=p_minecraft_uuid;
 return jsonb_build_object('ok',true,'imported',true,'source','minecraft_snapshot','count',v_applied,'shiny_count',v_shiny_applied);
end;
$function$

