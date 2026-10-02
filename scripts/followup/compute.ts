// Lê um follow-up de compras (planilha item a item, exportada do ERP) e apura
// os indicadores do painel de carteira: SCs em aberto, pedidos críticos, lead
// time, OTIF, backlog e os rankings por comprador e por fornecedor.
//
// Separado do render de propósito: aqui só tem conta, e conta é conferível.

import { readFileSync } from 'node:fs';

export type Linha = Record<string, string>;

/** Data do Excel (serial 1900) → ISO. Serial 1 = 1899-12-31, com o bug do ano bissexto de 1900. */
export function serialParaData(v: string): Date | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Math.round((n - 25569) * 86_400_000));
}

export function mes(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function lerCsv(caminho: string): Linha[] {
  const txt = readFileSync(caminho, 'utf8');
  const linhas: string[][] = [];
  let campo = '';
  let atual: string[] = [];
  let aspas = false;

  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) {
      if (c === '"') {
        if (txt[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === ',') { atual.push(campo); campo = ''; continue; }
    if (c === '\n') { atual.push(campo); linhas.push(atual); atual = []; campo = ''; continue; }
    if (c !== '\r') campo += c;
  }
  if (campo || atual.length) { atual.push(campo); linhas.push(atual); }

  const [cab, ...resto] = linhas;
  if (!cab) return [];
  return resto
    .filter((l) => l.length > 1)
    .map((l) => Object.fromEntries(cab.map((h, i) => [h, (l[i] ?? '').trim()])));
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export type Painel = ReturnType<typeof apurar>;

export function apurar(linhas: Linha[]) {
  const scsAbertas = new Set<string>();
  const scsTotal = new Set<string>();
  const pedidosCriticos = new Set<string>();
  const pedidosAbertos = new Set<string>();

  const slaPorComprador = new Map<string, number[]>();
  const slaPorPrioridade = new Map<string, Map<string, number[]>>();
  const slas: number[] = [];

  const abertasPorComprador = new Map<string, Set<string>>();
  const porPrioridade = new Map<string, Set<string>>();
  const backlogPorMes = new Map<string, Set<string>>();

  let entregues = 0;
  let noPrazo = 0;
  let entreguesCriticos = 0;
  let noPrazoCriticos = 0;
  const atrasoPorFornecedor = new Map<string, number>();
  const entregasPorFornecedor = new Map<string, number>();

  for (const l of linhas) {
    const sc = l['N. SC'];
    const statusSc = l['Status SC'];
    const prioridade = l['Prioridade'] || 'Não informada';
    const comprador = l['Comprador'] || l['Comprador SC'] || 'Sem comprador';
    const fornecedor = l['Fornecedor'];
    const pedido = l['Pedido'];

    if (sc) {
      scsTotal.add(sc);
      if (statusSc === 'O') {
        scsAbertas.add(sc);
        if (!abertasPorComprador.has(comprador)) abertasPorComprador.set(comprador, new Set());
        abertasPorComprador.get(comprador)!.add(sc);

        const d = serialParaData(l['Dt. SC'] ?? '');
        if (d) {
          const k = mes(d);
          if (!backlogPorMes.has(k)) backlogPorMes.set(k, new Set());
          backlogPorMes.get(k)!.add(sc);
        }
      }
      if (!porPrioridade.has(prioridade)) porPrioridade.set(prioridade, new Set());
      porPrioridade.get(prioridade)!.add(sc);
    }

    if (pedido) {
      if (l['Status pedido'] === 'O') {
        pedidosAbertos.add(pedido);
        if (prioridade === 'URGENTE') pedidosCriticos.add(pedido);
      }
    }

    const sla = Number(l['SLA SC p/ PC']);
    if (Number.isFinite(sla) && l['SLA SC p/ PC'] !== '') {
      slas.push(sla);
      if (!slaPorComprador.has(comprador)) slaPorComprador.set(comprador, []);
      slaPorComprador.get(comprador)!.push(sla);
      if (!slaPorPrioridade.has(comprador)) slaPorPrioridade.set(comprador, new Map());
      const m = slaPorPrioridade.get(comprador)!;
      if (!m.has(prioridade)) m.set(prioridade, []);
      m.get(prioridade)!.push(sla);
    }

    // OTIF é derivado: a planilha não traz coluna de "entregue no prazo".
    const prevista = serialParaData(l['Dt. Entrega Prevista'] ?? '');
    const entrada = serialParaData(l['Dt. Entrada'] ?? '');
    if (prevista && entrada) {
      entregues += 1;
      const ok = entrada.getTime() <= prevista.getTime();
      if (ok) noPrazo += 1;
      if (prioridade === 'URGENTE') {
        entreguesCriticos += 1;
        if (ok) noPrazoCriticos += 1;
      }
      if (fornecedor) {
        entregasPorFornecedor.set(fornecedor, (entregasPorFornecedor.get(fornecedor) ?? 0) + 1);
        if (!ok) atrasoPorFornecedor.set(fornecedor, (atrasoPorFornecedor.get(fornecedor) ?? 0) + 1);
      }
    }
  }

  const compradores = [...slaPorComprador.entries()]
    .map(([nome, xs]) => ({ nome, sla: media(xs), itens: xs.length }))
    .filter((c) => c.itens >= 30)
    .sort((a, b) => a.sla - b.sla);

  const prioridades = ['URGENTE', 'Alta', 'Normal'].filter((p) => slaPorPrioridade.size > 0);

  const datasSc = linhas
    .map((l) => serialParaData(l['Dt. SC'] ?? ''))
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime());

  return {
    periodo: datasSc.length
      ? { de: new Date(Math.min(...datasSc)), ate: new Date(Math.max(...datasSc)) }
      : null,
    totalLinhas: linhas.length,
    scsTotal: scsTotal.size,
    kpis: {
      scsAbertas: scsAbertas.size,
      pedidosCriticos: pedidosCriticos.size,
      leadTimeMedio: media(slas),
      otif: entregues ? (noPrazo / entregues) * 100 : 0,
    },
    otif: { entregues, noPrazo },
    otifCriticos: {
      entregues: entreguesCriticos,
      noPrazo: noPrazoCriticos,
      pct: entreguesCriticos ? (noPrazoCriticos / entreguesCriticos) * 100 : 0,
    },
    abertasPorComprador: [...abertasPorComprador.entries()]
      .map(([nome, s]) => ({ nome, qtd: s.size }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10),
    porPrioridade: [...porPrioridade.entries()]
      .map(([nome, s]) => ({ nome, qtd: s.size }))
      .sort((a, b) => b.qtd - a.qtd),
    backlogPorMes: [...backlogPorMes.entries()]
      .map(([mesKey, s]) => ({ mes: mesKey, qtd: s.size }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    compradores,
    prioridades,
    matriz: [...slaPorPrioridade.entries()]
      .filter(([nome]) => compradores.some((c) => c.nome === nome))
      .map(([nome, m]) => ({
        nome,
        por: Object.fromEntries(
          ['URGENTE', 'Alta', 'Normal'].map((p) => [p, m.has(p) ? media(m.get(p)!) : null]),
        ) as Record<string, number | null>,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    fornecedoresAtraso: [...atrasoPorFornecedor.entries()]
      .map(([nome, atrasos]) => ({
        nome,
        atrasos,
        entregas: entregasPorFornecedor.get(nome) ?? 0,
      }))
      .sort((a, b) => b.atrasos - a.atrasos)
      .slice(0, 10),
  };
}
