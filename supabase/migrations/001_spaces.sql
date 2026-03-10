-- ============================================
-- Migration: Multi-space support
-- Run in Supabase SQL Editor
-- ============================================

-- 1. Create spaces table
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  domain_prompt text not null default '',
  subreddits text[] not null default '{}',
  email_recipients text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spaces enable row level security;
create policy "Allow all on spaces" on public.spaces for all using (true) with check (true);

-- 2. Add space_id to reports
alter table public.reports add column if not exists space_id uuid references public.spaces(id);

-- 3. Seed spaces
insert into public.spaces (id, name, slug, description, domain_prompt, subreddits, email_recipients)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'SDG Lab',
    'sdg-lab',
    'Products for people struggling with loneliness, depression, and social connection',
    'You are a trend analyst for SDG Lab, a company building products for people struggling with loneliness, depression, and social connection.

Your job: analyze Reddit posts and extract ACTIONABLE signals that help founders decide what to build next.

Domain focus: loneliness, companionship, emotional support, peer communication, mental health tools, social anxiety, relationship building.',
    (select coalesce(subreddits, '{lonely,depression,socialskills}') from public.app_settings where id = 'global'),
    (select coalesce(email_recipients, '{}') from public.app_settings where id = 'global')
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'NewCircle',
    'newcircle',
    'Daily companionship and emotional support platform connecting people with kind, trusted companions',
    'You are a trend analyst for NewCircle, a platform that provides daily companionship and emotional support by matching people with kind, trusted human companions for conversation.

Your job: analyze Reddit posts and extract ACTIONABLE signals that help founders decide what to build next.

Domain focus: loneliness (especially among older adults), need for daily human connection, companionship services, emotional support, aging in isolation, alternatives to therapy, peer support models, trust and safety in online connections.',
    '{lonely,aging,eldercare,companionship,widowers}',
    '{}'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Astrix',
    'astrix',
    'Cosmic guide — astrology, spirituality, and personal growth powered by AI',
    'You are a trend analyst for Astrix, an AI-powered cosmic guide that helps people navigate life through astrology, tarot, and spiritual insights.

Your job: analyze Reddit posts and extract ACTIONABLE signals that help founders decide what to build next.

Domain focus: astrology apps, tarot and divination tools, spiritual wellness, horoscope personalization, AI-generated readings, cosmic/zodiac communities, spiritual self-improvement, manifestation practices.',
    '{astrology,tarot,spirituality,zodiac,psychic}',
    '{}'
  )
on conflict (slug) do nothing;

-- 4. Migrate existing reports to SDG Lab space
update public.reports
set space_id = 'a0000000-0000-0000-0000-000000000001'
where space_id is null;
