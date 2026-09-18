'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

type SeatRow = {
  id: string;
  email: string;
  member_id: string | null;
  accepted_at: string | null;
};

type SeatState = {
  seats: number;
  extraSeats: number;
  used: number;
  available: number;
  members: SeatRow[];
};

// Painel de licenças da assinatura (sub-projeto 64) — mostrado em
// /account/billing pra quem contratou mais de 1 usuário. É aqui que o
// cliente convida a equipe sozinho, sem a 2B Supply criar conta na mão.
export function SeatMembersPanel() {
  const [state, setState] = useState<SeatState | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/account/seats');
      if (!res.ok) return;
      setState((await res.json()) as SeatState);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;

    setBusy(true);
    try {
      const res = await fetch('/api/account/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as SeatState & {
        error?: string;
        emailSent?: boolean;
      };

      if (!res.ok) {
        toast.error(data.error ?? 'Não foi possível convidar.');
        return;
      }

      setState(data);
      setEmail('');

      toast.success(
        data.emailSent
          ? 'Convite enviado.'
          : 'Acesso reservado, mas o e-mail não saiu. Use "Reenviar" em instantes.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(seat: SeatRow) {
    if (!confirm(`Remover o acesso de ${seat.email}? Ele perde o acesso imediatamente.`)) return;

    const res = await fetch(`/api/account/seats/${seat.id}`, { method: 'DELETE' });
    const data = (await res.json().catch(() => ({}))) as SeatState & { error?: string };

    if (!res.ok) {
      toast.error(data.error ?? 'Não foi possível remover.');
      return;
    }

    setState(data);
    toast.success('Acesso removido.');
  }

  async function resend(seat: SeatRow) {
    const res = await fetch(`/api/account/seats/${seat.id}/resend`, { method: 'POST' });
    const data = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      toast.error(data.error ?? 'Não foi possível reenviar.');
      return;
    }
    toast.success('Convite reenviado.');
  }

  // Assinatura de 1 usuário não tem o que gerenciar.
  if (loading || !state || state.extraSeats === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand" aria-hidden />
          <h2 className="text-sm font-semibold">Usuários da sua assinatura</h2>
        </div>

        <span className="text-xs text-muted-foreground">
          {state.used + 1} de {state.seats} acessos em uso
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Sua conta é o primeiro acesso. Convide as outras pessoas pelo e-mail — cada uma terá login,
        histórico e assistentes próprios, pagos por esta assinatura.
      </p>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {state.members.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Nenhum acesso convidado ainda.
          </li>
        )}

        {state.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm truncate">{m.email}</div>
              <div className="text-xs text-muted-foreground">
                {m.accepted_at ? 'Ativo' : 'Convite enviado — aguardando aceite'}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!m.accepted_at && (
                <button
                  type="button"
                  onClick={() => void resend(m)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Reenviar
                </button>
              )}

              <button
                type="button"
                onClick={() => void remove(m)}
                aria-label={`Remover acesso de ${m.email}`}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>

      {state.available > 0 ? (
        <form onSubmit={invite} className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com.br"
            className="flex-1 min-w-[200px] rounded-lg border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient text-black h-10 px-4 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            Convidar
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Todos os acessos do seu plano estão em uso. Para incluir mais pessoas, fale com a gente
          pelo e-mail de suporte.
        </p>
      )}
    </div>
  );
}
