-- New moderation type: Analysis of Results (spreadsheet-style mark grid,
-- self-submitted by the teacher, visible to all roles at the dashboard level
-- but with a stricter "who can see someone else's" rule than the other three
-- types — see 20260730210500_analysis_of_results_schema.sql. Postgres requires
-- ALTER TYPE ... ADD VALUE to run in its own transaction/migration, separate
-- from anything that references the new value.

ALTER TYPE public.moderation_type ADD VALUE 'analysis_of_results';
