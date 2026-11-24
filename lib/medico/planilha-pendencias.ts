import ExcelJS from 'exceljs';

import { PRODUCT_NAME } from '@/lib/legal/constants';

import type { Cirurgia, Hospital, MedicoConfig } from './types';

// Planilha de pendências no modelo que o hospital exige (sub-projeto 103):
// "Levantamento de pendências" da Gestão de Honorários Médicos. O prestador
// preenche as colunas A a H; as demais ficam em branco para o hospital
// (gestão de honorários e faturamento) responder.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** O que vai na coluna "Observações do Prestador": quando foi feita e o histórico da cobrança. */
export function observacaoDaPendencia(c: Cirurgia): string {
  const [ano, mes] = c.data.split('-');
  const cobrancas = [...(c.cobrancas ?? [])].sort();
  const partes = [`Cirurgia realizada em ${MESES[Number(mes) - 1]}/${ano}.`, 'Não consta em nenhum demonstrativo de repasse recebido.'];
  if (cobrancas.length > 0) {
    partes.push(`Pendência já enviada em ${cobrancas.map(dataBr).join(', ')}, sem retorno. Esta é a ${cobrancas.length + 1}ª cobrança.`);
  }
  if (c.observacao) partes.push(c.observacao);
  return partes.join(' ');
}

const COLUNAS: [string, number][] = [
  ['Data', 12],
  ['Médico', 32],
  ['Função', 14],
  ['Nº Registro (Descrição Cirúrgica)', 20],
  ['Paciente', 34],
  ['Convênio', 28],
  ['Procedimento', 48],
  ['Observações do Prestador', 48],
  ['Valor Bruto', 14],
  ['% (Negociação)', 14],
  ['Valor a Repassar', 16],
  ['Data de Repasse', 16],
  ['Motivo', 20],
  ['Observações da Área de Gestão de Honorários Médicos', 36],
  ['Faturado?', 12],
  ['Motivo Não Faturamento', 24],
  ['Observações do Setor de Faturamento', 32],
];

export function nomeDoArquivo(hospital: Hospital, config: MedicoConfig, hoje: string): string {
  const limpo = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Pendencias_${limpo(hospital.nome)}_${hoje}${config.medico_nome ? `_${limpo(config.medico_nome)}` : ''}.xlsx`;
}

export async function planilhaDePendencias(cirurgias: Cirurgia[], config: MedicoConfig): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = PRODUCT_NAME;
  const ws = wb.addWorksheet('Planilha de Pendências - Médico');
  ws.columns = COLUNAS.map(([, width]) => ({ width }));

  ws.mergeCells('A2:Q2');
  ws.getCell('A2').value = 'Levantamento de pendências';
  ws.getCell('A2').font = { bold: true, size: 14 };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  const cabecalho: [number, string, string, string?, string?][] = [
    [3, 'Empresa:', config.empresa_nome, 'CNPJ:', config.empresa_cnpj],
    [4, 'Médico:', config.medico_nome, 'CRM:', config.crm],
    [5, 'Contato:', config.contato || config.whatsapp_numero],
    [6, 'Especialidade:', config.especialidade],
  ];
  for (const [linha, rotulo, valor, rotulo2, valor2] of cabecalho) {
    ws.getCell(`A${linha}`).value = rotulo;
    ws.getCell(`A${linha}`).font = { bold: true };
    ws.getCell(`B${linha}`).value = valor;
    if (rotulo2) {
      ws.getCell(`F${linha}`).value = rotulo2;
      ws.getCell(`F${linha}`).font = { bold: true };
      ws.getCell(`G${linha}`).value = valor2 ?? '';
    }
  }

  const grupos: [string, string, string][] = [
    ['A7:H7', 'PREENCHIMENTO PELO PRESTADOR', 'FFD9E1F2'],
    ['I7:N7', 'PREENCHIMENTO GHM', 'FFE2EFDA'],
    ['O7:Q7', 'PREENCHIMENTO FATURAMENTO', 'FFFFF2CC'],
  ];
  for (const [faixa, titulo, cor] of grupos) {
    ws.mergeCells(faixa);
    const c = ws.getCell(faixa.split(':')[0]!);
    c.value = titulo;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } };
  }

  const borda = { style: 'thin' as const, color: { argb: 'FF999999' } };
  const moldura = { top: borda, left: borda, bottom: borda, right: borda };
  const titulos = ws.getRow(8);
  COLUNAS.forEach(([titulo], i) => {
    const c = titulos.getCell(i + 1);
    c.value = titulo;
    c.font = { bold: true };
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    c.border = moldura;
  });
  titulos.height = 32;

  [...cirurgias]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((c, i) => {
      const linha = ws.getRow(9 + i);
      const valores = [dataBr(c.data), config.medico_nome, c.funcao, c.registro, c.paciente, c.convenio, c.procedimento, observacaoDaPendencia(c)];
      for (let k = 0; k < COLUNAS.length; k++) {
        const cel = linha.getCell(k + 1);
        cel.value = valores[k] ?? '';
        cel.alignment = { wrapText: true, vertical: 'top' };
        cel.border = moldura;
      }
    });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
