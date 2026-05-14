import { z } from 'zod';
import { getServerSupabase } from './supabase';

// Sub-projeto 24 — Dados da empresa no perfil
//
// Source of truth for the user's company info. Feeds:
//   - the RFP generator (as {{empresa_*}} placeholders in the template
//     head and tail)
//   - the prefill of the "Empresa contratante" field in RfpForm

export const CompanyDataSchema = z.object({
  company_name: z.string().trim().min(1).max(200).nullable(),
  company_legal_name: z.string().trim().min(1).max(200).nullable(),
  company_cnpj: z.string().trim().min(1).max(32).nullable(),
  company_email: z.string().trim().email().max(320).nullable(),
  company_phone: z.string().trim().min(1).max(32).nullable(),
  company_address: z.string().trim().min(1).max(500).nullable(),
  company_description: z.string().trim().min(1).max(1000).nullable(),
});

export type CompanyData = z.infer<typeof CompanyDataSchema>;

// Empty value the API returns when no fields have been set yet — keeps
// the client form straightforward (no null handling for each field).
export const EMPTY_COMPANY: CompanyData = {
  company_name: null,
  company_legal_name: null,
  company_cnpj: null,
  company_email: null,
  company_phone: null,
  company_address: null,
  company_description: null,
};

export async function getUserCompany(userId: string): Promise<CompanyData> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select(
      'company_name, company_legal_name, company_cnpj, company_email, company_phone, company_address, company_description',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return EMPTY_COMPANY;
  return data as CompanyData;
}

export async function updateUserCompany(
  userId: string,
  patch: CompanyData,
): Promise<{ ok: true } | { error: string }> {
  const sb = getServerSupabase();
  // Coerce empty strings to null so the CHECK constraint (length ≥ 1)
  // doesn't reject "blank" values from the form.
  const normalized = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await sb.from('profiles').update(normalized).eq('id', userId);
  if (error) {
    console.warn('[user-company] update failed:', error.message);
    return { error: error.message };
  }
  return { ok: true };
}
