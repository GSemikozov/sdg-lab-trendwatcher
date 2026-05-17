-- 012_restore_seed_spaces.sql
-- Restore the three product spaces if they were deleted from the UI (hard DELETE).
-- Uses stable UUIDs so existing rows referencing these IDs work again after re-insert.
-- Run in Supabase Dashboard → SQL Editor (or: supabase db push).
--
-- Note: Deleting spaces may have CASCADE-deleted embeddings, clusters, aggregate_reports.
-- Daily reports usually reference spaces without CASCADE — they may still exist with orphaned space_id.

insert into public.spaces (
  id,
  name,
  slug,
  description,
  domain_prompt,
  subreddits,
  email_recipients,
  is_active
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'SDG Lab',
    'sdg-lab',
    'Products for people struggling with loneliness, depression, and social connection',
    'You are a trend analyst for SDG Lab, a company building products for people struggling with loneliness, depression, and social connection.

Your job: analyze Reddit posts and extract ACTIONABLE signals that help founders decide what to build next.

Domain focus: loneliness, companionship, emotional support, peer communication, mental health tools, social anxiety, relationship building.',
    coalesce(
      (select subreddits from public.app_settings where id = 'global' limit 1),
      '{lonely,depression,socialskills}'::text[]
    ),
    coalesce(
      (select email_recipients from public.app_settings where id = 'global' limit 1),
      '{}'::text[]
    ),
    true
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
    '{}',
    true
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
    '{}',
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  domain_prompt = excluded.domain_prompt,
  subreddits = excluded.subreddits,
  email_recipients = excluded.email_recipients,
  is_active = excluded.is_active,
  updated_at = now();

-- Creative templates (same as migration 010)
update public.spaces
set creative_prompt_template = E'TYPING DOTS AD\nPROMPT\nCreate a square social media advertising creative (1:1) for a product called Steady.\nThe concept should feel minimal, emotional, and slightly unsettling.\nThe ad should capture the moment of waiting for someone to reply… but they never do.\nTarget audience: US adults 35–65 experiencing loneliness or emotional disconnection.\n\nVISUAL\nDark minimal background (black or very dark gray).\nCentered in the image is a chat interface element showing only:\nthree typing dots inside a message bubble\n"…" animation style (typing indicator)\nNo actual message appears.\n\nEXTRA DETAIL\nAbove the typing bubble, show a contact name:\n"Someone"\n(or optionally: a real name like "Alex")\nUnder it:\n"typing…"\n\nMAIN HEADLINE\nPlaced above or subtly integrated:\n"You waited."\n\nSECOND LINE\nSmall text:\n"But nothing came."\n\nPRODUCT LINE\nVery subtle:\n"Steady connects you with someone who shows up."\n\nCTA\nSmall minimal button:\n"Talk to a real person"\n\nSTYLE\nExtremely minimal\n high contrast\n almost no distractions\nFocus on empty anticipation\n\nCOLOR\nBackground: black\n Text: white / soft gray\n Typing dots: subtle animated feel\n\nEMOTIONAL GOAL\nThe viewer should feel:\n"I know this feeling…"'
where slug = 'sdg-lab';

update public.spaces
set creative_prompt_template = E'Create a vertical social media advertisement image, 1080x1920 resolution.\n\nSTYLE:\nPhotorealistic lifestyle photography.\nNatural lighting.\nFeels like a real candid moment, not a staged advertisement.\n\nSCENE:\nA close-up shot of a person''s arm wearing a simple white t-shirt.\n\nPrinted on the sleeve of the t-shirt is a block of text, like a message or announcement.\n\nThe camera focuses on the sleeve text while the rest of the person and background are slightly blurred.\n\nENVIRONMENT:\nWarm indoor lighting, casual everyday environment.\n\nMOOD:\nCurious.\nUnexpected.\nFeels like you noticed a strange message written on someone''s clothing.\n\nCOMPOSITION:\nVertical 9:16.\nText area clearly visible on the sleeve.\n\nTEXT ON THE SLEEVE:\n\nWE ARE LOOKING\nFOR PEOPLE\n\nWHO SOMETIMES\nFEEL LIKE\nTHEY HAVE\nNO ONE\nTO TALK TO.\n\nCTA (smaller line at bottom of sleeve):\n\nYOU''RE NOT\nTHE ONLY ONE.'
where slug = 'newcircle';

update public.spaces
set creative_prompt_template = E'"You weren''t late"\nЭто очень сильная боль одиночества.\nIMAGE PROMPT\nCreate a minimalist spiritual advertisement design, square 1080x1080.\nBackground: soft cosmic gradient sky with subtle stars.\nAt the bottom of the image a small human silhouette stands looking up at the sky.\nAbove them a thin golden constellation path slowly forming across the sky.\nThe constellation lines look like a path leading forward.\nLighting: soft moonlight and warm golden starlight.\nAtmosphere: calm cosmic night with subtle stardust.\nComposition:\n large empty space above for text\n person small at the bottom\n very cinematic but minimal\nStyle:\n premium astrology brand\n modern spiritual design\n clean and elegant\n\nTEXT\nHeadline\nYou weren''t late.\nSubheadline\nYou just didn''t know your timing yet.\nCTA\nDiscover Your Timeline'
where slug = 'astrix';
