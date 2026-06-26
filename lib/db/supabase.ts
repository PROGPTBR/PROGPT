import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

let serverInstance: SupabaseClient | null = null;
let browserInstance: SupabaseClient | null = null;
let signupInstance: SupabaseClient | null = null;

/**
 * Cliente administrativo.
 * Utiliza a Service Role.
 *
 * Usado para:
 * - atualizar qualquer profile
 * - consultar qualquer usuário
 * - operações administrativas
 */
export function getServerSupabase(): SupabaseClient {
  if (serverInstance) return serverInstance;

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  serverInstance = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverInstance;
}

/**
 * Cliente utilizado no navegador.
 */
export function getBrowserSupabase(): SupabaseClient {
  if (browserInstance) return browserInstance;

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  browserInstance = createClient(url, anonKey);

  return browserInstance;
}

/**
 * Cliente para cadastro de usuários.
 *
 * Utiliza a ANON KEY para permitir:
 * - auth.signUp()
 * - envio do e-mail de confirmação
 * - emailRedirectTo
 */
export function getSignupSupabase(): SupabaseClient {
  if (signupInstance) return signupInstance;

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  signupInstance = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return signupInstance;
}