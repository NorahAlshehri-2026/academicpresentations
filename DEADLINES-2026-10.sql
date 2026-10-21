-- =====================================================================
-- Foundations of Academic Presentations: activity deadlines
--
-- Run ONCE in Supabase -> SQL Editor. Safe to run again.
--
-- Adds an optional deadline for each speaking activity in each class.
-- No row = no deadline. A deadline never blocks a recording: anything
-- recorded after it is shown as Late, and the teacher decides the mark.
--
-- Who may do what
--   * the class teacher and administrators: set, change and remove
--   * students in the class: see the deadlines of their own class
-- =====================================================================

create table if not exists deadlines (
  section_id uuid not null references sections(id) on delete cascade,
  lesson_id  uuid not null references lessons(id)  on delete cascade,
  due_at     timestamptz not null,
  note       text check (note is null or length(note) <= 200),
  set_by     uuid default auth.uid() references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (section_id, lesson_id)
);

create index if not exists deadlines_due_at on deadlines (due_at);

-- whether the signed-in user is an active student of a class
create or replace function enrolled_in(sec uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrolments e
    where e.section_id = sec and e.student_id = auth.uid() and e.status = 'active')
$$;
revoke execute on function enrolled_in(uuid) from public, anon;
grant  execute on function enrolled_in(uuid) to authenticated;

-- keep updated_at honest and record who last changed a deadline
create or replace function deadlines_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.set_by := coalesce(auth.uid(), new.set_by);
  return new;
end $$;

drop trigger if exists deadlines_touch on deadlines;
create trigger deadlines_touch before insert or update on deadlines
  for each row execute function deadlines_touch();

alter table deadlines enable row level security;
revoke all on deadlines from anon;
grant select, insert, update, delete on deadlines to authenticated;

drop policy if exists deadlines_read on deadlines;
create policy deadlines_read on deadlines for select to authenticated
  using (teaches_section(section_id) or is_admin() or enrolled_in(section_id));

drop policy if exists deadlines_insert on deadlines;
create policy deadlines_insert on deadlines for insert to authenticated
  with check (teaches_section(section_id) or is_admin());

drop policy if exists deadlines_update on deadlines;
create policy deadlines_update on deadlines for update to authenticated
  using (teaches_section(section_id) or is_admin())
  with check (teaches_section(section_id) or is_admin());

drop policy if exists deadlines_delete on deadlines;
create policy deadlines_delete on deadlines for delete to authenticated
  using (teaches_section(section_id) or is_admin());

-- tell the API about the new table straight away
notify pgrst, 'reload schema';
