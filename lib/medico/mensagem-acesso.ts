// Mensagem de acesso da Área Médica (sub-projeto 119). PURA.
//
// Quando a equipe gera a senha temporária em /plataforma/area-medica, o painel
// monta a mensagem inteira para o médico: endereço, e-mail, senha, o que já
// está lançado e o que falta para tudo ficar automático. A equipe copia ou
// manda pelo WhatsApp. Nunca leva nome de paciente.

export type DadosDaMensagem = {
  nome: string;
  email: string;
  senha: string;
  /** Endereço de entrada, ex.: https://2bsupply.ia.br/medicos */
  link: string;
  hospitais: number;
  cirurgias: number;
  demonstrativos: number;
  /** O e-mail do contador já está cadastrado. */
  contador: boolean;
  /** O WhatsApp do médico já está cadastrado. */
  celular: boolean;
  /** Endereço para onde ele encaminha os e-mails do hospital (null se o recebimento está desligado). */
  emailEntrada: string | null;
};

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function mensagemDeAcesso(d: DadosDaMensagem): string {
  const nome = d.nome.trim() || 'Doutor(a)';
  const linhas: string[] = [];
  linhas.push(`${nome}, sua Área Médica já está pronta.`);
  linhas.push('');
  linhas.push('*Seu acesso*');
  linhas.push(`Endereço: ${d.link}`);
  linhas.push(`E-mail: ${d.email}`);
  linhas.push(`Senha temporária: ${d.senha}`);
  linhas.push('No primeiro acesso o sistema pede para você criar a sua própria senha.');

  const lancado: string[] = [];
  if (d.hospitais > 0) lancado.push(plural(d.hospitais, 'hospital cadastrado', 'hospitais cadastrados'));
  if (d.cirurgias > 0) lancado.push(plural(d.cirurgias, 'cirurgia lançada', 'cirurgias lançadas'));
  if (d.demonstrativos > 0) lancado.push(plural(d.demonstrativos, 'demonstrativo ou nota acompanhado', 'demonstrativos e notas acompanhados'));
  if (lancado.length > 0) {
    linhas.push('');
    linhas.push('*Já lançamos*');
    for (const l of lancado) linhas.push(`• ${l}`);
  }

  const falta: string[] = [];
  if (!d.contador) falta.push('O e-mail do seu contador. Com ele, o pedido de nota sai sozinho a cada demonstrativo.');
  if (d.emailEntrada) falta.push(`Encaminhar os e-mails do hospital para ${d.emailEntrada}. Basta uma regra de encaminhamento no seu e-mail. Assim o demonstrativo entra sozinho.`);
  if (!d.celular) falta.push('Seu WhatsApp, para receber o resumo da manhã e o aviso quando um pagamento cair.');
  if (falta.length > 0) {
    linhas.push('');
    linhas.push(`*Para tudo ficar automático, ${falta.length === 1 ? 'falta 1 coisa' : `faltam ${falta.length} coisas`}*`);
    falta.forEach((f, i) => linhas.push(`${i + 1}. ${f}`));
  }
  linhas.push('');
  linhas.push('Todo mês, é só subir no app a planilha de cirurgias que vai para o hospital.');
  return linhas.join('\n');
}

/** Link do WhatsApp com a mensagem pronta; sem número, abre para escolher o contato. */
export function linkWhatsapp(texto: string, numero?: string | null): string {
  let n = (numero ?? '').replace(/\D/g, '');
  if (n && n.length <= 11) n = `55${n}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
