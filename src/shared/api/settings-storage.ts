import { supabase } from './supabase';

export interface AppSettingsRow {
  subreddits: string[];
  email_recipients: string[];
}

export async function loadSettings(): Promise<AppSettingsRow | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('subreddits, email_recipients')
    .eq('id', 'global')
    .single();

  if (error) {
    console.error('Failed to load settings:', error.message);
    return null;
  }
  return data as AppSettingsRow;
}

export async function saveSettings(settings: Partial<AppSettingsRow>): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq('id', 'global');

  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}
