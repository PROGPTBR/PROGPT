// Corpo do e-mail de encaminhamento gerado por GET /api/assistants/runs/[id]/eml
// (backlog do diretor, 2026-08-19, Batch I). Vive fora do route.ts porque
// Next.js App Router só aceita exports de método HTTP (GET/POST/...) + um
// punhado de configs em arquivos route.ts — qualquer outro export quebra
// `next build` com "is not a valid Route export field".

const MAX_BODY_CHARS = 1200;

/**
 * Carta de encaminhamento curta.
 * O conteúdo completo é o anexo — o corpo só
 * precisa dizer o que é, o que se espera de volta
 * e de quem veio.
 */
export function buildBodyText(
  title: string,
  outputPlain: string,
  ctx: {
    companyName: string | null;
    companyEmail: string | null;
    filename: string;
  },
): string {
  const abstract = outputPlain
    .slice(0, MAX_BODY_CHARS)
    .trimEnd();

  const truncated =
    outputPlain.length > MAX_BODY_CHARS;

  const signature = [
    ctx.companyName,
    ctx.companyEmail,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'Prezados,',
    '',
    `Segue em anexo o documento "${title}" (${ctx.filename}) para análise e retorno.`,
    '',
    'Resumo:',
    '',
    truncated
      ? `${abstract}\n\n[...] O documento completo está no anexo.`
      : abstract,
    '',
    'Ficamos à disposição para esclarecimentos.',
    '',
    'Atenciosamente,',
    signature || '',
  ]
    .join('\n')
    .trimEnd();
}
