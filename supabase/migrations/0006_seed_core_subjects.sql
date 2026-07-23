-- Seed core subjects across existing courses if they are missing.
with base_subjects(title, position) as (
  values
    ('Dermatology', 10),
    ('Infectious diseases', 20),
    ('Respiratory system', 30),
    ('Renal and Urogenital system', 40),
    ('Endocrine', 50),
    ('Hematology', 60),
    ('Cardiology', 70),
    ('Rheumatology and orthopedic', 80),
    ('Neurology', 90),
    ('OBS & GYN', 100),
    ('Pediatric', 110),
    ('Psychiatry', 120),
    ('Biostatistics', 130)
)
insert into subjects (course_id, title, position)
select c.id, s.title, s.position
from courses c
cross join base_subjects s
where not exists (
  select 1
  from subjects existing
  where existing.course_id = c.id
    and lower(existing.title) = lower(s.title)
);
