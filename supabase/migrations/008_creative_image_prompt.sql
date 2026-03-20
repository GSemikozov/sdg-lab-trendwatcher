-- Optional per-space instructions for DALL-E image generation (weekly creatives).
alter table public.spaces
  add column if not exists creative_image_prompt text not null default '';
