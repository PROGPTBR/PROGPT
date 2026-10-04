import { NextResponse } from 'next/server';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';
import { configuredAppUrl } from '@/lib/app-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Entrar como o cliente" (sub-projeto 69). Substitui a visão de suporte só
// leitura como ação principal: o super admin precisa ver EXATAMENTE o que o
// cliente vê ao logar — todas as telas, plano, bloqueios de assinatura. A
// única forma de garantir isso é estar numa sessão real da conta dele.
//
// Gera um link de acesso de uso único (magic link via Admin API — não envia
// e-mail nenhum) que passa pela MESMA rota /auth/confirm do produto, no nosso
// domínio. Quem abrir o link fica logado como o cliente, podendo agir como
// ele: por isso cada geração fica na trilha de auditoria (user.impersonate).
//
// Travas: não entra na própria conta, não entra na conta de outro super admin
// (seria escalada lateral entre staff) e não entra em conta com login
// desativado (o link nem funcionaria, e reativar é decisão separada).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  if (params.id === admin.user.id) {
    return NextResponse.json({ error: 'cannot_impersonate_self' }, { status: 400 });
  }

  const svc = getServerSupabase();
  const { data: target, error: lookupError } = await svc
    .from('profiles_with_email')
    .select('id, email, super_admin, banned_until')
    .eq('id', params.id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  if (!target?.email) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  if (target.super_admin) {
    return NextResponse.json({ error: 'cannot_impersonate_super_admin' }, { status: 403 });
  }
  const bannedUntil = target.banned_until as string | null;
  if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
    return NextResponse.json({ error: 'user_inactive' }, { status: 409 });
  }

  const { data: link, error: linkError } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email as string,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.json({ error: 'link_failed' }, { status: 500 });
  }

  const url = new URL('/auth/confirm', configuredAppUrl());
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', 'magiclink');
  url.searchParams.set('next', '/chat');

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'user.impersonate',
    resourceType: 'profile',
    resourceId: params.id,
    metadata: { targetEmail: target.email },
  });

  // O link é uma credencial: nunca logar e nunca deixar em cache.
  return NextResponse.json(
    { url: url.toString(), email: target.email },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
