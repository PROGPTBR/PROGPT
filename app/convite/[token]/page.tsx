import { AuthShell } from '@/components/brand/AuthShell';
import { getSeatByToken } from '@/lib/billing/seat-members';
import { AcceptInviteForm } from '@/components/billing/AcceptInviteForm';

export const dynamic = 'force-dynamic';

// Página PÚBLICA de aceite de convite (licença de uma assinatura de equipe,
// sub-projeto 64). Não entra no matcher do middleware de propósito: quem
// abre este link ainda não tem conta.
export default async function ConvitePage({ params }: { params: { token: string } }) {
  const found = await getSeatByToken(params.token);

  if (!found || found.seat.accepted_at) {
    return (
      <AuthShell>
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <h1 className="text-xl font-semibold">Convite indisponível</h1>
          <p className="text-sm text-muted-foreground">
            {found?.seat.accepted_at
              ? 'Este convite já foi usado. Entre normalmente com seu e-mail e senha.'
              : 'Este convite não é mais válido — ele pode ter sido removido ou substituído. Peça um novo para quem contratou o PROGPT.'}
          </p>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold"
          >
            Ir para o login
          </a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AcceptInviteForm
        token={params.token}
        email={found.seat.email}
        inviterName={found.ownerName}
        inviterEmail={found.ownerEmail}
      />
    </AuthShell>
  );
}
