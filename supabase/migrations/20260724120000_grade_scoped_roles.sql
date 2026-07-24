-- Grade-scoped roles.
--
-- A HOD for Grade 4 must not be able to see Grade 5/6 data at all — not the
-- statistics, and not the underlying moderation records. That has to be
-- enforced in the database, otherwise the rows stay readable underneath the UI.
--
-- Model: user_roles gains a nullable grade_id.
--   grade_id IS NULL  -> unscoped, applies to every grade (Administrator, Principal)
--   grade_id = <uuid> -> the role only applies to that grade
-- A user may hold several rows to cover several grades (HOD Grade 4 + HOD Grade 5).
-- Existing rows keep grade_id NULL, so current access is unchanged.

-- 1. Scope column ------------------------------------------------------------
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE;

-- Replace UNIQUE(user_id, role) with scope-aware uniqueness. Two partial indexes
-- rather than NULLS NOT DISTINCT, so this works on any supported Postgres.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unscoped_uniq
  ON public.user_roles (user_id, role) WHERE grade_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_scoped_uniq
  ON public.user_roles (user_id, role, grade_id) WHERE grade_id IS NOT NULL;

-- 2. Grade-aware access helper ------------------------------------------------
-- True when the user holds any staff role that is either unscoped or matches
-- the given grade. SECURITY DEFINER so it can read user_roles under RLS.
CREATE OR REPLACE FUNCTION public.can_access_grade(_user_id UUID, _grade_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('administrator','principal','hod','head_of_subject')
      AND (ur.grade_id IS NULL OR ur.grade_id = _grade_id)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_grade(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_grade(uuid, uuid) TO authenticated;

-- 3. Grade-aware RLS ----------------------------------------------------------
-- Teachers always keep their own records (identity-based), staff are grade-scoped.

DROP POLICY IF EXISTS "Teachers see own submissions" ON public.moderation_submissions;
CREATE POLICY "Teachers see own submissions" ON public.moderation_submissions FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.can_access_grade(auth.uid(), grade_id));

DROP POLICY IF EXISTS "Head of subject can insert" ON public.moderation_submissions;
CREATE POLICY "Head of subject can insert" ON public.moderation_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND created_by = auth.uid()
    AND public.can_access_grade(auth.uid(), grade_id)
  );

DROP POLICY IF EXISTS "Head of subject can update drafts" ON public.moderation_submissions;
CREATE POLICY "Head of subject can update drafts" ON public.moderation_submissions FOR UPDATE
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND status = 'draft'
    AND public.can_access_grade(auth.uid(), grade_id)
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND public.can_access_grade(auth.uid(), grade_id)
  );

DROP POLICY IF EXISTS "Read scores if can read submission" ON public.moderation_scores;
CREATE POLICY "Read scores if can read submission" ON public.moderation_scores FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.moderation_submissions s
    WHERE s.id = submission_id
      AND (s.teacher_id = auth.uid() OR public.can_access_grade(auth.uid(), s.grade_id))
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
        AND public.can_access_grade(auth.uid(), s.grade_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator')
  );
