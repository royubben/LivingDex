-- Cobblemon LivingDex V2.0.21 Community Hub hardening
-- Run this as a NEW Supabase SQL query after the original community migration.
-- It adds a server-side 20 minute cooldown for Looking For posts.

create or replace function public.enforce_community_looking_for_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'looking_for' then
    if exists (
      select 1
      from public.community_posts p
      where p.user_id = new.user_id
        and p.kind = 'looking_for'
        and p.created_at > now() - interval '20 minutes'
    ) then
      raise exception 'LOOKING_FOR_COOLDOWN: You can create a Looking For post once every 20 minutes.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists community_looking_for_cooldown on public.community_posts;
create trigger community_looking_for_cooldown
before insert on public.community_posts
for each row execute function public.enforce_community_looking_for_cooldown();
