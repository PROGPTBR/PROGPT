import { getServerSupabase } from '@/lib/db/supabase';
import type { AssistantType, TemplateRow } from './types';

// Service-role helpers for templates. All admin write paths and the assistant
// runtime go through here so the cookie-aware-no-UPDATE-policy bug from
// sub-projeto 17 (admin_write_endpoints_use_service_role memory) can't bite us.

export async function listTemplates(type?: AssistantType): Promise<TemplateRow[]> {
  const sb = getServerSupabase();
  let q = sb.from('templates').select('*').order('created_at', { ascending: false });
  if (type) q = q.eq('assistant_type', type);
  const { data, error } = await q;
  if (error) {
    console.warn('[assistants/templates] listTemplates failed:', error.message);
    return [];
  }
  return (data ?? []) as TemplateRow[];
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb.from('templates').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[assistants/templates] getTemplate failed:', error.message);
    return null;
  }
  return (data as TemplateRow | null) ?? null;
}

export async function createTemplate(input: {
  assistant_type: AssistantType;
  name: string;
  description?: string | null;
  body_md: string;
  created_by?: string;
}): Promise<TemplateRow | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('templates')
    .insert({
      assistant_type: input.assistant_type,
      name: input.name,
      description: input.description ?? null,
      body_md: input.body_md,
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[assistants/templates] createTemplate failed:', error.message);
    return null;
  }
  return data as TemplateRow;
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<TemplateRow, 'name' | 'description' | 'body_md'>>,
): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from('templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.warn('[assistants/templates] updateTemplate failed:', error.message);
    return false;
  }
  return true;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const sb = getServerSupabase();
  const { error } = await sb.from('templates').delete().eq('id', id);
  if (error) {
    console.warn('[assistants/templates] deleteTemplate failed:', error.message);
    return false;
  }
  return true;
}
