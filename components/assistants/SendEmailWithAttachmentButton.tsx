'use client';

import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Backlog do diretor (2026-08-19, Batch I) — "um campo onde o comprador
// apertasse e abrisse o e-mail dele para enviar a RFQ com o arquivo já
// anexado".
//
// `mailto:` não anexa arquivo (ver lib/email/mailto.ts). A saída é baixar um
// `.eml` montado no servidor (GET /api/assistants/runs/[id]/eml) já com o
// .docx dentro: o clique abre o cliente de e-mail do próprio comprador, com
// anexo, pronto para revisar e enviar. O remetente continua sendo ele.
//
// Genérico por run — serve qualquer assistente que gere .docx, não só a RFQ.

type Props = {
  runId: string | null;
  disabled?: boolean;
  label?: string;
  /** Rótulo do campo de destinatários; some quando `false`. */
  recipients?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Separa por vírgula/ponto-e-vírgula e devolve válidos e inválidos. */
export function splitRecipients(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const v = part.trim();
    if (!v) continue;
    (EMAIL_RE.test(v) ? valid : invalid).push(v);
  }
  return { valid, invalid };
}

export function SendEmailWithAttachmentButton({
  runId,
  disabled,
  label = 'E-mail com anexo',
  recipients = true,
}: Props) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!runId) return;
    const { valid, invalid } = splitRecipients(to);
    if (invalid.length > 0) {
      toast.error('E-mail inválido', { description: invalid.join(', ') });
      return;
    }

    setBusy(true);
    try {
      const qs = valid.length > 0 ? `?to=${encodeURIComponent(valid.join(','))}` : '';
      const res = await fetch(`/api/assistants/runs/${runId}/eml${qs}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rfq-${runId.slice(0, 8)}.eml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Mensagem pronta com o documento anexado', {
        description:
          'Abra o arquivo baixado no seu e-mail (Outlook, Thunderbird, Apple Mail), revise e envie.',
      });
    } catch (err) {
      toast.error('Falha ao montar o e-mail', { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {recipients && (
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="E-mails dos fornecedores (opcional)"
          aria-label="E-mails dos fornecedores"
          className="h-8 w-full sm:w-72 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || !runId || busy}
        title="Baixa a mensagem já com o documento anexado, para abrir no seu cliente de e-mail"
      >
        <Paperclip className="h-3.5 w-3.5 mr-1" />
        {busy ? 'Montando…' : label}
      </Button>
    </div>
  );
}
