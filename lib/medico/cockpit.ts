import { cirurgiasDoDia, diaSeguinte } from './agenda';
import { avisos, ciclosMensais, etapaDe, pendencias, resumo, type Etapa } from './conciliacao';
import type { EstadoMedico } from './types';

// Cockpit da Área Médica (sub-projeto 114). PURO. A tela de entrada, no
// formato de vitrine (um destaque grande por vez e fileiras que deslizam de
// lado): o médico ou a secretária batem o olho e sabem como está tudo, com o
// mínimo de texto. Cada peça leva para o lugar certo do sistema.

type Estado = Omit<EstadoMedico, 'integracoes'>;
export type Destino = 'visao' | 'cirurgias' | 'demonstrativos' | 'pendencias' | 'agenda' | 'banco';

/** Um destaque do banner: um número ou frase grande, uma linha de apoio e um botão. */
export type Destaque = { id: string; selo: string; titulo: string; apoio: string; acao: string; destino: Destino; tom: 'azul' | 'vermelho' | 'verde' };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeDoMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1] ?? mes;

export function destaques(estado: Estado, hoje: string): Destaque[] {
  const out: Destaque[] = [];
  const r = resumo(estado.demonstrativos, estado.cirurgias, hoje, estado.hospitais);
  const abertas = estado.demonstrativos.filter((d) => !d.pago_em).length;

  out.push({
    id: 'receber',
    selo: 'A receber',
    titulo: brl(r.aReceber),
    apoio: abertas === 0 ? 'Nenhuma nota em aberto' : `${abertas} ${abertas === 1 ? 'nota em aberto' : 'notas em aberto'}`,
    acao: 'Ver notas',
    destino: 'demonstrativos',
    tom: 'azul',
  });

  const paraCobrar = pendencias(estado.cirurgias, estado.hospitais, hoje, estado.demonstrativos).filter((p) => p.cobrarAgora);
  if (paraCobrar.length > 0) {
    const n = paraCobrar.length;
    const valor = paraCobrar.reduce((s, p) => s + (p.cirurgia.valor ?? 0), 0);
    out.push({
      id: 'cobrar',
      selo: 'Sem pagamento',
      titulo: `${n} ${n === 1 ? 'cirurgia' : 'cirurgias'}`,
      apoio: valor > 0 ? `${brl(valor)} que o hospital deixou de fora` : 'Ficaram de fora do demonstrativo',
      acao: 'Cobrar agora',
      destino: 'pendencias',
      tom: 'vermelho',
    });
  }

  const proximo = avisos(estado.demonstrativos, estado.cirurgias, estado.hospitais, hoje).find((a) => a.tipo === 'demonstrativo');
  if (proximo) {
    const [quem, oQue] = proximo.texto.split(': ');
    out.push({ id: 'fazer', selo: 'Para fazer', titulo: (oQue ?? proximo.texto).replace(/^./, (c) => c.toUpperCase()), apoio: quem ?? '', acao: 'Resolver', destino: 'demonstrativos', tom: 'azul' });
  }

  const deHoje = cirurgiasDoDia(estado.cirurgias, hoje).filter((c) => c.hora);
  const deAmanha = cirurgiasDoDia(estado.cirurgias, diaSeguinte(hoje));
  const agenda = deHoje.length > 0 ? { quando: 'Hoje', lista: deHoje } : deAmanha.length > 0 ? { quando: 'Amanhã', lista: deAmanha } : null;
  if (agenda) {
    const n = agenda.lista.length;
    out.push({
      id: 'agenda',
      selo: 'Agenda',
      titulo: `${agenda.quando}: ${n} ${n === 1 ? 'cirurgia' : 'cirurgias'}`,
      apoio: agenda.lista[0]!.hora ? `A primeira às ${agenda.lista[0]!.hora}` : '',
      acao: 'Ver agenda',
      destino: 'agenda',
      tom: 'azul',
    });
  }

  if (r.recebidoNoMes > 0) {
    out.push({ id: 'recebido', selo: 'Neste mês', titulo: brl(r.recebidoNoMes), apoio: 'Já caiu na conta', acao: 'Ver banco', destino: 'banco', tom: 'verde' });
  }
  return out;
}

/** Um cartaz por hospital: quanto falta receber e quantas cirurgias estão para cobrar. */
export type CartazDoHospital = { id: string; nome: string; aReceber: number; paraCobrar: number; cirurgias: number };

export function mural(estado: Estado, hoje: string): CartazDoHospital[] {
  const todas = pendencias(estado.cirurgias, estado.hospitais, hoje, estado.demonstrativos);
  return estado.hospitais
    .map((h) => ({
      id: h.id,
      nome: h.nome,
      aReceber: estado.demonstrativos.filter((d) => d.hospital_id === h.id && !d.pago_em).reduce((s, d) => s + d.valor_total, 0),
      paraCobrar: todas.filter((p) => p.atrasada && p.cirurgia.hospital_id === h.id).length,
      cirurgias: estado.cirurgias.filter((c) => c.hospital_id === h.id && c.data <= hoje).length,
    }))
    .sort((a, b) => b.aReceber - a.aReceber);
}

/** As cirurgias que ficaram para trás há mais tempo (o "top" do que cobrar). */
export type ItemDoTop = { id: string; titulo: string; valor: string; detalhe: string };

export function topParaCobrar(estado: Estado, hoje: string, quantos = 10): ItemDoTop[] {
  return pendencias(estado.cirurgias, estado.hospitais, hoje, estado.demonstrativos)
    .filter((p) => p.atrasada)
    .slice(0, quantos)
    .map((p) => ({
      id: p.cirurgia.id,
      titulo: estado.hospitais.find((h) => h.id === p.cirurgia.hospital_id)?.nome ?? 'Hospital',
      valor: p.cirurgia.valor == null ? 'sem valor' : brl(p.cirurgia.valor),
      detalhe: `${p.dias} dias${p.vezes > 0 ? ` · cobrada ${p.vezes}x` : ''}`,
    }));
}

/** As notas em andamento, da mais parada para a mais nova. */
export type CartazDaNota = { id: string; quem: string; valor: string; etapa: Etapa; passo: number };

export function notasEmAndamento(estado: Estado): CartazDaNota[] {
  const ordem: Etapa[] = ['recebido', 'nota_pedida', 'nota_emitida', 'nota_enviada', 'pago'];
  return estado.demonstrativos
    .filter((d) => !d.pago_em)
    .sort((a, b) => a.recebido_em.localeCompare(b.recebido_em))
    .map((d) => {
      const etapa = etapaDe(d);
      return {
        id: d.id,
        quem: d.tipo === 'direto' ? d.pagador_nome || 'Paciente' : (estado.hospitais.find((h) => h.id === d.hospital_id)?.nome ?? 'Hospital'),
        valor: brl(d.valor_total),
        etapa,
        passo: ordem.indexOf(etapa) + 1,
      };
    });
}

export { ciclosMensais };
