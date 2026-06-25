// Base da URL de retorno (callback) do Asaas.
//
// O Asaas EXIGE que o domínio do successUrl seja o mesmo cadastrado em Minha
// Conta → Informações (o "site", ex.: 2bsupply.com.br). Atrás do proxy do
// Railway, `new URL(req.url).host` NÃO é o domínio público (vem o host
// interno), o que fazia o Asaas rejeitar (billing_provider_error). Por isso:
//   1º) APP_URL (domínio aprovado, fixo) — recomendado;
//   2º) x-forwarded-host (domínio público real que o proxy injeta);
//   3º) host header / req.url (fallback).
export function callbackBaseUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  const fwdHost = req.headers.get('x-forwarded-host');
  const host = fwdHost || req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`;
  }

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
