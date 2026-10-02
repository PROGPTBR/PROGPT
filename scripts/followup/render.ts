import { writeFileSync } from 'node:fs';
import {
  AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx';

import { lerCsv, apurar, type Painel } from './compute';
import { barras, rosca, linha, velocimetro } from './charts';

const LARGURA = 9026; // A4 menos as margens, em DXA
const META_OTIF = 95;

const num = (n: number, casas = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

const data = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

function texto(t: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text: t, bold: opts.bold, size: opts.size ?? 20, color: opts.color, font: 'Calibri' });
}

function p(t: string, opts: { bold?: boolean; size?: number; color?: string; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    children: [texto(t, opts)],
    spacing: { after: opts.after ?? 120 },
    alignment: opts.align,
  });
}

function imagem(png: Buffer, larguraPx: number, alturaPx: number) {
  return new Paragraph({
    children: [new ImageRun({ data: png, type: 'png', transformation: { width: larguraPx, height: alturaPx } })],
    spacing: { after: 200 },
  });
}

function titulo(t: string) {
  return new Paragraph({
    children: [texto(t, { bold: true, size: 26, color: '0E8DE1' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
  });
}

function celula(filhos: Paragraph[], largura: number, fundo?: string) {
  return new TableCell({
    children: filhos,
    width: { size: largura, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    shading: fundo ? { type: ShadingType.CLEAR, fill: fundo, color: 'auto' } : undefined,
  });
}

function cartoesKpi(painel: Painel): Table {
  const larg = Math.floor(LARGURA / 4);
  const kpis: [string, string, string][] = [
    ['SCs em aberto', num(painel.kpis.scsAbertas), `de ${num(painel.scsTotal)} no período`],
    ['Pedidos críticos', num(painel.kpis.pedidosCriticos), 'urgentes ainda abertos'],
    ['Lead time médio', `${num(painel.kpis.leadTimeMedio, 1)} d`, 'da SC ao pedido'],
    ['Taxa OTIF', `${num(painel.kpis.otif, 1)}%`, `${num(painel.otif.noPrazo)} de ${num(painel.otif.entregues)}`],
  ];
  return new Table({
    columnWidths: [larg, larg, larg, larg],
    rows: [
      new TableRow({
        children: kpis.map(([rotulo, valor, nota]) =>
          celula(
            [
              p(rotulo.toUpperCase(), { size: 15, color: '64748B', after: 40 }),
              p(valor, { bold: true, size: 40, color: '0F172A', after: 40 }),
              p(nota, { size: 15, color: '64748B', after: 0 }),
            ],
            larg,
            'F8FAFC',
          ),
        ),
      }),
    ],
  });
}

/** Verde (rápido) → vermelho (lento), escala sobre o maior lead time da matriz. */
function corCalor(v: number, max: number): string {
  const t = Math.min(1, Math.max(0, v / max));
  const mistura = (a: number, b: number) => Math.round(a + (b - a) * t);
  return [mistura(0xd1, 0xfe), mistura(0xfa, 0xe2), mistura(0xe5, 0xe2)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function matriz(painel: Painel): Table {
  const cols = ['URGENTE', 'Alta', 'Normal'];
  const largNome = 3400;
  const largCol = Math.floor((LARGURA - largNome) / cols.length);
  const max = Math.max(
    ...painel.matriz.flatMap((m) => cols.map((c) => m.por[c] ?? 0)),
    1,
  );

  const cabecalho = new TableRow({
    tableHeader: true,
    children: [
      celula([p('Comprador', { bold: true, size: 17, color: '475569', after: 0 })], largNome, 'F1F5F9'),
      ...cols.map((c) =>
        celula([p(c, { bold: true, size: 17, color: '475569', after: 0, align: AlignmentType.CENTER })], largCol, 'F1F5F9'),
      ),
    ],
  });

  const linhas = painel.matriz.map((m) =>
    new TableRow({
      children: [
        celula([p(m.nome, { size: 17, after: 0 })], largNome),
        ...cols.map((c) => {
          const v = m.por[c];
          return celula(
            [p(v == null ? '—' : num(v, 1), { bold: v != null, size: 18, after: 0, align: AlignmentType.CENTER })],
            largCol,
            v == null ? 'FFFFFF' : corCalor(v, max),
          );
        }),
      ],
    }),
  );

  return new Table({ columnWidths: [largNome, ...cols.map(() => largCol)], rows: [cabecalho, ...linhas] });
}

function tabela(cabecalhos: string[], linhas: string[][], pesos: number[]): Table {
  const total = pesos.reduce((a, b) => a + b, 0);
  const larguras = pesos.map((x) => Math.floor((LARGURA * x) / total));
  return new Table({
    columnWidths: larguras,
    rows: [
      new TableRow({
        tableHeader: true,
        children: cabecalhos.map((h, i) =>
          celula([p(h, { bold: true, size: 17, color: '475569', after: 0, align: i ? AlignmentType.CENTER : undefined })], larguras[i]!, 'F1F5F9'),
        ),
      }),
      ...linhas.map((l) =>
        new TableRow({
          children: l.map((c, i) =>
            celula([p(c, { size: 17, after: 0, align: i ? AlignmentType.CENTER : undefined })], larguras[i]!),
          ),
        }),
      ),
    ],
  });
}

async function main() {
  const csv = process.argv[2]!;
  const destino = process.argv[3]!;
  const painel = apurar(lerCsv(csv));

  const periodo = painel.periodo
    ? `${data(painel.periodo.de)} a ${data(painel.periodo.ate)}`
    : 'período não identificado';

  const filhos: (Paragraph | Table)[] = [
    new Paragraph({
      children: [texto('Painel de Carteira de Compras', { bold: true, size: 44, color: '0F172A' })],
      spacing: { after: 80 },
    }),
    p(`CBL - AR · follow-up de ${num(painel.totalLinhas)} linhas · ${num(painel.scsTotal)} solicitações · ${periodo}`, {
      size: 18,
      color: '64748B',
      after: 260,
    }),

    cartoesKpi(painel),
    p('', { after: 120 }),
    p(
      `Os pedidos urgentes chegam no prazo com menos frequência que a média: ${num(painel.otifCriticos.pct, 1)}% contra ${num(painel.kpis.otif, 1)}% da carteira inteira. ` +
        'Eles são comprados mais rápido, mas recebem prazos de entrega mais apertados — e é aí que escorregam.',
      { size: 19, after: 120 },
    ),

    titulo('SCs em aberto por comprador'),
    imagem(barras(painel.abertasPorComprador), 600, Math.round((40 + painel.abertasPorComprador.length * 46) * 0.6)),

    titulo('Criticidade das solicitações'),
    imagem(rosca(painel.porPrioridade.filter((x) => x.qtd > 1)), 600, 252),

    titulo('Evolução do backlog'),
    p('Solicitações ainda em aberto, pelo mês em que foram abertas.', { size: 17, color: '64748B' }),
    imagem(linha(painel.backlogPorMes), 600, 252),

    titulo('Atendimento no prazo — pedidos urgentes'),
    imagem(
      velocimetro(
        painel.otifCriticos.pct,
        META_OTIF,
        `${num(painel.otifCriticos.noPrazo)} de ${num(painel.otifCriticos.entregues)} entregas urgentes no prazo`,
      ),
      600,
      240,
    ),

    titulo('Lead time médio por comprador × criticidade'),
    p('Dias entre a solicitação e o pedido. Quanto mais vermelho, mais demorado.', { size: 17, color: '64748B' }),
    matriz(painel),

    titulo('Ranking de compradores'),
    p('Lead time médio da SC ao pedido, entre quem tratou ao menos 30 itens.', { size: 17, color: '64748B' }),
    tabela(
      ['Comprador', 'Lead time médio', 'Itens'],
      painel.compradores.map((c) => [c.nome, `${num(c.sla, 1)} d`, num(c.itens)]),
      [5, 2, 2],
    ),

    titulo('Fornecedores com mais entregas em atraso'),
    tabela(
      ['Fornecedor', 'Em atraso', 'Entregas', '% atraso'],
      painel.fornecedoresAtraso.map((f) => [
        f.nome,
        num(f.atrasos),
        num(f.entregas),
        `${num((f.atrasos / Math.max(f.entregas, 1)) * 100, 0)}%`,
      ]),
      [6, 2, 2, 2],
    ),

    titulo('Como cada número foi apurado'),
    p('• SCs em aberto: solicitações distintas com Status SC = "O".', { size: 17, after: 60 }),
    p('• Pedidos críticos: pedidos distintos ainda abertos com Prioridade = "URGENTE".', { size: 17, after: 60 }),
    p('• Lead time: coluna "SLA SC p/ PC", em dias, da solicitação até o pedido.', { size: 17, after: 60 }),
    p('• Entregue no prazo: Dt. Entrada menor ou igual à Dt. Entrega Prevista. A planilha não traz essa marcação pronta — ela foi calculada a partir das duas datas, e só entram as linhas que têm as duas preenchidas.', { size: 17, after: 60 }),
    p('• A meta de 95% do velocímetro é uma suposição; troque pela meta real da área.', { size: 17, after: 0 }),
  ];

  const doc = new Document({
    creator: 'PROGPT',
    title: 'Painel de Carteira de Compras',
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: filhos }],
  });

  writeFileSync(destino, await Packer.toBuffer(doc));
  console.log('gerado:', destino);
}

void main();
