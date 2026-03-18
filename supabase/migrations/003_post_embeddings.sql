-- 003_post_embeddings.sql
-- Enable pgvector (if not already enabled) and add table for storing Reddit post embeddings.
-- This migration is additive only and does NOT affect existing daily reports.

-- Enable pgvector extension (safe if already present).
create extension if not exists vector with schema public;

-- Table to store per-post embeddings for similarity search and clustering.
create table if not exists public.post_embeddings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  source text not null default 'reddit',
  subreddit text not null,
  post_id text not null,
  posted_at timestamptz not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure we don't store duplicates for the same space/post.
create unique index if not exists post_embeddings_space_post_unique
  on public.post_embeddings (space_id, post_id);

-- Basic index to help time-bounded queries.
create index if not exists post_embeddings_space_posted_at_idx
  on public.post_embeddings (space_id, posted_at desc);

