-- 010_creative_prompt_template.sql
-- Replace `creative_image_prompt` (single static prompt prepended to every concept)
-- with `creative_prompt_template` (a template that an LLM uses to generate a
-- unique DALL-E prompt per concept).

alter table public.spaces
  add column if not exists creative_prompt_template text;

-- Seed templates for the three existing products
update public.spaces
set creative_prompt_template = E'TYPING DOTS AD\nPROMPT\nCreate a square social media advertising creative (1:1) for a product called Steady.\nThe concept should feel minimal, emotional, and slightly unsettling.\nThe ad should capture the moment of waiting for someone to reply… but they never do.\nTarget audience: US adults 35–65 experiencing loneliness or emotional disconnection.\n\nVISUAL\nDark minimal background (black or very dark gray).\nCentered in the image is a chat interface element showing only:\nthree typing dots inside a message bubble\n"…" animation style (typing indicator)\nNo actual message appears.\n\nEXTRA DETAIL\nAbove the typing bubble, show a contact name:\n"Someone"\n(or optionally: a real name like "Alex")\nUnder it:\n"typing…"\n\nMAIN HEADLINE\nPlaced above or subtly integrated:\n"You waited."\n\nSECOND LINE\nSmall text:\n"But nothing came."\n\nPRODUCT LINE\nVery subtle:\n"Steady connects you with someone who shows up."\n\nCTA\nSmall minimal button:\n"Talk to a real person"\n\nSTYLE\nExtremely minimal\n high contrast\n almost no distractions\nFocus on empty anticipation\n\nCOLOR\nBackground: black\n Text: white / soft gray\n Typing dots: subtle animated feel\n\nEMOTIONAL GOAL\nThe viewer should feel:\n"I know this feeling…"'
where name = 'SDG Lab';

update public.spaces
set creative_prompt_template = E'Create a vertical social media advertisement image, 1080x1920 resolution.\n\nSTYLE:\nPhotorealistic lifestyle photography.\nNatural lighting.\nFeels like a real candid moment, not a staged advertisement.\n\nSCENE:\nA close-up shot of a person''s arm wearing a simple white t-shirt.\n\nPrinted on the sleeve of the t-shirt is a block of text, like a message or announcement.\n\nThe camera focuses on the sleeve text while the rest of the person and background are slightly blurred.\n\nENVIRONMENT:\nWarm indoor lighting, casual everyday environment.\n\nMOOD:\nCurious.\nUnexpected.\nFeels like you noticed a strange message written on someone''s clothing.\n\nCOMPOSITION:\nVertical 9:16.\nText area clearly visible on the sleeve.\n\nTEXT ON THE SLEEVE:\n\nWE ARE LOOKING\nFOR PEOPLE\n\nWHO SOMETIMES\nFEEL LIKE\nTHEY HAVE\nNO ONE\nTO TALK TO.\n\nCTA (smaller line at bottom of sleeve):\n\nYOU''RE NOT\nTHE ONLY ONE.'
where name = 'NewCircle';

update public.spaces
set creative_prompt_template = E'"You weren''t late"\nЭто очень сильная боль одиночества.\nIMAGE PROMPT\nCreate a minimalist spiritual advertisement design, square 1080x1080.\nBackground: soft cosmic gradient sky with subtle stars.\nAt the bottom of the image a small human silhouette stands looking up at the sky.\nAbove them a thin golden constellation path slowly forming across the sky.\nThe constellation lines look like a path leading forward.\nLighting: soft moonlight and warm golden starlight.\nAtmosphere: calm cosmic night with subtle stardust.\nComposition:\n large empty space above for text\n person small at the bottom\n very cinematic but minimal\nStyle:\n premium astrology brand\n modern spiritual design\n clean and elegant\n\nTEXT\nHeadline\nYou weren''t late.\nSubheadline\nYou just didn''t know your timing yet.\nCTA\nDiscover Your Timeline'
where name = 'Astrix';
