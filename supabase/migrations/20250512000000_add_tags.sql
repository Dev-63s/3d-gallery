-- Add tags array to models table
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- GIN index for fast array containment queries
CREATE INDEX IF NOT EXISTS models_tags_gin ON public.models USING GIN (tags);

-- Full-text search index on name + description
CREATE INDEX IF NOT EXISTS models_name_trgm ON public.models USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
