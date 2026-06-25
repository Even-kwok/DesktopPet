-- Destructive production cleanup for the first hosting-flow rollout.
-- Scope:
-- 1. Delete all desktop event rows.
-- 2. Delete all pet hosting request rows.
-- 3. Reset pets back to their owner desktop when they are currently hosted away.
--
-- Run the preflight query first, execute the transaction only after explicit approval,
-- then run the postflight query to verify the reset.

-- Preflight status.
select
  (select count(*)::int from public.pet_hosting_requests) as hosting_requests,
  (select count(*)::int from public.desktop_events) as desktop_events,
  (
    select count(*)::int
    from public.pets
    where current_host_user_id is distinct from owner_user_id
       or location_status <> 'at_owner_desktop'
  ) as non_owner_hosted_pets;

begin;

with deleted_events as (
  delete from public.desktop_events
  returning 1
), deleted_requests as (
  delete from public.pet_hosting_requests
  returning 1
), reset_pets as (
  update public.pets
  set current_host_user_id = owner_user_id,
      location_status = 'at_owner_desktop',
      updated_at = now()
  where current_host_user_id is distinct from owner_user_id
     or location_status <> 'at_owner_desktop'
  returning 1
)
select
  (select count(*) from deleted_events) as deleted_desktop_events,
  (select count(*) from deleted_requests) as deleted_hosting_requests,
  (select count(*) from reset_pets) as reset_pets;

commit;

-- Postflight status. Expected result after cleanup:
-- hosting_requests = 0, desktop_events = 0, non_owner_hosted_pets = 0.
select
  (select count(*)::int from public.pet_hosting_requests) as hosting_requests,
  (select count(*)::int from public.desktop_events) as desktop_events,
  (
    select count(*)::int
    from public.pets
    where current_host_user_id is distinct from owner_user_id
       or location_status <> 'at_owner_desktop'
  ) as non_owner_hosted_pets;
