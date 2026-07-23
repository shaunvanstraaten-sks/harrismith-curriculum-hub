
ALTER TABLE public.moderation_submissions
  DROP CONSTRAINT IF EXISTS moderation_submissions_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS moderation_submissions_head_of_subject_id_fkey;

ALTER TABLE public.moderation_submissions
  ADD CONSTRAINT moderation_submissions_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT moderation_submissions_head_of_subject_id_fkey
    FOREIGN KEY (head_of_subject_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
