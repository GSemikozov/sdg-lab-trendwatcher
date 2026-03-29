/**
 * Supabase Edge Function: generate-creatives
 *
 * Generates images via DALL-E 3 for each creative concept and uploads to Google Drive.
 * Supports OAuth (refresh token) or Service Account. OAuth works with My Drive and Shared Drives.
 *
 * Usage:
 *   POST { space_id, space_name, period_start, concept_index, concepts: AdConcept[] }
 *   POST { space_name, period_start, create_folders_only: true }
 *   POST { ..., date_folder_id }
 *
 * Drive auth: GOOGLE_DRIVE_REFRESH_TOKEN + CLIENT_ID + CLIENT_SECRET (OAuth)
 */

const OPENAI_BASE = 'https://api.openai.com/v1';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const IMAGES_PER_BATCH = 5; // ~50s per batch to avoid timeout; 2 batches = 10 images

function toFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('storageQuotaExceeded') || msg.includes('Service Accounts do not have storage quota')) {
    return 'Google Drive: use a Shared Drive (not My Drive). Create a Shared Drive, add the service account as a member, and use that folder ID in GOOGLE_DRIVE_ROOT_FOLDER_ID.';
  }
  if (msg.includes('Drive upload error') || msg.includes('Drive list error') || msg.includes('Drive create folder')) {
    return 'Google Drive error. Check folder permissions and that the root folder is in a Shared Drive.';
  }
  if (msg.includes('DALL-E error')) {
    return 'Image generation failed. Check OPENAI_API_KEY and DALL-E quota.';
  }
  if (msg.includes('OAuth refresh failed') || msg.includes('invalid_grant')) {
    return 'Google Drive OAuth token expired. Run the OAuth flow again to get a new refresh token.';
  }
  return msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdConcept {
  title: string;
  description: string;
}

// --- Google Drive ---

function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?*:|"<>']/g, '-').trim() || 'unnamed';
}

async function getDriveTokenOAuth(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth refresh failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function getDriveToken(env: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  return getDriveTokenOAuth(env.clientId, env.clientSecret, env.refreshToken);
}

async function findOrCreateFolder(
  accessToken: string,
  parentId: string,
  folderName: string,
): Promise<string> {
  const sanitized = sanitizeFolderName(folderName);
  const q = `'${parentId}' in parents and name='${sanitized}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listRes = await fetch(
    `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Drive list error: ${listRes.status} ${err}`);
  }
  const list = (await listRes.json()) as { files: { id: string }[] };
  if (list.files?.length > 0) return list.files[0].id;

  const createRes = await fetch(`${DRIVE_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: sanitized,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Drive create folder error: ${createRes.status} ${err}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function uploadToDrive(
  accessToken: string,
  parentId: string,
  fileName: string,
  pngBase64: string,
): Promise<string> {
  const boundary = 'batch_' + crypto.randomUUID();
  const meta = JSON.stringify({
    name: sanitizeFolderName(fileName) + '.png',
    parents: [parentId],
  });
  const enc = new TextEncoder();
  const part1 = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
  );
  const binary = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
  const part3 = enc.encode(`\r\n--${boundary}--\r\n`);
  const full = new Uint8Array(part1.length + binary.length + part3.length);
  full.set(part1, 0);
  full.set(binary, part1.length);
  full.set(part3, part1.length + binary.length);

  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: full,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload error: ${res.status} ${err}`);
  }
  const file = (await res.json()) as { id: string };
  return file.id;
}

// --- LLM prompt generation ---

const PROMPT_GEN_SYSTEM = `You are an expert advertising creative director.
Given a TEMPLATE (the brand's visual style and tone guide) and a specific AD CONCEPT
(title + description from a weekly trend report), produce a single detailed DALL-E image
generation prompt that merges the brand template style with this specific concept.

Rules:
- Output ONLY the DALL-E prompt text, nothing else (no markdown, no explanation).
- Keep the brand's visual language, format, colors, and mood from the template.
- Incorporate the concept's theme, emotion, and message naturally.
- Include concrete visual details (scene, lighting, composition, text overlays if appropriate).
- The prompt must be ≤ 950 characters (DALL-E limit is 1000).`;

const DEFAULT_IMAGE_PROMPT_PREFIX =
  'Meta ad creative concept. Style: modern, high-contrast, suitable for social media feed. No legible text in the image.';

async function generatePromptForConcept(
  openaiKey: string,
  template: string,
  concept: AdConcept,
): Promise<string> {
  const userMsg = `TEMPLATE:\n${template}\n\nAD CONCEPT:\nTitle: ${concept.title}\nDescription: ${concept.description}`;
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PROMPT_GEN_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 400,
      temperature: 0.8,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Prompt-gen LLM error ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return (data.choices[0]?.message?.content ?? '').trim();
}

function buildFallbackPrompt(concept: AdConcept): string {
  return `${DEFAULT_IMAGE_PROMPT_PREFIX}\n\nConcept title: "${concept.title}". ${concept.description}`;
}

// --- DALL-E 3 ---

async function generateImage(
  openaiKey: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 1000),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DALL-E error ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data: { b64_json: string }[] };
  return data.data[0].b64_json;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** One image: retry DALL-E + Drive on transient failures (rate limits, timeouts). */
async function generateUploadOneWithRetries(
  openaiKey: string,
  accessToken: string,
  conceptFolderId: string,
  fileName: string,
  dallePrompt: string,
  maxAttempts = 3,
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const b64 = await generateImage(openaiKey, dallePrompt);
      const fileId = await uploadToDrive(accessToken, conceptFolderId, fileName, b64);
      return fileId;
    } catch (e) {
      const msg = toFriendlyError(e);
      console.error(`[generate-creatives] ${fileName} attempt ${attempt}/${maxAttempts}: ${msg}`);
      if (attempt < maxAttempts) await sleep(600 * attempt);
    }
  }
  return null;
}

// --- Handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GOOGLE_DRIVE_REFRESH_TOKEN');

    if (!openaiKey || !rootFolderId) {
      return new Response(
        JSON.stringify({
          error: 'Missing env: OPENAI_API_KEY or GOOGLE_DRIVE_ROOT_FOLDER_ID',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!refreshToken || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: 'Set GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = await getDriveToken({
      clientId,
      clientSecret,
      refreshToken,
    });

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as {
      space_id?: string;
      space_name?: string;
      period_start?: string;
      concept_index?: number;
      concepts?: AdConcept[];
      create_folders_only?: boolean;
      create_concept_folders_only?: boolean;
      date_folder_id?: string;
      concept_folder_id?: string;
      image_offset?: number;
      image_count?: number;
      creative_prompt_template?: string;
      creative_image_prompt?: string; // legacy fallback
    };
    const promptTemplate = typeof body.creative_prompt_template === 'string' ? body.creative_prompt_template.trim() : '';
    const legacyPrompt = typeof body.creative_image_prompt === 'string' ? body.creative_image_prompt.trim() : '';

    const spaceName = body.space_name;
    const periodStart = body.period_start;
    const conceptIndex = body.concept_index ?? 0;
    const concepts = body.concepts ?? [];
    const createFoldersOnly = body.create_folders_only === true;
    const createConceptFoldersOnly = body.create_concept_folders_only === true;
    const dateFolderIdProvided = typeof body.date_folder_id === 'string';
    const conceptFolderIdProvided = typeof body.concept_folder_id === 'string';

    if (!spaceName || !periodStart) {
      return new Response(
        JSON.stringify({ error: 'Missing space_name or period_start' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let dateFolderId: string;

    if (dateFolderIdProvided) {
      dateFolderId = body.date_folder_id!;
    } else {
      const spaceFolderId = await findOrCreateFolder(accessToken, rootFolderId, spaceName);
      dateFolderId = await findOrCreateFolder(accessToken, spaceFolderId, periodStart);
    }

    if (createFoldersOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          date_folder_id: dateFolderId,
          space_name: spaceName,
          period_start: periodStart,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (createConceptFoldersOnly && concepts.length > 0) {
      const ids: string[] = [];
      for (let i = 0; i < concepts.length; i++) {
        const id = await findOrCreateFolder(accessToken, dateFolderId, concepts[i].title);
        ids.push(id);
      }
      return new Response(
        JSON.stringify({
          success: true,
          concept_folder_ids: ids,
          space_name: spaceName,
          period_start: periodStart,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (concepts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing concepts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const concept = concepts[conceptIndex];
    if (!concept) {
      return new Response(
        JSON.stringify({ error: `Invalid concept_index ${conceptIndex}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const offset = Math.max(0, body.image_offset ?? 0);
    const count = Math.min(Math.max(1, body.image_count ?? IMAGES_PER_BATCH), 15);
    const conceptFolderId = conceptFolderIdProvided
      ? body.concept_folder_id!
      : await findOrCreateFolder(accessToken, dateFolderId, concept.title);
    console.log(
      `[generate-creatives] ${spaceName} / ${periodStart} / concept ${conceptIndex} (${concept.title}): up to ${count} attempts from slot ${offset}`,
    );

    // Generate a DALL-E prompt for this concept (LLM from template, or fallback)
    let dallePrompt: string;
    if (promptTemplate) {
      console.log(`[generate-creatives] Generating DALL-E prompt via LLM for "${concept.title}"…`);
      dallePrompt = await generatePromptForConcept(openaiKey, promptTemplate, concept);
      console.log(`[generate-creatives] LLM prompt (${dallePrompt.length} chars): ${dallePrompt.slice(0, 120)}…`);
    } else if (legacyPrompt) {
      dallePrompt = `${legacyPrompt}\n\nConcept title: "${concept.title}". ${concept.description}`;
    } else {
      dallePrompt = buildFallbackPrompt(concept);
    }

    const baseName = concept.title.replace(/[/\\?*:|"<>]/g, '-').slice(0, 50);
    const uploaded: string[] = [];

    // `offset` = number of files already saved for this concept (0-based). Names are consecutive: _1, _2, …
    let slot = offset;
    for (let attempt = 0; attempt < count; attempt++) {
      if (attempt > 0) await sleep(450);
      const fileName = `${baseName}_${slot + 1}`;
      const fileId = await generateUploadOneWithRetries(
        openaiKey,
        accessToken,
        conceptFolderId,
        fileName,
        dallePrompt,
      );
      if (fileId) {
        uploaded.push(fileId);
        slot++;
        console.log(`[generate-creatives] Uploaded ${fileName}.png`);
      }
    }

    const attempts = count;
    const got = uploaded.length;
    if (got < attempts) {
      console.warn(`[generate-creatives] Partial batch: ${got}/${attempts} successes for concept ${conceptIndex}`);
    }

    const status = got > 0 ? 200 : 500;
    return new Response(
      JSON.stringify({
        success: got === attempts,
        partial: got > 0 && got < attempts,
        space_name: spaceName,
        period_start: periodStart,
        concept_index: conceptIndex,
        concept_title: concept.title,
        images_uploaded: got,
        images_attempts: attempts,
        images_expected: attempts,
        next_file_index: slot,
        folder_id: conceptFolderId,
      }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[generate-creatives] Error:', err);
    return new Response(
      JSON.stringify({ error: toFriendlyError(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
