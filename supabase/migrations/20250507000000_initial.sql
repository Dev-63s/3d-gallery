-- ============================================================
-- 3D Gallery — Initial Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE NOT NULL,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.models (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  file_path       text        NOT NULL,        -- storage path: {owner_id}/{uuid}.glb
  file_size       bigint      NOT NULL DEFAULT 0,
  original_format text        NOT NULL DEFAULT 'glb',  -- 'glb' | 'gltf' | 'fbx'
  triangle_count  integer     NOT NULL DEFAULT 0,
  thumbnail_path  text,                        -- storage path: {owner_id}/{uuid}.jpg
  view_count      integer     NOT NULL DEFAULT 0,
  is_public       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Row Level Security ───────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models   ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Models
CREATE POLICY "models_select_public"
  ON public.models FOR SELECT USING (is_public = true);

CREATE POLICY "models_select_own"
  ON public.models FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "models_insert_own"
  ON public.models FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "models_update_own"
  ON public.models FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "models_delete_own"
  ON public.models FOR DELETE USING (auth.uid() = owner_id);

-- ─── Triggers & Functions ────────────────────────────────────

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER models_updated_at
  BEFORE UPDATE ON public.models
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Increment view count without requiring owner auth (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.increment_view_count(model_id uuid)
RETURNS void AS $$
  UPDATE public.models
  SET view_count = view_count + 1
  WHERE id = model_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── Storage Buckets ─────────────────────────────────────────
-- Creates buckets if they don't exist. Run once.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'models',
  'models',
  true,
  524288000,  -- 500 MB
  ARRAY['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage Policies ────────────────────────────────────────

-- Models bucket
CREATE POLICY "models_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'models');

CREATE POLICY "models_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'models'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "models_storage_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "models_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Thumbnails bucket
CREATE POLICY "thumbnails_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

CREATE POLICY "thumbnails_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "thumbnails_storage_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "thumbnails_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'thumbnails'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
