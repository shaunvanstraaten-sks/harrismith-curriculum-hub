-- Resources library: curriculum documents (ATP etc.) organised by phase,
-- grade, and subject, browsable by everyone, uploadable by Administrator/
-- Principal only. Files live in a public Storage bucket (these are ordinary
-- curriculum documents, not sensitive data — a public bucket lets the app
-- link/open a PDF directly without signed-URL plumbing, same reasoning as
-- the repo itself being public).

INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL CHECK (phase IN ('intermediate', 'senior')),
  category TEXT NOT NULL, -- e.g. 'ATP' — free text so new categories don't need a migration
  grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL, -- object path within the 'resources' storage bucket
  file_name TEXT NOT NULL, -- original filename, used for the download link
  file_size INT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view resources" ON public.resources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or Principal manage resources" ON public.resources FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'principal'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'principal'));

-- Storage: public bucket means unauthenticated reads work via the public URL
-- with no policy needed, but authenticated-client operations (list/insert/
-- delete) still go through RLS on storage.objects regardless of the bucket's
-- public flag, so those need explicit policies.
CREATE POLICY "Read resources bucket" ON storage.objects FOR SELECT
  USING (bucket_id = 'resources');

CREATE POLICY "Admin or Principal upload to resources bucket" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resources'
    AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'principal'))
  );

CREATE POLICY "Admin or Principal delete from resources bucket" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'principal'))
  );
