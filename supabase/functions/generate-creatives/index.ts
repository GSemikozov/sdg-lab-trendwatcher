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
 * Drive auth: GOOGLE_DRIVE_REFRESH_TOKEN (OAuth) or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (SA)
 */

const OPENAI_BASE = 'https://api.openai.com/v1';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const IMAGES_PER_CONCEPT = 3; // ~30s to fit 60s timeout; DALL-E ~10s per image

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

async function getDriveTokenSa(credentialsJson: string): Promise<string> {
  const { getToken } = await import('https://deno.land/x/google_jwt_sa@v0.2.5/mod.ts');
  const token = await getToken(credentialsJson, {
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
  return (token as { access_token: string }).access_token;
}

async function getDriveToken(env: {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  saJson?: string;
}): Promise<string> {
  if (env.refreshToken && env.clientId && env.clientSecret) {
    return getDriveTokenOAuth(env.clientId, env.clientSecret, env.refreshToken);
  }
  if (env.saJson) {
    return getDriveTokenSa(env.saJson);
  }
  throw new Error(
    'Set GOOGLE_DRIVE_REFRESH_TOKEN + GOOGLE_DRIVE_CLIENT_ID + GOOGLE_DRIVE_CLIENT_SECRET, or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON',
  );
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

// --- DALL-E 3 ---

async function generateImage(
  openaiKey: string,
  concept: AdConcept,
  index: number,
): Promise<string> {
  const prompt = `Meta ad creative concept: "${concept.title}". ${concept.description}. Style: modern, high-contrast, suitable for social media feed. No text in the image.`;
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
    const saJson = Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');

    if (!openaiKey || !rootFolderId) {
      return new Response(
        JSON.stringify({
          error: 'Missing env: OPENAI_API_KEY or GOOGLE_DRIVE_ROOT_FOLDER_ID',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const hasOAuth = !!(refreshToken && clientId && clientSecret);
    const hasSa = !!saJson;
    if (!hasOAuth && !hasSa) {
      return new Response(
        JSON.stringify({
          error:
            'Set OAuth (GOOGLE_DRIVE_REFRESH_TOKEN + CLIENT_ID + CLIENT_SECRET) or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = await getDriveToken({
      clientId,
      clientSecret,
      refreshToken,
      saJson,
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
      date_folder_id?: string;
    };

    const spaceName = body.space_name;
    const periodStart = body.period_start;
    const conceptIndex = body.concept_index ?? 0;
    const concepts = body.concepts ?? [];
    const createFoldersOnly = body.create_folders_only === true;
    const dateFolderIdProvided = typeof body.date_folder_id === 'string';

    if (!spaceName || !periodStart) {
      return new Response(
        JSON.stringify({ error: 'Missing space_name or period_start' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = await getDriveToken(saJson);
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

    const n = Math.min(IMAGES_PER_CONCEPT, 15);
    console.log(`[generate-creatives] ${spaceName} / ${periodStart} / concept ${conceptIndex}: generating ${n} images`);

    const baseName = concept.title.replace(/[/\\?*:|"<>]/g, '-').slice(0, 50);
    const uploaded: string[] = [];

    for (let i = 0; i < n; i++) {
      const b64 = await generateImage(openaiKey, concept, i);
      const fileName = `${baseName}_${i + 1}`;
      const fileId = await uploadToDrive(accessToken, dateFolderId, fileName, b64);
      uploaded.push(fileId);
      console.log(`[generate-creatives] Uploaded ${fileName}.png`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        space_name: spaceName,
        period_start: periodStart,
        concept_index: conceptIndex,
        concept_title: concept.title,
        images_uploaded: uploaded.length,
        folder_id: dateFolderId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[generate-creatives] Error:', err);
    return new Response(
      JSON.stringify({ error: toFriendlyError(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
