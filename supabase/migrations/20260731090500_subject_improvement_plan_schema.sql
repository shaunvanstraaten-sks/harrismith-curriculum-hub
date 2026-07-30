-- Schema + RLS for the "Subject Improvement Plan" form.
--
-- Same shape as Analysis of Results: self-submitted by the teacher, and only
-- the submitting teacher, Principal, and Administrator may see a submission
-- (hod/head_of_subject must NOT). Reuses the is_principal() helper added in
-- 20260730210500_analysis_of_results_schema.sql.

-- Repeatable challenge/strategy rows (dynamic count, unlike the fixed 10x10
-- Analysis of Results grid).
CREATE TABLE public.subject_improvement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.moderation_submissions(id) ON DELETE CASCADE,
  sort_order INT NOT NULL,
  challenge TEXT NOT NULL,
  learner_groups TEXT[] NOT NULL DEFAULT '{}', -- subset of: retained, progressed, all
  strategy TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  performance_indicator TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, sort_order)
);

ALTER TABLE public.subject_improvement_items ENABLE ROW LEVEL SECURITY;

-- Rewrite the submissions SELECT policy again to fold in the second
-- strictly-scoped type alongside analysis_of_results (RLS permissive
-- policies OR together, so this has to be one policy per table, not stacked).
DROP POLICY IF EXISTS "Teachers see own submissions" ON public.moderation_submissions;
CREATE POLICY "Teachers see own submissions" ON public.moderation_submissions FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR (
      moderation_type NOT IN ('analysis_of_results', 'subject_improvement_plan')
      AND public.can_access_record(auth.uid(), grade_id, subject_id)
    )
    OR (
      moderation_type IN ('analysis_of_results', 'subject_improvement_plan')
      AND (public.is_principal(auth.uid()) OR public.has_role(auth.uid(), 'administrator'))
    )
  );

-- Teachers can create/edit their own Subject Improvement Plan submissions.
-- Additive: mirrors the analysis_of_results policies, doesn't touch the
-- HOS-only insert/update policies used by the other two types.
CREATE POLICY "Teachers can insert own subject improvement plan" ON public.moderation_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    moderation_type = 'subject_improvement_plan'
    AND public.has_role(auth.uid(), 'teacher')
    AND created_by = auth.uid()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "Teachers can update own draft subject improvement plan" ON public.moderation_submissions FOR UPDATE
  TO authenticated
  USING (
    moderation_type = 'subject_improvement_plan'
    AND teacher_id = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    moderation_type = 'subject_improvement_plan'
    AND teacher_id = auth.uid()
  );

-- Child table follows the parent submission's access exactly.
CREATE POLICY "Read improvement items if can read submission" ON public.subject_improvement_items FOR SELECT
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

CREATE POLICY "Owning teacher writes improvement items on draft" ON public.subject_improvement_items FOR ALL
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
