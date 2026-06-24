'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Botão "Baixar template" no cabeçalho dos assistentes que oferecem um template/
// planilha de referência pra preencher offline. Substitui a antiga tela-gate de
// escolha (AssistantEntryChoice removida em 2026-06-24): o usuário cai direto no
// formulário e baixa o template por aqui se quiser. Arquivo servido de
// /public/templates/ — sem backend.

export function DownloadTemplateButton({
  href,
  filename,
  format,
  description,
}: {
  /** URL do template em /public/templates/... */
  href: string;
  /** Nome do arquivo usado pelo browser no download. */
  filename: string;
  /** Rótulo curto do formato (ex.: ".xlsx"). Opcional. */
  format?: string;
  /** Texto explicativo mostrado como tooltip (title). Opcional. */
  description?: string;
}) {
  return (
    <a href={href} download={filename} title={description} className="shrink-0">
      <Button type="button" variant="outline" size="sm">
        <Download className="mr-1.5 h-4 w-4" />
        Baixar template
        {format ? (
          <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {format}
          </span>
        ) : null}
      </Button>
    </a>
  );
}
