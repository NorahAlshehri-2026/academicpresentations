-- =====================================================================
-- Foundations of Academic Presentations — one-shot setup
--
-- Run this ONCE in the Supabase SQL editor, after the four schema files.
-- Before running it, create two PRIVATE buckets in Supabase → Storage:
--     recordings
--     media
-- ("Public bucket" must be OFF on both.)
--
-- It creates the course, its 14 lessons, the storage rules, a test
-- section, and enrols your admin account in that section so you can walk
-- the whole student path yourself.
--
-- Safe to re-run: it replaces the course rather than duplicating it.
-- =====================================================================

begin;


-- remove a previous seed, if any
delete from courses where slug = 'academic-presentations';

insert into courses (owner_id, title, slug, summary, published)
select id,
       'Foundations of Academic Presentations',
       'academic-presentations',
       'Plan, structure and deliver an academic presentation. Ten timed '
       'speaking tasks, each marked against the five-criterion rubric.',
       true
from   profiles
where  role = 'admin'
order  by created_at
limit  1;

-- ---------------------------------------------------------------------
-- Unit 1 — Getting started with a presentation
-- ---------------------------------------------------------------------

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 1, 1, 'reading', 'Why we give presentations',
'Presentations are how academic work reaches other people. A paper is read by a handful; a talk reaches a room.

In this unit you will learn the five stages every academic presentation moves through, the language that opens one, and how to divide a topic into sub-themes an audience can follow.

**The five stages**

1. The general introduction — you greet the audience and introduce yourself.
2. The overview — you say what the topic is and how you will divide it.
3. The body — you talk about the topic in detail.
4. The conclusion — you signal that you are finishing.
5. Questions — you hand over to the audience.

Most weak presentations are weak because stage 2 is missing. The speaker starts talking about the topic without telling the audience where the talk is going, and the audience spends the next five minutes guessing.',
       null, null, null
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 1, 2, 'practice', 'Sixty-second opening',
'Choose one topic and open a presentation on it. Greet the audience, state the topic, say what you intend to do, and preview your points.

Use a different opening phrase from the one you used last time.

**Topics**
- Artificial intelligence is improving cancer diagnosis in hospitals.
- Solar energy is becoming a major power source in desert regions.
- Climate change is increasing extreme weather events worldwide.
- Quantum computers may solve complex problems faster than traditional ones.
- Wearable fitness devices help users monitor heart health.',
       'a1', 120, 60
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 1, 3, 'practice', 'Overview with sub-themes',
'Deliver the general introduction and overview stages only — not the whole talk.

State your main theme, then divide it into two or three sub-themes, using the ordering language from Language Focus 2.

**Frameworks**
- Typical London tourist attractions
- The different effects of global warming',
       'a3', 180, 120
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 1, 4, 'practice', 'Pauses and tone',
'Deliver the framework on ways to improve your English.

Mark your pauses before you record. Vary your tone. Avoid a monotone — it is the single most common reason a well-written talk fails to hold a room.

**Framework**
- Reading English books and magazines
- Listening to the radio and podcasts, and watching television
- Socialising with English-speaking friends',
       'a6', 180, 120
from courses c where c.slug = 'academic-presentations';

-- ---------------------------------------------------------------------
-- Unit 2 — Organizing materials
-- ---------------------------------------------------------------------

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 2, 1, 'reading', 'Narrowing a topic',
'A topic that is too broad cannot be presented well in five minutes. "Transport in Saudi Arabia" is a book; "Why the Riyadh metro changed commuting times for students" is a talk.

**The test**: can you cover it in five minutes with three main points? If not, narrow it.

**Lead-in phrases** move the audience from your overview into your first point:

- So, for starters then, let us look at...
- Right, to begin with, let us look at...
- OK, let us start by looking at...

**Linking phrases** carry them between points:

- Now, I would like to move on to...
- This leads us to my next point:...
- This brings us to the final part of my presentation today:...',
       null, null, null
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 2, 2, 'practice', 'Penicillin framework',
'Deliver your framework on the invention of penicillin.

Add a lead-in phrase before your first sub-theme, and pause in all the right places.',
       'a4', 300, 180
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 2, 3, 'practice', 'Linking the body',
'Present a three-part body on a topic of your choice.

Use a different linking phrase to move into each sub-theme, and make the transitions audible — the audience should hear you change direction.

**Suggested structure**
- History and background
- Examination and scoring
- Problems and criticisms',
       'a5', 240, 180
from courses c where c.slug = 'academic-presentations';

-- ---------------------------------------------------------------------
-- Unit 3 — Acknowledging academic sources
-- ---------------------------------------------------------------------

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 3, 1, 'reading', 'Acknowledging sources aloud',
'In a talk you cannot show a reference list, so you acknowledge sources in speech.

**Useful phrases**

- Writing in 2005, Johnson put forward the view that...
- As Wallace, writing in 2007, has pointed out...
- According to a 2023 World Bank study on urban transport...

**Three sources for the task that follows**

Jiang, F., Jiang, Y., Zhi, H., et al. (2017). Artificial intelligence in healthcare: past, present and future. *Stroke and Vascular Neurology*, 2(4), 230–243. — AI can help doctors diagnose diseases more quickly and accurately by analysing large amounts of medical data, but human doctors still make the final clinical decisions.

Yu, K.-H., & Kohane, I. S. (2019). Artificial intelligence in medicine. *Nature Biomedical Engineering*, 3(10), 719–731. — AI systems learn from large datasets to recognise patterns humans may miss; patient privacy and data security must be protected.

Davenport, T., & Kalakota, R. (2019). The potential for artificial intelligence in healthcare. *Future Healthcare Journal*, 6(2), 94–98. — AI can reduce routine work and improve hospital efficiency, but should support healthcare workers rather than replace them.',
       null, null, null
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 3, 2, 'practice', 'Three sources on AI in healthcare',
'Present two benefits and one concern about AI in healthcare.

Acknowledge all three journal articles orally, using the phrases from the reading, and finish with your own opinion.

The three articles are in the previous lesson. You are marked on whether the acknowledgement sounds natural in speech, not on whether you recite the full reference.',
       'a8', 600, 180
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 3, 3, 'practice', 'Ending and inviting questions',
'Deliver a mini presentation, paying particular attention to the last thirty seconds.

Summarise your main points, signal the end, thank the audience, and invite questions. It is not acceptable simply to stop talking.

**Topics**
- Recycling: purpose, reuse, benefits, challenges
- A free topic of your own choice',
       'a9', 480, 240
from courses c where c.slug = 'academic-presentations';

-- ---------------------------------------------------------------------
-- Unit 4 — Delivering with high impact
-- ---------------------------------------------------------------------

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 4, 1, 'reading', 'Openings that earn attention',
'A conventional opening is safe. An alternative opening is riskier and, done well, far more effective.

**Four techniques**

1. Tell the audience something surprising.
2. Ask the audience a question.
3. Ask the audience to do something.
4. Show them an image, or play them something.

**The language**

- Before I start my presentation today, I would like to ask you all a question...
- Good morning. Before we get started, I have a little task for you. Can you stand up, please, if...
- As you probably all know, Scotland has the highest mountain in the UK. But I wonder how many of you realise that...

**Word stress for impact.** Stressing a word that would normally be contracted adds weight:

- "The situation isn''t going to improve" → "the situation is **NOT** going to improve"
- "It''s been a very difficult time" → "it **HAS** been a very difficult time"',
       null, null, null
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 4, 2, 'practice', 'Alternative opening',
'Open a presentation using one of the alternative techniques: a surprising fact, a question to the audience, or asking them to do something.

Then move into your topic and purpose.

**Topics**
- Global warming and climate change
- Poverty and famine in the developing world
- Doom-scrolling and brain rot
- The environmental technology crisis',
       'a2', 240, 90
from courses c where c.slug = 'academic-presentations';

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 4, 3, 'practice', 'Word stress for impact',
'Read the six statements aloud, each rewritten to carry more impact through word stress.

Stress the words that would normally be contracted.

1. Global warming isn''t going to go away by itself.
2. We''re trying to do something about it.
3. It''s been difficult to convince people.
4. It''s a world-wide issue.
5. We can''t ignore what the planet is telling us.
6. We''re going to have to change our habits.',
       'a7', 120, 60
from courses c where c.slug = 'academic-presentations';

-- ---------------------------------------------------------------------
-- Unit 5 — Putting it together
-- ---------------------------------------------------------------------

insert into lessons (course_id, unit, order_no, kind, title, body, activity_key, prep_seconds, target_seconds)
select c.id, 5, 1, 'practice', 'Full mini presentation',
'Deliver a complete five-minute presentation.

Opening, overview, three developed sub-themes with sources acknowledged, and a signalled ending with questions invited.

This is the rehearsal for your assessed talk, and it is marked on all five rubric criteria.',
       'a10', 600, 300
from courses c where c.slug = 'academic-presentations';

commit;


commit;

-- ---------------------------------------------------------------------
-- 1. STORAGE
-- The path carries the permission check:
--   recordings/<section_id>/<student_id>/<file>
--   media/<course_id>/<lesson_id>/<file>
-- ---------------------------------------------------------------------

drop policy if exists "upload own recording"        on storage.objects;
drop policy if exists "read recordings in my section" on storage.objects;
drop policy if exists "staff upload course media"   on storage.objects;
drop policy if exists "read media for my course"    on storage.objects;

create policy "upload own recording" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[2] = auth.uid()::text
    and enrolled_in_section(((storage.foldername(name))[1])::uuid));

create policy "read recordings in my section" on storage.objects
  for select to authenticated using (
    bucket_id = 'recordings'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or enrolled_in_section(((storage.foldername(name))[1])::uuid)
      or teaches_section(((storage.foldername(name))[1])::uuid)
      or is_admin()));

create policy "staff upload course media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (owns_course(((storage.foldername(name))[1])::uuid) or is_admin()));

create policy "read media for my course" on storage.objects
  for select to authenticated using (
    bucket_id = 'media'
    and (owns_course(((storage.foldername(name))[1])::uuid)
         or teaches_course(((storage.foldername(name))[1])::uuid)
         or enrolled_in_course(((storage.foldername(name))[1])::uuid)
         or is_admin()));

-- ---------------------------------------------------------------------
-- 2. A SECTION, AND YOU IN IT
--
-- Recordings belong to a class, so there has to be one before anything
-- can be submitted. This makes a section taught by the admin account and
-- enrols that same account in it, so you can walk the whole student path
-- yourself before inviting anyone.
--
-- When you invite real students, make them their own section and let the
-- join link enrol them.
-- ---------------------------------------------------------------------

insert into sections (course_id, teacher_id, number, term)
select c.id, p.id, 'TEST', 'Trial'
from   courses c
cross  join (select id from profiles where role = 'admin' order by created_at limit 1) p
where  c.slug = 'academic-presentations'
  and  not exists (
         select 1 from sections s
         where s.course_id = c.id and s.number = 'TEST' and s.term = 'Trial');

insert into enrolments (section_id, student_id)
select s.id, p.id
from   sections s
join   courses c on c.id = s.course_id
cross  join (select id from profiles where role = 'admin' order by created_at limit 1) p
where  c.slug = 'academic-presentations'
  and  s.number = 'TEST'
  and  not exists (
         select 1 from enrolments e
         where e.section_id = s.id and e.student_id = p.id);

-- The join link for this section, and the course link:
select 'join link'   as what, '/join/' || s.invite_code as url
from   sections s join courses c on c.id = s.course_id
where  c.slug = 'academic-presentations' and s.number = 'TEST'
union all
select 'course link', '/learn/' || c.id
from   courses c where c.slug = 'academic-presentations';


-- =====================================================================
-- Check: you should see the course with 14 lessons, then two links.
-- =====================================================================

select c.title, count(l.id) as lessons
from   courses c join lessons l on l.course_id = c.id
where  c.slug = 'academic-presentations'
group  by c.title;
