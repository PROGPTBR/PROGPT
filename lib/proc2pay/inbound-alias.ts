// Proc2Pay — alias de e-mail de entrada por usuário, determinístico (sem
// schema novo). O endereço embute o user_id (hex sem hífens), então o webhook
// recupera o usuário sem precisar de tabela de mapeamento.
//
//   proc2pay-<userIdSemHifens>@<RESEND_INBOUND_DOMAIN>

export function inboundDomain(): string | null {
  return process.env.RESEND_INBOUND_DOMAIN?.trim() || null;
}

export function proc2payAlias(userId: string, domain: string): string {
  return `proc2pay-${userId.replace(/-/g, '').toLowerCase()}@${domain}`;
}

/** Endereço de entrada do usuário, ou null se o inbound não está configurado. */
export function aliasForUser(userId: string): string | null {
  const d = inboundDomain();
  return d ? proc2payAlias(userId, d) : null;
}

const HEX32 = /proc2pay-([0-9a-f]{32})@/i;

/** Extrai o user_id (UUID) de um endereço de alias, ou null se não casar. */
export function userIdFromAlias(address: string): string | null {
  const m = address.toLowerCase().match(HEX32);
  if (!m) return null;
  const h = m[1]!;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Varre uma lista de destinatários e devolve o 1º user_id reconhecido. */
export function userIdFromRecipients(to: string[] | undefined): string | null {
  for (const addr of to ?? []) {
    const id = userIdFromAlias(addr);
    if (id) return id;
  }
  return null;
}
