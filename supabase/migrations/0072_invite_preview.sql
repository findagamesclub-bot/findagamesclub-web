-- 0072 · Showing an invitation to somebody who has no account yet
--
-- An invitation is the one thing in the app that has to be readable by a
-- stranger. The whole point of it is to reach a treasurer or a co-organiser
-- who has never used the site, and the select policy on club_team_invites
-- quite rightly returns nothing to them: it matches on the reader's profile or
-- the address on their sign-in, and they have neither.
--
-- So they were bounced to a sign-in form with no mention of the club, the
-- role, or the fact that they need to create an account first. This returns
-- the facts the email already told them, to anybody holding the token, so the
-- page can say what they have been asked to do before asking them to sign up.
--
-- Deliberately not returned: the address it was sent to, the ids, and anything
-- about the club beyond its name and slug. The token proves somebody was sent
-- the link; it does not prove they are the person it was for, and accepting
-- still checks that separately.

create or replace function public.invite_preview(p_token uuid)
returns table (
  club_name text,
  club_slug text,
  role text,
  invited_by text,
  status text,
  /** Whether the address already has an account, so the page can lead with the
      right of the two buttons rather than offering both equally. */
  has_account boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.name,
    c.slug::text,
    i.role,
    coalesce(nullif(btrim(p.full_name), ''), 'The club'),
    case
      when i.revoked_at is not null then 'withdrawn'
      when i.declined_at is not null then 'declined'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'open'
    end,
    i.profile_id is not null
      or exists (select 1 from auth.users u where lower(u.email) = i.email)
  from public.club_team_invites i
  join public.clubs c on c.id = i.club_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

revoke all on function public.invite_preview(uuid) from public;
grant execute on function public.invite_preview(uuid) to anon, authenticated;
