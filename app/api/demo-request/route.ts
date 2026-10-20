import { demoRequestSchema } from '@/lib/demo-request';
import { getEmailConfigStatus, sendEmail } from '@/lib/email/client';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/constants';

export const runtime = 'nodejs';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]!,
  );
}

export async function POST(request: Request): Promise<Response> {
  let parsed;
  try {
    parsed = demoRequestSchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: 'Revise os campos obrigatórios e tente novamente.' },
      { status: 400 },
    );
  }

  // Campo-isca: responde sem enviar para não oferecer feedback a robôs.
  if (parsed.website) {
    return Response.json({ ok: true });
  }

  if (!getEmailConfigStatus().hasKey) {
    return Response.json(
      {
        error: 'O canal de envio ainda não está configurado. Tente novamente mais tarde.',
      },
      { status: 503 },
    );
  }

  const rows: Array<[string, string]> = [
    ['Solução', parsed.solution],
    ['Nome', parsed.name],
    ['E-mail profissional', parsed.email],
    ['WhatsApp', parsed.whatsapp],
    ['Empresa', parsed.company],
    ['Cargo', parsed.role || 'Não informado'],
    ['O que gostaria de conhecer', parsed.message || 'Não informado'],
  ];
  const html = `
    <h1>Nova solicitação de demonstração</h1>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><th align="left" style="border-bottom:1px solid #ddd">${escapeHtml(label)}</th><td style="border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}
    </table>
  `;

  const result = await sendEmail({
    to: LEGAL_CONTACT_EMAIL,
    subject: `Agendamento de demonstração - ${parsed.solution}`,
    html,
  });

  if (!result.ok) {
    console.warn('[demo-request] falha no envio:', result.error);
    return Response.json(
      {
        error:
          'Não foi possível enviar sua solicitação agora. Seus dados continuam preenchidos para uma nova tentativa.',
      },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
