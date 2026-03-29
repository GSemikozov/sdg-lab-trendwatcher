/**
 * Supabase Edge Function: oauth-drive
 *
 * One-time OAuth flow to get a refresh token for Google Drive.
 * Visit the function URL, authorize, then copy the refresh_token to Supabase secrets.
 *
 * Required secrets: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET
 * Output: refresh_token to add as GOOGLE_DRIVE_REFRESH_TOKEN
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function exchangeAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ ok: boolean; refresh_token?: string; error?: string; raw?: unknown }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.refresh_token) {
    return {
      ok: false,
      error: tokenData.error_description ?? tokenData.error ?? 'No refresh_token in response',
      raw: tokenData,
    };
  }
  return { ok: true, refresh_token: tokenData.refresh_token };
}

async function saveRefreshTokenToSecrets(refreshToken: string, supabaseUrl: string): Promise<boolean> {
  const sbAccessToken = Deno.env.get('SB_ACCESS_TOKEN');
  const projectRef = (supabaseUrl.match(/\/\/([^.]+)\.supabase/) ?? [])[1];
  if (!sbAccessToken || !projectRef) return false;
  const saveRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sbAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ name: 'GOOGLE_DRIVE_REFRESH_TOKEN', value: refreshToken }]),
  });
  return saveRes.ok;
}

function htmlPage(title: string, body: string): Response {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;max-width:600px;margin:40px auto;padding:20px;">${body}</body></html>`;
  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return new Response(html, { status: 200, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://nhbiyqebcveqjoxxnytm.supabase.co';
  const redirectUri = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/oauth-drive`;
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');

  // Browser callback hits the gateway without Authorization → 401 before this runs.
  // Exchange the code via POST with a JWT (anon or service_role) instead.
  if (req.method === 'POST') {
    try {
      const json = (await req.json().catch(() => null)) as { code?: string } | null;
      const postCode = typeof json?.code === 'string' ? json.code.trim() : '';
      if (!postCode) {
        return new Response(JSON.stringify({ error: 'JSON body must include { "code": "..." }' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Missing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await exchangeAuthCode(postCode, clientId, clientSecret, redirectUri);
      if (!result.ok || !result.refresh_token) {
        return new Response(
          JSON.stringify({ success: false, error: result.error, details: result.raw }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const saved = await saveRefreshTokenToSecrets(result.refresh_token, supabaseUrl);
      return new Response(
        JSON.stringify({
          success: true,
          saved_to_secrets: saved,
          message: saved
            ? 'GOOGLE_DRIVE_REFRESH_TOKEN updated in project secrets.'
            : 'Got refresh_token; add SB_ACCESS_TOKEN secret for auto-save, or set GOOGLE_DRIVE_REFRESH_TOKEN manually in Dashboard.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (!clientId || !clientSecret) {
    return htmlPage(
      'OAuth Setup',
      `
      <h1>Google Drive OAuth</h1>
      <p>Add <code>GOOGLE_DRIVE_CLIENT_ID</code> and <code>GOOGLE_DRIVE_CLIENT_SECRET</code> to this function's secrets first.</p>
      <p>Then redeploy and visit this URL again.</p>
    `,
    );
  }

  if (error) {
    return htmlPage(
      'OAuth Error',
      `
      <h1>Authorization failed</h1>
      <p>Error: ${error}</p>
      <p><a href="${redirectUri}">Try again</a></p>
    `,
    );
  }

  if (code) {
    const exchanged = await exchangeAuthCode(code, clientId, clientSecret, redirectUri);
    if (!exchanged.ok || !exchanged.refresh_token) {
      return htmlPage(
        'Token Error',
        `
        <h1>Failed to get token</h1>
        <pre>${JSON.stringify(exchanged.raw ?? exchanged.error, null, 2)}</pre>
        <p>If you saw 401 on this URL, the code may be invalid. Use <strong>POST</strong> with JWT instead (see docs).</p>
        <p><a href="${redirectUri}">Try again</a></p>
      `,
      );
    }

    const autoSaved = await saveRefreshTokenToSecrets(exchanged.refresh_token, supabaseUrl);

    const savedMsg = autoSaved
      ? '<p style="color:green;font-weight:600;">✓ Refresh token automatically saved to secrets. Drive is ready.</p>'
      : `<p>Copy the refresh token below and save it as <code>GOOGLE_DRIVE_REFRESH_TOKEN</code>:</p>
         <textarea readonly style="width:100%;height:80px;font-family:monospace;font-size:12px;padding:8px;" onclick="this.select()">${exchanged.refresh_token}</textarea>
         <p style="margin-top:16px;color:#666;">Supabase Dashboard → Project Settings → Edge Functions → Secrets</p>`;

    return htmlPage(
      'OAuth Success',
      `
      <h1>Google Drive Connected</h1>
      ${savedMsg}
      <p><a href="${redirectUri}">Start over</a></p>
    `,
    );
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  })}`;

  return htmlPage(
    'Connect Google Drive',
    `
    <h1>Connect Google Drive</h1>
    <p>Click below to authorize. After Google redirects you, the browser may show <strong>401</strong> — that is normal.</p>
    <p>Copy the <code>code=...</code> value from the address bar, then run (replace YOUR_JWT with legacy anon key from Dashboard → API):</p>
    <pre style="background:#f4f4f5;padding:12px;overflow:auto;font-size:11px;">curl -s -X POST '${redirectUri}' \\
  -H 'Authorization: Bearer YOUR_JWT' \\
  -H 'Content-Type: application/json' \\
  -d '{"code":"PASTE_CODE_HERE"}'</pre>
    <p><a href="${authUrl}" style="display:inline-block;background:#4285f4;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Connect Google Drive</a></p>
    <p style="color:#666;font-size:14px;">Or open this page with <code>curl -H "Authorization: Bearer …"</code> to see the button and complete the flow in a client that sends JWT.</p>
  `,
  );
});
