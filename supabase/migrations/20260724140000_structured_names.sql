-- Structured names on registration.
--
-- The school's staff lists use "initial + surname" (e.g. "D van Straaten").
-- A free-text "Full name" box produces "Deidre van Straaten", "D. van Straaten",
-- "deidre v straaten" — none of which match. Capturing initials, first name and
-- surname separately lets the system compose the display name consistently,
-- while keeping the first name for formal reports.
--
-- full_name keeps holding the DISPLAY name ("D van Straaten") so every existing
-- dropdown, table and PDF picks it up with no further change.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS initials TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS surname TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_initials TEXT := NULLIF(TRIM(NEW.raw_user_meta_data->>'initials'), '');
  v_first    TEXT := NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '');
  v_surname  TEXT := NULLIF(TRIM(NEW.raw_user_meta_data->>'surname'), '');
  v_full     TEXT;
BEGIN
  -- Compose "D van Straaten" when we have the parts; otherwise fall back to
  -- whatever full_name was supplied (keeps older clients working).
  IF v_initials IS NOT NULL AND v_surname IS NOT NULL THEN
    v_full := v_initials || ' ' || v_surname;
  ELSE
    v_full := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), '');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, username, initials, first_name, surname)
  VALUES (
    NEW.id,
    NEW.email,
    v_full,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    v_initials,
    v_first,
    v_surname
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
