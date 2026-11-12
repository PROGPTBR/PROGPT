import type {
  Apontamento,
  Conferencia,
  EntradaItem,
  FinalidadeNota,
  NotaLida,
  PedidoItem,
  StatusPedido,
} from './types';
import { valorSemTributos } from './nfe-xml';

// Conferência da nota contra o pedido (sub-projeto 95). Pura: recebe o
// pedido, a nota nova e o que já chegou antes, e devolve os apontamentos.
//
// Regras do processo descrito pelo Alexandre (2026-11):
//  - a nota de ENTREGA tem que ser igual ao pedido (itens e quantidades);
//  - a nota FINANCEIRA é comparada ao pedido em preço e em imposto, e o
//    imposto tem que estar informado no pedido para poder ser conferido;
//  - o NCM do pedido tem que ser literalmente o mesmo da nota;
//  - entrega parcial é aceita e o que faltou vira pendência.

const TOLERANCIA_PRECO = 0.005; // 0,5%
const TOLERANCIA_ALIQUOTA = 0.01; // pontos percentuais
const EPS = 1e-6;

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function palavras(s: string): Set<string> {
  return new Set(
    normalizar(s)
      // "10MM" e "10 mm", "12M" e "12 m" são a mesma coisa.
      .replace(/(\d)([a-z])/g, '$1 $2')
      .replace(/([a-z])(\d)/g, '$1 $2')
      .split(' ')
      .filter((p) => p.length >= 3 || /\d/.test(p)),
  );
}

/** Semelhança entre duas descrições (0 a 1, pelas palavras em comum). */
export function similaridade(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comum = 0;
  for (const p of pa) if (pb.has(p)) comum += 1;
  return comum / (pa.size + pb.size - comum);
}

export function ncmLimpo(ncm: string): string {
  return ncm.replace(/\D/g, '');
}

const UNIDADES: Record<string, string> = {
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', u: 'un',
  pc: 'pc', pca: 'pc', peca: 'pc', pecas: 'pc', pcs: 'pc',
  kg: 'kg', kgs: 'kg', quilo: 'kg',
  m: 'm', mt: 'm', mts: 'm', metro: 'm', metros: 'm', ml: 'm',
  m2: 'm2', mq: 'm2',
  m3: 'm3',
  cx: 'cx', caixa: 'cx', caixas: 'cx',
  sc: 'sc', saco: 'sc', sacos: 'sc',
  lt: 'l', l: 'l', litro: 'l', litros: 'l',
  t: 't', ton: 't', tonelada: 't',
  br: 'br', barra: 'br', barras: 'br',
  rl: 'rl', rolo: 'rl', rolos: 'rl',
  gl: 'gl', galao: 'gl',
  par: 'par', pares: 'par',
  jg: 'jg', jogo: 'jg',
};

export function unidadeCanonica(u: string): string {
  const n = normalizar(u.replace('²', '2').replace('³', '3')).replace(/\s/g, '');
  return UNIDADES[n] ?? n;
}

/** Para cada item da nota, o item do pedido correspondente (ou null).
 *  Ordem de preferência: mesmo código, mesmo NCM com descrição parecida,
 *  só descrição parecida. */
export function casarItens(pedido: PedidoItem[], nota: NotaLida['itens']): Array<number | null> {
  return nota.map((ni) => {
    const cod = normalizar(ni.codigo);
    if (cod) {
      const i = pedido.findIndex((pi) => pi.codigo && normalizar(pi.codigo) === cod);
      if (i >= 0) return i;
    }

    let melhor = -1;
    let melhorNota = 0;
    pedido.forEach((pi, i) => {
      const sim = similaridade(pi.descricao, ni.descricao);
      const mesmoNcm = !!ncmLimpo(pi.ncm) && ncmLimpo(pi.ncm) === ncmLimpo(ni.ncm);
      const pontos = sim + (mesmoNcm ? 0.35 : 0);
      if (pontos > melhorNota) {
        melhorNota = pontos;
        melhor = i;
      }
    });
    return melhor >= 0 && melhorNota >= 0.45 ? melhor : null;
  });
}

export function ladoEntrega(f: FinalidadeNota): boolean {
  return f === 'entrega' || f === 'unica';
}

export function ladoFinanceiro(f: FinalidadeNota): boolean {
  return f === 'financeira' || f === 'unica';
}

export type NotaAnterior = Pick<NotaLida, 'numero' | 'serie' | 'chave' | 'itens'> & {
  finalidade: FinalidadeNota;
  casamento: Array<number | null>;
};

/** Quantidade por item do pedido já coberta pelas notas anteriores de um lado. */
function somaPorItem(
  n: number,
  anteriores: NotaAnterior[],
  lado: (f: FinalidadeNota) => boolean,
  campo: 'quantidade' | 'valor_total',
): number[] {
  const soma = new Array<number>(n).fill(0);
  for (const a of anteriores) {
    if (!lado(a.finalidade)) continue;
    a.itens.forEach((it, k) => {
      const idx = a.casamento[k];
      if (idx == null || idx >= n) return;
      soma[idx]! += it[campo] ?? 0;
    });
  }
  return soma;
}

function fmtQtd(q: number): string {
  return q.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

function fmtBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

export function valorDoPedido(itens: PedidoItem[]): number {
  return Math.round(itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0) * 100) / 100;
}

export function conferirNota(args: {
  pedido: { itens: PedidoItem[]; fornecedor_cnpj: string };
  nota: NotaLida;
  finalidade: FinalidadeNota;
  anteriores?: NotaAnterior[];
}): Conferencia {
  const { pedido, nota, finalidade } = args;
  const anteriores = args.anteriores ?? [];
  const itensPedido = pedido.itens;
  const casamento = casarItens(itensPedido, nota.itens);
  const ap: Apontamento[] = [];
  const add = (a: Apontamento) => ap.push(a);

  // --- Nota repetida e emitente ---------------------------------------------
  const chave = nota.chave.replace(/\D/g, '');
  const repetida = anteriores.some(
    (a) =>
      (chave && a.chave.replace(/\D/g, '') === chave) ||
      (nota.numero && a.numero === nota.numero && (a.serie || '') === (nota.serie || '')),
  );
  if (repetida) {
    add({
      tipo: 'nota_repetida',
      severidade: 'alta',
      item: null,
      financeiro: false,
      mensagem: `A nota ${nota.numero || chave} já foi anexada a este pedido.`,
    });
  }

  const cnpjPedido = pedido.fornecedor_cnpj.replace(/\D/g, '');
  const cnpjNota = nota.emitente_cnpj.replace(/\D/g, '');
  if (cnpjPedido && cnpjNota && cnpjPedido !== cnpjNota) {
    add({
      tipo: 'emitente_diferente',
      severidade: 'alta',
      item: null,
      financeiro: false,
      mensagem: `A nota foi emitida por outro CNPJ (${nota.emitente_cnpj}), diferente do fornecedor do pedido.`,
    });
  }

  // --- Item a item ----------------------------------------------------------
  const entrega = ladoEntrega(finalidade);
  const financeiro = ladoFinanceiro(finalidade);
  const n = itensPedido.length;
  const entregueAntes = somaPorItem(n, anteriores, ladoEntrega, 'quantidade');
  const faturadoAntes = somaPorItem(n, anteriores, ladoFinanceiro, 'quantidade');
  const naNota = new Array<number>(n).fill(0);

  nota.itens.forEach((ni, k) => {
    const idx = casamento[k];
    if (idx == null) {
      add({
        tipo: 'item_fora_do_pedido',
        severidade: 'alta',
        item: null,
        financeiro: false,
        mensagem: `"${ni.descricao}" está na nota mas não está no pedido.`,
      });
      return;
    }
    const pi = itensPedido[idx]!;
    naNota[idx]! += ni.quantidade ?? 0;

    // NCM: tem que ser literalmente o mesmo.
    const ncmP = ncmLimpo(pi.ncm);
    const ncmN = ncmLimpo(ni.ncm);
    if (ncmP && ncmN && ncmP !== ncmN) {
      add({
        tipo: 'ncm_divergente',
        severidade: 'alta',
        item: idx,
        financeiro: true,
        mensagem: `NCM diferente em "${pi.descricao}": o pedido diz ${pi.ncm} e a nota diz ${ni.ncm}.`,
      });
    }

    if (entrega) {
      if (ni.unidade && pi.unidade && unidadeCanonica(ni.unidade) !== unidadeCanonica(pi.unidade)) {
        add({
          tipo: 'unidade_diferente',
          severidade: 'media',
          item: idx,
          financeiro: false,
          mensagem: `Unidade diferente em "${pi.descricao}": pedido em ${pi.unidade}, nota em ${ni.unidade}.`,
        });
      }
      if (!normalizar(ni.codigo) || normalizar(ni.codigo) !== normalizar(pi.codigo)) {
        if (similaridade(pi.descricao, ni.descricao) < 0.5) {
          add({
            tipo: 'descricao_diferente',
            severidade: 'media',
            item: idx,
            financeiro: false,
            mensagem: `Descrição diferente: o pedido diz "${pi.descricao}" e a nota diz "${ni.descricao}". Confirme se é o mesmo produto.`,
          });
        }
      }
    }

    // NT 2026.008: a SEFAZ confere só que líquido = unitário x quantidade,
    // não que o líquido bate com o vProd menos os tributos embutidos. Preço
    // formado multiplicando por (1 + alíquota) em vez de dividir por
    // (1 - alíquota) passa autorizado; aqui vira aviso para o financeiro.
    if (financeiro && ni.liquido?.total != null && ni.valor_total != null && ni.embutidos) {
      const esperado = valorSemTributos({ ...ni, liquido: null }).valor;
      const dif = Math.abs(ni.liquido.total - esperado);
      if (dif > Math.max(0.1, esperado * 0.005)) {
        add({
          tipo: 'liquido_divergente',
          severidade: 'info',
          item: idx,
          financeiro: true,
          mensagem: `"${pi.descricao}": a nota informa valor líquido (sem impostos) de ${fmtBrl(ni.liquido.total)}, mas o valor do produto menos os impostos embutidos (ICMS, PIS e Cofins) dá ${fmtBrl(esperado)}. A SEFAZ não confere isso: confirme o preço com o fornecedor.`,
        });
      }
    }

    if (financeiro && ni.valor_unitario != null) {
      const limite = pi.valor_unitario * (1 + TOLERANCIA_PRECO) + 0.005;
      if (ni.valor_unitario > limite) {
        add({
          tipo: 'preco_acima',
          severidade: 'alta',
          item: idx,
          financeiro: true,
          mensagem: `Preço acima do pedido em "${pi.descricao}": pedido ${fmtBrl(pi.valor_unitario)}, nota ${fmtBrl(ni.valor_unitario)}.`,
        });
      } else if (ni.valor_unitario < pi.valor_unitario * (1 - TOLERANCIA_PRECO) - 0.005) {
        add({
          tipo: 'preco_abaixo',
          severidade: 'info',
          item: idx,
          financeiro: true,
          mensagem: `Preço abaixo do pedido em "${pi.descricao}": pedido ${fmtBrl(pi.valor_unitario)}, nota ${fmtBrl(ni.valor_unitario)}.`,
        });
      }

      for (const [campo, nome] of [
        ['icms_pct', 'ICMS'],
        ['ipi_pct', 'IPI'],
      ] as const) {
        const esperado = pi[campo];
        const achado = ni[campo];
        if (esperado == null) continue;
        if (achado == null) {
          if (esperado > 0) {
            add({
              tipo: 'imposto_divergente',
              severidade: 'media',
              item: idx,
              financeiro: true,
              mensagem: `O pedido informa ${nome} de ${fmtPct(esperado)} em "${pi.descricao}", mas a nota não destaca ${nome}.`,
            });
          }
        } else if (Math.abs(achado - esperado) > TOLERANCIA_ALIQUOTA) {
          add({
            tipo: 'imposto_divergente',
            severidade: 'media',
            item: idx,
            financeiro: true,
            mensagem: `${nome} diferente em "${pi.descricao}": o pedido informa ${fmtPct(esperado)} e a nota destaca ${fmtPct(achado)}.`,
          });
        }
      }
    }
  });

  // --- Quantidades (somando o que já chegou em notas anteriores) -----------
  itensPedido.forEach((pi, idx) => {
    if (entrega) {
      const saldo = pi.quantidade - entregueAntes[idx]!;
      const veio = naNota[idx]!;
      if (veio > saldo + EPS) {
        add({
          tipo: 'quantidade_acima',
          severidade: 'alta',
          item: idx,
          financeiro: false,
          mensagem: `Quantidade acima do pedido em "${pi.descricao}": faltavam ${fmtQtd(Math.max(0, saldo))} ${pi.unidade} e a nota traz ${fmtQtd(veio)}.`,
        });
      } else if (saldo > EPS && veio < saldo - EPS) {
        add({
          tipo: 'entrega_parcial',
          severidade: 'info',
          item: idx,
          financeiro: false,
          mensagem: `"${pi.descricao}": a nota traz ${fmtQtd(veio)} de ${fmtQtd(saldo)} ${pi.unidade}. O restante (${fmtQtd(saldo - veio)}) fica pendente.`,
        });
      }
    } else if (financeiro) {
      const saldo = pi.quantidade - faturadoAntes[idx]!;
      if (naNota[idx]! > saldo + EPS) {
        add({
          tipo: 'quantidade_acima',
          severidade: 'alta',
          item: idx,
          financeiro: true,
          mensagem: `Faturado acima do pedido em "${pi.descricao}": faltava faturar ${fmtQtd(Math.max(0, saldo))} ${pi.unidade} e a nota fatura ${fmtQtd(naNota[idx]!)}.`,
        });
      }
    }
  });

  if (financeiro) {
    const semAliquota = (['icms_pct', 'ipi_pct'] as const).filter((c) =>
      casamento.some((idx) => idx != null && itensPedido[idx]![c] == null),
    );
    if (semAliquota.length > 0) {
      const nomes = semAliquota.map((c) => (c === 'icms_pct' ? 'ICMS' : 'IPI')).join(' e ');
      add({
        tipo: 'imposto_nao_informado',
        severidade: 'info',
        item: null,
        financeiro: true,
        mensagem: `O pedido não informa a alíquota de ${nomes} de algum item, então esse imposto não foi conferido. Informe no pedido para a conferência tributária ficar completa.`,
      });
    }

    const totalPedido = valorDoPedido(itensPedido);
    const faturadoAntesValor = somaPorItem(n, anteriores, ladoFinanceiro, 'valor_total').reduce((s, v) => s + v, 0);
    const valorNota = nota.itens.reduce((s, i) => s + (i.valor_total ?? (i.quantidade ?? 0) * (i.valor_unitario ?? 0)), 0);
    if (totalPedido > 0 && faturadoAntesValor + valorNota > totalPedido * (1 + TOLERANCIA_PRECO) + 0.01) {
      add({
        tipo: 'valor_acima_do_pedido',
        severidade: 'alta',
        item: null,
        financeiro: true,
        mensagem: `O valor faturado (${fmtBrl(faturadoAntesValor + valorNota)}, somando as notas) passa do valor do pedido (${fmtBrl(totalPedido)}).`,
      });
    }
  }

  if (itensPedido.some((pi, idx) => !ncmLimpo(pi.ncm) && casamento.includes(idx))) {
    add({
      tipo: 'ncm_ausente',
      severidade: 'info',
      item: null,
      financeiro: true,
      mensagem: 'Algum item do pedido está sem NCM, então o NCM desse item não foi conferido.',
    });
  }

  return {
    ok: !ap.some((a) => a.severidade !== 'info'),
    apontamentos: ap,
    casamento,
  };
}

/** Apontamentos que o almoxarifado pode ver: nada de preço nem de imposto. */
export function apontamentosSemValores(c: Conferencia): Apontamento[] {
  return c.apontamentos.filter((a) => !a.financeiro);
}

// --- Saldo do recebimento físico -------------------------------------------

export type SaldoItem = {
  item: number;
  descricao: string;
  unidade: string;
  pedida: number;
  recebida: number;
  pendente: number;
  ressalvas: string[];
};

export function saldoDoPedido(itens: PedidoItem[], entradas: Array<{ itens: EntradaItem[] }>): SaldoItem[] {
  return itens.map((pi, idx) => {
    let recebida = 0;
    const ressalvas: string[] = [];
    for (const e of entradas) {
      for (const ei of e.itens) {
        if (ei.item !== idx) continue;
        recebida += ei.quantidade;
        if (ei.ressalva.trim()) ressalvas.push(ei.ressalva.trim());
      }
    }
    return {
      item: idx,
      descricao: pi.descricao,
      unidade: pi.unidade,
      pedida: pi.quantidade,
      recebida,
      pendente: Math.max(0, Math.round((pi.quantidade - recebida) * 1e6) / 1e6),
      ressalvas,
    };
  });
}

/** O almoxarifado só atesta quando não sobra nada pendente. */
export function podeAtestar(saldo: SaldoItem[]): boolean {
  return saldo.length > 0 && saldo.every((s) => s.pendente <= EPS);
}

/** Recusa entrada acima do pendente ou com quantidade inválida. */
export function validarEntrada(saldo: SaldoItem[], itens: EntradaItem[]): string | null {
  const validos = itens.filter((i) => i.quantidade > 0);
  if (validos.length === 0) return 'Informe a quantidade recebida de pelo menos um item.';
  for (const ei of validos) {
    const s = saldo[ei.item];
    if (!s) return 'Item inválido.';
    if (ei.quantidade > s.pendente + EPS) {
      return `"${s.descricao}": faltam ${fmtQtd(s.pendente)} ${s.unidade} e foram informados ${fmtQtd(ei.quantidade)}. Registre só o que o pedido pede.`;
    }
  }
  return null;
}

export function statusDoPedido(args: {
  cancelado: boolean;
  pagamentoLiberado: boolean;
  temNota: boolean;
  saldo: SaldoItem[];
}): StatusPedido {
  if (args.cancelado) return 'cancelado';
  if (args.pagamentoLiberado) return 'pagamento_liberado';
  if (podeAtestar(args.saldo)) return 'aguardando_ok';
  if (args.saldo.some((s) => s.recebida > EPS)) return 'parcial';
  return args.temNota ? 'aguardando_entrega' : 'aguardando_nota';
}
