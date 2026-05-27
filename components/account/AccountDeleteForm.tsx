'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AccountFootprint } from '@/lib/account';

const CONFIRMATION_PHRASE = 'EXCLUIR';

type Props = {
  email: string;
  footprint: AccountFootprint;
};

export function AccountDeleteForm({ email, footprint }: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const canSubmit = confirmation === CONFIRMATION_PHRASE && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });
      if (res.status !== 204) {
        toast.error('Falha ao excluir conta. Tente novamente.');
        setBusy(false);
        return;
      }
      toast.success('Conta excluída. Até logo.');
      router.push('/');
      router.refresh();
    } catch (err) {
      toast.error('Erro de rede. Tente novamente.');
      console.error(err);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Excluir minha conta
        </h1>
        <p className="text-sm text-muted-foreground">
          Você está prestes a apagar permanentemente sua conta{' '}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="text-sm text-foreground space-y-2">
            <div className="font-medium">Esta ação é irreversível.</div>
            <div className="text-muted-foreground">
              Os dados abaixo serão apagados permanentemente em conformidade com a
              LGPD:
            </div>
            <ul className="text-sm text-foreground/90 space-y-0.5 list-disc list-inside pl-1">
              <li>
                <span className="font-medium">{footprint.sessions}</span> conversa
                {footprint.sessions === 1 ? '' : 's'} do chat
              </li>
              <li>
                <span className="font-medium">{footprint.assistantRuns}</span>{' '}
                execução{footprint.assistantRuns === 1 ? '' : 'ões'} de assistente
                (RFP, Kraljic, Negociação etc.)
              </li>
              <li>
                <span className="font-medium">{footprint.feedback}</span>{' '}
                avaliaç{footprint.feedback === 1 ? 'ão' : 'ões'} de mensagens
              </li>
              <li>
                Seu Perfil da Categoria + Perfil da empresa
              </li>
              <li>
                Histórico de upload de documentos
              </li>
            </ul>
            <div className="text-xs text-muted-foreground pt-2 border-t border-red-500/20">
              Eventos de uso de API ficam preservados de forma anônima (sem
              vínculo com você) pra contabilidade interna.
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="confirmation-input"
            className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
          >
            Para confirmar, digite{' '}
            <span className="font-mono text-foreground">EXCLUIR</span> abaixo
          </label>
          <input
            id="confirmation-input"
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="EXCLUIR"
            autoComplete="off"
            className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-red-500 focus:bg-muted/60 transition-colors font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 bg-red-600 text-white h-11 rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Excluindo…' : 'Excluir conta permanentemente'}
        </button>
      </form>
    </div>
  );
}
