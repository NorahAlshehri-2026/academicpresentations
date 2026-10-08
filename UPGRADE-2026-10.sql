-- =====================================================================
-- Foundations of Academic Presentations: October 2026 upgrade
--
-- Run ONCE in Supabase -> SQL Editor, after the existing setup.
-- It is safe to run again: every step checks before it changes anything,
-- and it deletes no data.
--
-- What it does
--   1. Privacy: makes the two storage buckets private, and makes the
--      grade and submission views obey each person's access rules.
--   2. The academy owner: the first administrator (Norah Alshehri)
--      becomes the only person who can make teachers and administrators.
--   3. Staff invitation links: one-time links instead of emails.
--   4. Two attempts per speaking task: attempt 1 can be deleted,
--      attempt 2 is final.
--   5. One-tap sharing: classmates hear a recording only when its owner
--      shares it with them, and only then can they score it.
--
-- The last result shows who the owner is. Check that it is Norah.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Every table keeps its access rules switched on
-- ---------------------------------------------------------------------

alter table profiles         enable row level security;
alter table courses          enable row level security;
alter table lessons          enable row level security;
alter table sections         enable row level security;
alter table enrolments       enable row level security;
alter table submissions      enable row level security;
alter table feedback         enable row level security;
alter table grades           enable row level security;
alter table lesson_media     enable row level security;
alter table lesson_progress  enable row level security;
alter table media_purge_log  enable row level security;
alter table questions        enable row level security;
alter table question_options enable row level security;
alter table question_answers enable row level security;
alter table quiz_responses   enable row level security;

-- ---------------------------------------------------------------------
-- 1. PRIVACY
-- ---------------------------------------------------------------------

-- Recordings and lesson media are played through short-lived signed
-- links, so the buckets do not need to be public. While they were,
-- anyone holding a file's address could play it without signing in.
update storage.buckets set public = false where id in ('recordings', 'media');

-- Views normally run with their creator's rights, which skips the access
-- rules on the tables underneath. These make each view read with the
-- rights of the person asking, so a student sees only their own grades
-- and transcripts, and a teacher only their own classes'.
alter view current_grades    set (security_invoker = true);
alter view grade_history     set (security_invoker = true);
alter view my_submissions    set (security_invoker = true);
alter view section_gradebook set (security_invoker = true);
alter view section_totals    set (security_invoker = true);
alter view quiz_scores       set (security_invoker = true);

revoke all on current_grades, grade_history, my_submissions,
              section_gradebook, section_totals, quiz_scores from anon;
revoke insert, update, delete, truncate on current_grades, grade_history, my_submissions,
              section_gradebook, section_totals, quiz_scores from authenticated;
grant select on current_grades, grade_history, my_submissions,
              section_gradebook, section_totals, quiz_scores to authenticated;

-- Classmates' names. The original rule looked up the class list with the
-- student's own (limited) view of it, which shows only their own row, so it
-- never matched anyone and feedback appeared without a name. This checks the
-- class list with full rights instead, and still answers only yes or no.
create or replace function is_classmate(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrolments mine
    join enrolments theirs on theirs.section_id = mine.section_id
    where mine.student_id = auth.uid() and mine.status = 'active'
      and theirs.student_id = other and theirs.status = 'active')
$$;

drop policy if exists profiles_read_classmates on profiles;
create policy profiles_read_classmates on profiles for select using (is_classmate(id));

-- A student may see the name of the teacher of their own class
-- (needed for "Marked by" and for the grade history).
drop policy if exists profiles_read_my_teachers on profiles;
create policy profiles_read_my_teachers on profiles for select using (
  exists (select 1 from enrolments e join sections s on s.id = e.section_id
          where e.student_id = auth.uid() and e.status = 'active' and s.teacher_id = profiles.id));

-- ---------------------------------------------------------------------
-- 2. THE ACADEMY OWNER
-- ---------------------------------------------------------------------

create table if not exists academy_owner (
  singleton  boolean primary key default true check (singleton),
  profile_id uuid not null references profiles(id) on delete restrict,
  set_at     timestamptz not null default now());

alter table academy_owner enable row level security;
revoke all on academy_owner from anon;
revoke insert, update, delete, truncate on academy_owner from authenticated;
grant select on academy_owner to authenticated;
drop policy if exists academy_owner_read on academy_owner;
create policy academy_owner_read on academy_owner for select to authenticated using (true);

-- the first administrator, i.e. the account that set the academy up
insert into academy_owner (profile_id)
select id from profiles where role = 'admin' and active order by created_at limit 1
on conflict (singleton) do nothing;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from academy_owner o where o.profile_id = auth.uid())
$$;

-- Only the owner may give anyone a teacher or administrator role, or take
-- one away. Requests made with the server key (the invitation-link route)
-- and from this SQL editor carry no signed-in user and pass through; the
-- route checks the one-time link itself.
create or replace function guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.role <> 'student' and not is_owner() then
      raise exception 'refused: only the academy owner can make teachers and administrators';
    end if;
  elsif new.role is distinct from old.role and not is_owner() then
    raise exception 'refused: only the academy owner can change a role';
  end if;
  return new;
end $$;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard before insert or update of role on profiles
  for each row execute function guard_role_change();

-- ---------------------------------------------------------------------
-- 3. STAFF INVITATION LINKS
-- ---------------------------------------------------------------------

create table if not exists staff_invites (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  role       user_role not null check (role in ('teacher', 'admin')),
  note       text check (note is null or length(note) <= 120),
  created_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by    uuid references profiles(id) on delete set null,
  used_at    timestamptz,
  revoked    boolean not null default false);

alter table staff_invites enable row level security;
revoke all on staff_invites from anon;
revoke update, delete, truncate on staff_invites from authenticated;
grant select, insert on staff_invites to authenticated;
grant update (revoked) on staff_invites to authenticated;

drop policy if exists staff_invites_read on staff_invites;
create policy staff_invites_read on staff_invites for select to authenticated using (is_owner());
drop policy if exists staff_invites_create on staff_invites;
create policy staff_invites_create on staff_invites for insert to authenticated with check (
  is_owner() and created_by = auth.uid() and used_by is null and used_at is null and not revoked);
drop policy if exists staff_invites_cancel on staff_invites;
create policy staff_invites_cancel on staff_invites for update to authenticated
  using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------
-- 4. TWO ATTEMPTS PER SPEAKING TASK
-- ---------------------------------------------------------------------

create or replace function lesson_is_practice(lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select kind = 'practice' from lessons where id = lesson), false)
$$;

-- The database numbers the attempt itself, so the page cannot get it wrong:
-- the first is 1, the second is 2, and there is no third. If attempt 1 is
-- deleted before attempt 2 is saved, the next recording is attempt 1 again.
-- Attempts saved before this upgrade are kept; anyone who already has two
-- or more simply has no attempts left.
create or replace function submission_attempt_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare has_first boolean; has_later boolean;
begin
  if not lesson_is_practice(new.lesson_id) then return new; end if;

  select coalesce(bool_or(attempt_no = 1), false), coalesce(bool_or(attempt_no >= 2), false)
    into has_first, has_later
  from submissions where lesson_id = new.lesson_id and student_id = new.student_id;

  if has_later then
    raise exception 'refused: both attempts for this activity have been used';
  end if;

  new.attempt_no := case when has_first then 2 else 1 end;
  return new;
end $$;

drop trigger if exists submissions_attempt_guard on submissions;
create trigger submissions_attempt_guard before insert on submissions
  for each row execute function submission_attempt_guard();

-- A student may delete their own first attempt, but never the second.
-- Nothing that has been given an official mark can be deleted.
-- (Administrators keep the power to remove a recording, for example one
-- uploaded by mistake or with unsuitable content.)
drop policy if exists submissions_delete_own on submissions;
create policy submissions_delete_own on submissions for delete using (
  not exists (select 1 from grades g where g.submission_id = submissions.id)
  and (is_admin()
       or (student_id = auth.uid() and (attempt_no = 1 or not lesson_is_practice(lesson_id)))));

-- ---------------------------------------------------------------------
-- 5. ONE-TAP SHARING
-- ---------------------------------------------------------------------

create table if not exists submission_shares (
  submission_id uuid not null references submissions(id) on delete cascade,
  shared_with   uuid not null references profiles(id) on delete cascade,
  shared_by     uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (submission_id, shared_with),
  check (shared_with <> shared_by));

create index if not exists submission_shares_with_idx on submission_shares (shared_with);

create or replace function shared_with_me(sub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from submission_shares x where x.submission_id = sub and x.shared_with = auth.uid())
$$;

create or replace function teaches_submission(sub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from submissions s where s.id = sub and teaches_section(s.section_id))
$$;

-- the owner of a recording may share it with an active member of the same class
create or replace function can_share(sub uuid, target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from submissions s
    join enrolments e on e.section_id = s.section_id and e.student_id = target and e.status = 'active'
    where s.id = sub and s.student_id = auth.uid() and target <> auth.uid())
$$;

create or replace function recording_shared_with_me(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from submissions s join submission_shares x on x.submission_id = s.id
                 where s.file_path = path and x.shared_with = auth.uid())
$$;

create or replace function recording_in_use(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from submissions s where s.file_path = path)
$$;

-- the people a student can share with: the others in that class
create or replace function classmates_in_section(section uuid)
returns table (id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name
  from enrolments e join profiles p on p.id = e.student_id
  where e.section_id = section and e.status = 'active' and p.active and p.id <> auth.uid()
    and enrolled_in_section(section)
  order by p.full_name
$$;

revoke execute on function classmates_in_section(uuid) from public, anon;
grant execute on function classmates_in_section(uuid) to authenticated;

alter table submission_shares enable row level security;
revoke all on submission_shares from anon;
revoke update, truncate on submission_shares from authenticated;
grant select, insert, delete on submission_shares to authenticated;

drop policy if exists shares_read on submission_shares;
create policy shares_read on submission_shares for select to authenticated using (
  shared_with = auth.uid() or shared_by = auth.uid() or is_admin() or teaches_submission(submission_id));
drop policy if exists shares_create on submission_shares;
create policy shares_create on submission_shares for insert to authenticated with check (
  shared_by = auth.uid() and can_share(submission_id, shared_with));
drop policy if exists shares_remove on submission_shares;
create policy shares_remove on submission_shares for delete to authenticated using (shared_by = auth.uid());

-- Classmates no longer see every recording in the class: only their own,
-- and the ones shared with them. Teachers and administrators see all.
drop policy if exists submissions_read on submissions;
create policy submissions_read on submissions for select using (
  student_id = auth.uid() or teaches_section(section_id) or is_admin() or shared_with_me(id));

-- a classmate can score a recording only once it has been shared with them
drop policy if exists feedback_peer_insert on feedback;
create policy feedback_peer_insert on feedback for insert with check (
  source = 'peer' and author_id = auth.uid() and shared_with_me(submission_id));

-- an administrator marking a class they do not teach can leave teacher
-- feedback too (they could already enter the mark itself)
drop policy if exists feedback_teacher_insert on feedback;
create policy feedback_teacher_insert on feedback for insert with check (
  source = 'teacher' and author_id = auth.uid()
  and (teaches_submission(submission_id) or is_admin()));

-- feedback can be edited by its author, but only its scores and comments,
-- not which recording it is on or whether it counts as teacher feedback
revoke update on feedback from anon, authenticated;
grant update (scores, strengths, improve) on feedback to authenticated;

-- one piece of feedback per person per recording; a second one edits the first
create or replace function feedback_one_per_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is not null and exists (
       select 1 from feedback f where f.submission_id = new.submission_id and f.author_id = new.author_id) then
    raise exception 'refused: you have already given feedback on this recording; edit it instead';
  end if;
  return new;
end $$;

drop trigger if exists feedback_one_per_author on feedback;
create trigger feedback_one_per_author before insert on feedback
  for each row execute function feedback_one_per_author();

-- storage: a recording file can be played by its owner, the class teacher,
-- an administrator, or a classmate it has been shared with
drop policy if exists read_recordings_in_my_section on storage.objects;
drop policy if exists "read recordings in my section" on storage.objects;
create policy read_recordings_in_my_section on storage.objects for select to authenticated using (
  bucket_id = 'recordings' and (
    (storage.foldername(name))[2] = auth.uid()::text
    or teaches_section(((storage.foldername(name))[1])::uuid)
    or is_admin()
    or recording_shared_with_me(name)));

-- a student can remove their own file once no attempt points at it
-- (i.e. after deleting attempt 1, or an upload that never became one)
drop policy if exists delete_own_unused_recording on storage.objects;
create policy delete_own_unused_recording on storage.objects for delete to authenticated using (
  bucket_id = 'recordings'
  and (storage.foldername(name))[2] = auth.uid()::text
  and not recording_in_use(name));

commit;

-- ---------------------------------------------------------------------
-- Check: the owner, and the two buckets (both should say false)
-- ---------------------------------------------------------------------
select 'academy owner' as what, p.full_name || ' <' || p.email || '>' as value
from academy_owner o join profiles p on p.id = o.profile_id
union all
select 'bucket ' || id || ' public', public::text from storage.buckets where id in ('recordings', 'media');
