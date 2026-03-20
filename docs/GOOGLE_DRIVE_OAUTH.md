# Google Drive OAuth Setup

Use OAuth instead of Service Account when Shared Drives are restricted (e.g. org policy). OAuth works with **My Drive** and **Shared Drives**.

## Step 1: Google Cloud Console — OAuth Client

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Select project **sdg-lab-490710** (or create one)
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
4. If prompted, configure **OAuth consent screen**:
   - User type: **External** (or Internal for Workspace)
   - App name: `TrendWatcher`
   - Add your email as test user
5. Create OAuth client:
   - Application type: **Web application**
   - Name: `TrendWatcher Drive`
   - **Authorized redirect URIs** → Add:
     ```
     https://nhbiyqebcveqjoxxnytm.supabase.co/functions/v1/oauth-drive
     ```
6. **Create** → Copy **Client ID** and **Client secret**

## Step 2: Supabase — Add OAuth Secrets

1. [Supabase Dashboard](https://supabase.com/dashboard/project/nhbiyqebcveqjoxxnytm) → **Project Settings** → **Edge Functions** → **Secrets**
2. Add:
   - `GOOGLE_DRIVE_CLIENT_ID` = Client ID from step 1
   - `GOOGLE_DRIVE_CLIENT_SECRET` = Client secret from step 1

## Step 3: Deploy oauth-drive Function

```bash
supabase functions deploy oauth-drive --no-verify-jwt
```

## Step 4: Run OAuth Flow

1. Open in browser:
   ```
   https://nhbiyqebcveqjoxxnytm.supabase.co/functions/v1/oauth-drive
   ```
2. Click **Connect Google Drive**
3. Sign in with the account that will receive uploads (e.g. Workspace account with sdg-lab-shared)
4. Authorize
5. Copy the **refresh token** from the success page

## Step 5: Add Refresh Token to generate-creatives

1. Supabase → **Edge Functions** → **generate-creatives** → **Secrets**
2. Add: `GOOGLE_DRIVE_REFRESH_TOKEN` = the copied refresh token

## Step 6: Root Folder ID

1. In Google Drive, open the target folder (e.g. `sdg-lab-shared` → `trendwatcher-creatives`)
2. Copy folder ID from URL: `https://drive.google.com/drive/folders/XXXXXXXX`
3. Add to generate-creatives secrets: `GOOGLE_DRIVE_ROOT_FOLDER_ID` = `XXXXXXXX`

## Step 7: Remove Service Account (optional)

If using OAuth only, you can remove `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` from generate-creatives secrets.

## Summary of Secrets for generate-creatives

| Secret | Required |
|--------|----------|
| `OPENAI_API_KEY` | Yes |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Yes |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Yes (OAuth) |
| `GOOGLE_DRIVE_CLIENT_ID` | Yes (OAuth) |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Yes (OAuth) |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | No (use OAuth instead) |
