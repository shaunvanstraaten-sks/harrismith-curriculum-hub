-- New moderation type: Subject Improvement Plan (repeatable challenge/
-- strategy rows), self-submitted by the teacher like Analysis of Results —
-- see 20260731090500_subject_improvement_plan_schema.sql. Postgres requires
-- ALTER TYPE ... ADD VALUE to run in its own transaction/migration, separate
-- from anything that references the new value.

ALTER TYPE public.moderation_type ADD VALUE 'subject_improvement_plan';
