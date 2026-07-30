-- Schema + RLS for the "Analysis of Results" mark grid.
--
-- Unlike the other three moderation types (authored by a Head of
-- Subject/Administrator ABOUT a teacher), Analysis of Results is authored BY
-- the teacher themselves about their own class, and its visibility rule is
-- stricter: only the submitting teacher, Principal, and Administrator may see
-- a given submission — hod/head_of_subject must NOT, unlike every other type
-- where can_access_record() (grade/subject-scoped) grants them access.

-- Envelope columns used only by grid-mode types.
ALTER TABLE public.moderation_submissions
  ADD COLUMN IF NOT EXISTS class_name TEXT,
  ADD COLUMN IF NOT EXISTS question_max_marks NUMERIC(5,2)[];

-- Analysis of Results has no separate reviewer — the teacher submits it
-- directly about their own class, so there is no "head of subject" to record.
ALTER TABLE public.moderation_submissions
  ALTER COLUMN head_of_subject_id DROP NOT NULL;

-- Per-student rows for the grid (10 fixed rows x up to 10 question columns).
-- Column-wise "Total mark" / "Average mark" footer figures are derived at
-- render time from these rows rather than stored, so there is nothing to
-- keep in sync.
CREATE TABLE public.analysis_of_results_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.moderation_submissions(id) ON DELETE CASCADE,
  row_number INT NOT NULL CHECK (row_number BETWEEN 1 AND 10),
  student_name TEXT NOT NULL,
  marks NUMERIC(5,2)[] NOT NULL,
  row_total NUMERIC(6,2) NOT NULL DEFAULT 0,
  row_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, row_number)
);

ALTER TABLE public.analysis_of_results_students ENABLE ROW LEVEL SECURITY;

-- Principal-only helper. is_staff()/can_access_record() deliberately NOT
-- reused here — both bundle hod/head_of_subject in with principal, which is
-- exactly the access this table must NOT grant.
CREATE OR REPLACE FUNCTION public.is_principal(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'principal'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_principal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_principal(uuid) TO authenticated;

-- Rewrite (not just add to) the submissions SELECT policy: RLS permissive
-- policies OR together, so a new policy could only ADD access, never remove
-- the hod/head_of_subject access that can_access_record() already grants via
-- the existing policy. The type must be special-cased inline instead.
DROP POLICY IF EXISTS "Teachers see own submissions" ON public.moderation_submissions;
CREATE POLICY "Teachers see own submissions" ON public.moderation_submissions FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR (moderation_type <> 'analysis_of_results' AND public.can_access_record(auth.uid(), grade_id, subject_id))
    OR (moderation_type = 'analysis_of_results' AND (public.is_principal(auth.uid()) OR public.has_role(auth.uid(), 'administrator')))
  );

-- Teachers can create/edit their own Analysis of Results submissions.
-- Additive: does not touch the existing HOS-only insert/update policies used
-- by the other three types.
CREATE POLICY "Teachers can insert own analysis of results" ON public.moderation_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    moderation_type = 'analysis_of_results'
    AND public.has_role(auth.uid(), 'teacher')
    AND created_by = auth.uid()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "Teachers can update own draft analysis of results" ON public.moderation_submissions FOR UPDATE
  TO authenticated
  USING (
    moderation_type = 'analysis_of_results'
    AND teacher_id = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    moderation_type = 'analysis_of_results'
    AND teacher_id = auth.uid()
  );

-- Child table follows the parent submission's access exactly.
CREATE POLICY "Read analysis rows if can read submission" ON public.analysis_of_results_students FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.moderation_submissions s
    WHERE s.id = submission_id
      AND (
        s.teacher_id = auth.uid()
        OR public.is_principal(auth.uid())
        OR public.has_role(auth.uid(), 'administrator')
      )
  ));

CREATE POLICY "Owning teacher writes analysis rows on draft" ON public.analysis_of_results_students FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.moderation_submissions s
    WHERE s.id = submission_id
      AND s.teacher_id = auth.uid()
      AND s.status = 'draft'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.moderation_submissions s
    WHERE s.id = submission_id
      AND s.teacher_id = auth.uid()
  ));
