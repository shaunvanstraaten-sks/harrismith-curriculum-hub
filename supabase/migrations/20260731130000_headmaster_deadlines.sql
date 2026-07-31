-- Headmaster (Principal) dashboard: term deadlines for each moderation type.
--
-- One school-wide due date per (type, academic year, term) — not per grade.
-- Read/write restricted to Principal + Administrator, matching the pattern
-- used for the Resources library (20260731120000_resources_library.sql):
-- has_role() checks directly rather than is_staff()/is_principal(), since
-- this isn't a moderation_submissions-style access rule.

CREATE TABLE public.moderation_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_type public.moderation_type NOT NULL,
  academic_year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  due_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (moderation_type, academic_year, quarter)
);

ALTER TABLE public.moderation_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Principal or Admin read deadlines" ON public.moderation_deadlines FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'principal') OR public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Principal or Admin manage deadlines" ON public.moderation_deadlines FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'principal') OR public.has_role(auth.uid(), 'administrator'))
  WITH CHECK (public.has_role(auth.uid(), 'principal') OR public.has_role(auth.uid(), 'administrator'));
