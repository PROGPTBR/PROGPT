'use client';

import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { buildMailtoHref, markdownToPlainText } from '@/lib/email/mailto';

type Props = {
  subject: string;
  // Markdown ou texto puro; o button faz strip + truncate.
  body: string;
  disabled?: boolean;
  label?: string;
  // Se já vier texto puro (ex: transcript), pula o markdown stripping.
  plain?: boolean;
};

export function SendEmailButton({
  subject,
  body,
  disabled,
  label = 'Enviar por email',
  plain = false,
}: Props) {
  function handleClick() {
    const plainBody = plain ? body : markdownToPlainText(body);
    const { href, truncated } = buildMailtoHref({ subject, body: plainBody });
    if (truncated) {
      toast.info('Conteúdo longo — texto cortado.', {
        description: 'Baixe o .docx pra versão completa.',
      });
    }
    window.location.href = href;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || body.length === 0}
      title="Abre seu cliente de email com o conteúdo pronto"
    >
      <Mail className="h-3.5 w-3.5 mr-1" />
      {label}
    </Button>
  );
}
