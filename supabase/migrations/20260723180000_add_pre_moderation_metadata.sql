-- Pre-Moderation captures two categorical fields that have no home in the
-- existing schema: Type of Moderation (School / Department) and Type of
-- Assessment (Test / Exam / Assignment). Additive, nullable, and used only by
-- Pre-Moderation — the scoring model and all existing columns are untouched.

ALTER TABLE public.moderation_submissions
  ADD COLUMN IF NOT EXISTS type_of_moderation TEXT,
  ADD COLUMN IF NOT EXISTS type_of_assessment TEXT;
