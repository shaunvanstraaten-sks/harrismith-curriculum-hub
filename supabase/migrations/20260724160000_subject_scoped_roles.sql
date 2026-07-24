-- Subject scope on roles (in addition to grade scope).
--
-- A Head of Subject is subject-bound, not grade-bound: e.g. D van Straaten is
-- HOS for Afrikaans across Grades 4-7, and must NOT see Wiskunde or NS/NST in
-- those grades. Grade-only scoping could not express that.
--
-- Each role row now has two optional dimensions:
--   grade_id   NULL = all grades    | <uuid> = that grade only
--   subject_id NULL = all subjects  | <uuid> = that subject only
-- so "HOS / all grades / Afrikaans HT" is a single row, and
-- "HOD / Grade 4 / all subjects" is another. Administrator and Principal keep
-- both NULL and therefore see everything.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE;

-- One uniqueness rule covering both nullable dimensions. COALESCE to a sentinel
-- so NULL (= "all") participates in uniqueness instead of being distinct.
DROP INDEX IF EXISTS public.user_roles_unscoped_uniq;
DROP INDEX IF EXISTS public.user_roles_scoped_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_scope_uniq ON public.user_roles (
  user_id,
  role,
  COALESCE(grade_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Access helper covering both dimensions. NULL on a dimension means "all".
CREATE OR REPLACE FUNCTION public.can_access_record(_user_id UUID, _grade_id UUID, _subject_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('administrator','principal','hod','head_of_subject')
      AND (ur.grade_id IS NULL OR ur.grade_id = _grade_id)
      AND (ur.subject_id IS NULL OR ur.subject_id = _subject_id)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_record(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_record(uuid, uuid, uuid) TO authenticated;

-- Re-point every policy at the two-dimension helper.
DROP POLICY IF EXISTS "Teachers see own submissions" ON public.moderation_submissions;
CREATE POLICY "Teachers see own submissions" ON public.moderation_submissions FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.can_access_record(auth.uid(), grade_id, subject_id));

DROP POLICY IF EXISTS "Head of subject can insert" ON public.moderation_submissions;
CREATE POLICY "Head of subject can insert" ON public.moderation_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND created_by = auth.uid()
    AND public.can_access_record(auth.uid(), grade_id, subject_id)
  );

DROP POLICY IF EXISTS "Head of subject can update drafts" ON public.moderation_submissions;
CREATE POLICY "Head of subject can update drafts" ON public.moderation_submissions FOR UPDATE
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND status = 'draft'
    AND public.can_access_record(auth.uid(), grade_id, subject_id)
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND public.can_access_record(auth.uid(), grade_id, subject_id)
  );

DROP POLICY IF EXISTS "Read scores if can read submission" ON public.moderation_scores;
CREATE POLICY "Read scores if can read submission" ON public.moderation_scores FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.moderation_submissions s
    WHERE s.id = submission_id
      AND (s.teacher_id = auth.uid() OR public.can_access_record(auth.uid(), s.grade_id, s.subject_id))
  ));

DROP POLICY IF EXISTS "Head of subject write scores on draft" ON public.moderation_scores;
CREATE POLICY "Head of subject write scores on draft" ON public.moderation_scores FOR ALL
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND EXISTS (
      SELECT 1 FROM public.moderation_submissions s
      WHERE s.id = submission_id
        AND s.status = 'draft'
        AND public.can_access_record(auth.uid(), s.grade_id, s.subject_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator')
  );
