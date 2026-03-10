import type { Space } from '@shared/lib/types';
import { supabase } from './supabase';

interface SpaceRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  domain_prompt: string;
  subreddits: string[];
  email_recipients: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    domainPrompt: row.domain_prompt,
    subreddits: row.subreddits,
    emailRecipients: row.email_recipients,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function spaceToRow(space: Partial<Space>) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (space.name !== undefined) row.name = space.name;
  if (space.slug !== undefined) row.slug = space.slug;
  if (space.description !== undefined) row.description = space.description;
  if (space.domainPrompt !== undefined) row.domain_prompt = space.domainPrompt;
  if (space.subreddits !== undefined) row.subreddits = space.subreddits;
  if (space.emailRecipients !== undefined) row.email_recipients = space.emailRecipients;
  if (space.isActive !== undefined) row.is_active = space.isActive;
  return row;
}

export async function loadSpaces(): Promise<Space[]> {
  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to load spaces: ${error.message}`);
  return (data as SpaceRow[]).map(rowToSpace);
}

export async function getSpace(id: string): Promise<Space | null> {
  const { data, error } = await supabase.from('spaces').select('*').eq('id', id).single();

  if (error) return null;
  return rowToSpace(data as SpaceRow);
}

export async function createSpace(
  space: Pick<
    Space,
    'name' | 'slug' | 'description' | 'domainPrompt' | 'subreddits' | 'emailRecipients'
  >
): Promise<Space> {
  const { data, error } = await supabase
    .from('spaces')
    .insert({
      name: space.name,
      slug: space.slug,
      description: space.description,
      domain_prompt: space.domainPrompt,
      subreddits: space.subreddits,
      email_recipients: space.emailRecipients,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create space: ${error.message}`);
  return rowToSpace(data as SpaceRow);
}

export async function updateSpace(id: string, updates: Partial<Space>): Promise<void> {
  const { error } = await supabase.from('spaces').update(spaceToRow(updates)).eq('id', id);

  if (error) throw new Error(`Failed to update space: ${error.message}`);
}

export async function deleteSpace(id: string): Promise<void> {
  const { error } = await supabase.from('spaces').delete().eq('id', id);

  if (error) throw new Error(`Failed to delete space: ${error.message}`);
}
