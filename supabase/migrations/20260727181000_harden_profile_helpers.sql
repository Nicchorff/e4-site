create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.current_profile_role() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_profile_role() to authenticated;
