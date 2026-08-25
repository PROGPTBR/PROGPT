import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';

import { getRunForOwner } from '@/lib/assistants/runs';

import { buildRunDocx } from '@/lib/assistants/run-docx';

import { buildEml } from '@/lib/email/eml';

import { markdownToPlainText } from '@/lib/email/mailto';

import { getUserCompany } from '@/lib/db/user-company';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/eml — backlog do diretor (2026-08-19, Batch I).
//
// Devolve a mensagem pronta (RFC 5322) com o .docx do run JÁ ANEXADO. O
// comprador abre no cliente de e-mail dele, revisa e envia — o remetente é
// ele, não o nosso domínio (que é o que `mailto:` nunca conseguiu fazer:
// mailto não anexa arquivo).
//
// Owner-gated como as rotas irmãs docx/xlsx: getRunForOwner filtra por
// user_id e não-donos recebem 404, não 403.
//
// ?to=a@x.com,b@y.com — destinatários opcionais (o comprador também pode
// preencher no próprio cliente de e-mail depois de abrir).

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Corpo do e-mail: só a abertura. O documento completo vai no anexo, então
// despejar o markdown inteiro no corpo duplicaria tudo.

const MAX_BODY_CHARS = 1200;

const ToParam = z
  .string()
  .max(500)
  .transform((s) =>
    s
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      .slice(0, 20),
  );

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401 },
    );
  }

  const run = await getRunForOwner(
    params.id,
    user.id,
  );

  if (!run) {
    return new NextResponse(
      'Not Found',
      { status: 404 },
    );
  }

  if (
    run.status !== 'done' ||
    !run.output_md
  ) {
    return NextResponse.json(
      {
        error: 'not_ready',
        status: run.status,
      },
      { status: 409 },
    );
  }

  const rawTo =
    new URL(req.url).searchParams.get('to') ??
    '';

  const to = rawTo
    ? ToParam.parse(rawTo)
    : [];

  const [
    { buffer, filename, title },
    company,
  ] = await Promise.all([
    buildRunDocx(run, user.id),
    getUserCompany(user.id),
  ]);

  const bodyText = buildBodyText(
    title,
    markdownToPlainText(run.output_md),
    {
      companyName:
        company?.company_name ?? null,
      companyEmail:
        company?.company_email ?? null,
      filename,
    },
  );

  const eml = buildEml({
    to,
    subject: title,
    bodyText,
    attachments: [
      {
        filename,
        contentType: DOCX_MIME,
        content: buffer,
      },
    ],
  });

  const emlBuffer = Buffer.from(
    eml,
    'utf8',
  );

  const emlFilename = filename.replace(
    /\.docx$/,
    '.eml',
  );

  return new NextResponse(
    emlBuffer as unknown as BodyInit,
    {
      status: 200,
      headers: {
        'Content-Type':
          'message/rfc822',
        'Content-Disposition':
          `attachment; filename="${emlFilename}"`,
        'Content-Length': String(
          emlBuffer.length,
        ),
      },
    },
  );
}

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