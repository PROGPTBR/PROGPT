import type { Cirurgia, Hospital } from './types';

// Agenda do médico (sub-projeto 109). PURO. A cirurgia marcada é a mesma
// cirurgia da lista, com data no futuro e hora: depois que o dia passa ela
// segue o caminho normal (demonstrativo, nota, pagamento).

/** Dia seguinte de uma data AAAA-MM-DD. */
export function diaSeguinte(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function cirurgiasDoDia(cirurgias: Cirurgia[], dia: string): Cirurgia[] {
  return cirurgias.filter((c) => c.data === dia).sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));
}

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Uma linha da agenda, sem nome de paciente (vai por WhatsApp). */
export function linhaDaAgenda(c: Cirurgia, hospitais: Hospital[]): string {
  const hospital = hospitais.find((h) => h.id === c.hospital_id)?.nome ?? 'Hospital';
  return [c.hora || 'sem hora', hospital, c.procedimento, c.funcao].filter(Boolean).join(', ');
}

/** Lembrete da véspera. Null se não há cirurgia marcada para o dia seguinte. */
export function lembreteDaVespera(cirurgias: Cirurgia[], hospitais: Hospital[], hoje: string, medicoNome: string): { assunto: string; texto: string } | null {
  const amanha = diaSeguinte(hoje);
  const lista = cirurgiasDoDia(cirurgias, amanha);
  if (lista.length === 0) return null;
  const n = lista.length;
  return {
    assunto: `Agenda de amanhã: ${n} ${n === 1 ? 'cirurgia' : 'cirurgias'}`,
    texto:
      `Boa noite${medicoNome ? `, ${medicoNome}` : ''}. Sua agenda de amanhã (${dataBr(amanha)}):\n\n` +
      lista.map((c) => `• ${linhaDaAgenda(c, hospitais)}`).join('\n') +
      `\n\nDepois de operar, é só avisar no grupo: o app registra e acompanha o pagamento.`,
  };
}

/** Semanas (domingo a sábado) do mês de `mes` (AAAA-MM); null nas casas fora do mês. */
export function semanasDoMes(mes: string): (string | null)[][] {
  const [ano, m] = mes.split('-').map(Number) as [number, number];
  const primeiro = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const casas: (string | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: dias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)];
  while (casas.length % 7) casas.push(null);
  return Array.from({ length: casas.length / 7 }, (_, i) => casas.slice(i * 7, i * 7 + 7));
}

export function mesVizinho(mes: string, passo: number): string {
  const [ano, m] = mes.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(ano, m - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Linhas "Nome, contato" coladas de uma lista → indicações. Aceita vírgula, ponto e vírgula, tab ou traço. */
export function lerContatos(texto: string): { nome: string; contato: string }[] {
  const vistos = new Set<string>();
  const out: { nome: string; contato: string }[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const email = /[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/.exec(linha)?.[0];
    const telefone = /\+?\(?\d[\d\s().-]{8,}\d/.exec(linha)?.[0];
    const contato = (email ?? telefone ?? '').trim();
    if (!contato) continue;
    const nome = linha.replace(contato, '').replace(/[,;\t|<>()]+|\s-\s|-\s*$/g, ' ').replace(/\s+/g, ' ').trim();
    const chave = email ? contato.toLowerCase() : contato.replace(/\D/g, '');
    if (!nome || vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ nome: nome.slice(0, 120), contato: contato.slice(0, 120) });
  }
  return out.slice(0, 200);
}
