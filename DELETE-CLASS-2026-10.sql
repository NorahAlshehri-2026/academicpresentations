-- =====================================================================
-- Foundations of Academic Presentations: delete a class
--
-- Run ONCE in Supabase -> SQL Editor. Safe to run again.
--
-- Adds delete_section(), which the "Delete this class" button calls.
-- It removes a class together with everything that belongs to it:
-- its student list, every attempt recorded in it, and the feedback,
-- marks and shares on those attempts. Student accounts are NOT deleted;
-- they simply stop belonging to that class.
--
-- Who may delete
--   * an administrator: any class
--   * a teacher: only their own class, and only while nothing in it has
--     an official mark (the academy is the official gradebook)
--
-- It all happens in one step: if anything goes wrong, nothing is deleted.
-- It returns the recording files of the deleted attempts so the website
-- can remove them from storage afterwards.
-- =====================================================================

create or replace function delete_section(sec uuid)
returns text[]
language plpgsql security definer set search_path = public as $$
declare
  t_id   uuid;
  marked int;
  files  text[];
begin
  select teacher_id into t_id from sections where id = sec;
  if not found then
    raise exception 'refused: this class does not exist';
  end if;

  select count(*) into marked
  from grades g join submissions s on s.id = g.submission_id
  where s.section_id = sec;

  if not is_admin() then
    if t_id is distinct from auth.uid() then
      raise exception 'refused: only an administrator or the class teacher can delete a class';
    end if;
    if marked > 0 then
      raise exception 'refused: this class has official marks; only an administrator can delete it';
    end if;
  end if;

  select coalesce(array_agg(file_path) filter (where file_path is not null), '{}')
    into files
  from submissions where section_id = sec;

  delete from submission_shares where submission_id in (select id from submissions where section_id = sec);
  delete from grades            where submission_id in (select id from submissions where section_id = sec);
  delete from feedback          where submission_id in (select id from submissions where section_id = sec);
  delete from submissions       where section_id = sec;
  delete from enrolments        where section_id = sec;
  delete from sections          where id = sec;

  return files;
end $$;

revoke execute on function delete_section(uuid) from public, anon;
grant  execute on function delete_section(uuid) to authenticated;
