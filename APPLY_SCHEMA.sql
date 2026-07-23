-- Harrismith Curriculum Hub — full schema loader
-- Generated from supabase/migrations (run once in the SQL Editor of the NEW project).
-- Safe to run on a blank project. Applies: types, tables, RLS, helpers, triggers, seed data.

-- ============================================================
-- FROM: 20260723103219_d298467a-ac87-4276-a263-a63794f075a3.sql
-- ============================================================

-- Roles
CREATE TYPE public.app_role AS ENUM ('administrator','principal','hod','head_of_subject','teacher');
CREATE TYPE public.moderation_type AS ENUM ('pre_moderation','post_moderation','book_control');
CREATE TYPE public.submission_status AS ENUM ('draft','submitted');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('administrator','principal','hod','head_of_subject')
  );
$$;

-- Profiles policies
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT
  TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(),'administrator'))
  WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

-- user_roles policies
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.is_staff(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(),'administrator'))
  WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  -- default to teacher role, pending approval
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Catalogs
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read grades" ON public.grades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage grades" ON public.grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  UNIQUE(name)
);
GRANT SELECT ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- Seed catalogs
INSERT INTO public.departments (name) VALUES ('Foundation Phase'),('Intermediate Phase'),('Senior Phase');
INSERT INTO public.grades (name, sort_order) VALUES
  ('Grade R',0),('Grade 1',1),('Grade 2',2),('Grade 3',3),
  ('Grade 4',4),('Grade 5',5),('Grade 6',6),('Grade 7',7);
INSERT INTO public.subjects (name) VALUES
  ('Mathematics'),('English Home Language'),('Afrikaans Home Language'),
  ('Natural Sciences & Technology'),('Social Sciences'),('Life Skills'),
  ('English First Additional Language'),('Afrikaans First Additional Language');

-- Moderation submissions
CREATE TABLE public.moderation_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_type moderation_type NOT NULL,
  academic_year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  cycle INT NOT NULL CHECK (cycle BETWEEN 1 AND 4),
  weeks TEXT NOT NULL,
  moderation_date DATE NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  head_of_subject_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL,
  total_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  status submission_status NOT NULL DEFAULT 'draft',
  general_comments TEXT,
  recommendations TEXT,
  submitted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_submissions TO authenticated;
GRANT ALL ON public.moderation_submissions TO service_role;
ALTER TABLE public.moderation_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own submissions" ON public.moderation_submissions FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Head of subject can insert" ON public.moderation_submissions FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND created_by = auth.uid()
  );
CREATE POLICY "Head of subject can update drafts" ON public.moderation_submissions FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND status = 'draft'
  )
  WITH CHECK (
    public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator')
  );
CREATE POLICY "Admins delete submissions" ON public.moderation_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));

-- Moderation scores (per-item)
CREATE TABLE public.moderation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.moderation_submissions(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 5,
  comment TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(submission_id, item_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_scores TO authenticated;
GRANT ALL ON public.moderation_scores TO service_role;
ALTER TABLE public.moderation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read scores if can read submission" ON public.moderation_scores FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.moderation_submissions s
    WHERE s.id = submission_id
      AND (s.teacher_id = auth.uid() OR public.is_staff(auth.uid()))
  ));
CREATE POLICY "Head of subject write scores on draft" ON public.moderation_scores FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator'))
    AND EXISTS (SELECT 1 FROM public.moderation_submissions s WHERE s.id = submission_id AND s.status = 'draft')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'head_of_subject') OR public.has_role(auth.uid(),'administrator')
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON public.moderation_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- FROM: 20260723103234_dfadffaa-6f19-4d5f-8639-b4b2bfb2a318.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- FROM: 20260723103733_b9d22e4f-e023-4da6-aa86-582290422ecb.sql
-- ============================================================

ALTER TABLE public.moderation_submissions
  DROP CONSTRAINT IF EXISTS moderation_submissions_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS moderation_submissions_head_of_subject_id_fkey;

ALTER TABLE public.moderation_submissions
  ADD CONSTRAINT moderation_submissions_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT moderation_submissions_head_of_subject_id_fkey
    FOREIGN KEY (head_of_subject_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ============================================================
-- FROM: 20260723170000_grant_execute_rls_helpers.sql
-- ============================================================
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- ============================================================
-- FROM: 20260723180000_add_pre_moderation_metadata.sql
-- ============================================================
ALTER TABLE public.moderation_submissions
  ADD COLUMN IF NOT EXISTS type_of_moderation TEXT,
  ADD COLUMN IF NOT EXISTS type_of_assessment TEXT;
