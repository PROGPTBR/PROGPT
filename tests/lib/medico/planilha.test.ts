import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { parseXlsxDireto } from '@/lib/chat-attachments/xlsx';
import { funcaoPadrao } from '@/components/medico/Cirurgias';
import { nomeDoArquivo, observacaoDaPendencia, planilhaDePendencias } from '@/lib/medico/planilha-pendencias';
import { CONFIG_VAZIA, type Cirurgia, type Hospital } from '@/lib/medico/types';

const H: Hospital = { id: 'h1', nome: "Niterói D'Or", email: '', prazo_pagamento_dias: 30, exemplo: false };
const config = { ...CONFIG_VAZIA, medico_nome: 'Ana Teste', empresa_nome: 'Teste Serviços Médicos Ltda', empresa_cnpj: '11.222.333/0001-81', crm: '52.00000-0', especialidade: 'Ortopedia', contato: '(21) 90000-0000' };

function cir(extra: Partial<Cirurgia>): Cirurgia {
  return { id: 'c', hospital_id: 'h1', data: '2026-07-09', paciente: 'Paciente Exemplo Um', procedimento: '30733073 Reconstrução de ligamento', convenio: 'Bradesco / Nacional III', valor: null, origem: 'manual', demonstrativo_id: null, cobrada_em: null, funcao: '2º Auxiliar', registro: '', hora: '', cobrancas: [], observacao: '', exemplo: false, ...extra };
}

describe('planilha de pendências no modelo do hospital', () => {
  it('a observação diz o mês da cirurgia e o histórico da cobrança', () => {
    expect(observacaoDaPendencia(cir({}))).toBe('Cirurgia realizada em julho/2026. Não consta em nenhum demonstrativo de repasse recebido.');
    const reenviada = observacaoDaPendencia(cir({ cobrancas: ['2026-09-10', '2026-08-05'] }));
    expect(reenviada).toContain('Pendência já enviada em 05/08/2026, 10/09/2026, sem retorno. Esta é a 3ª cobrança.');
    expect(reenviada).not.toMatch(/[—–]/);
  });

  it('tem o cabeçalho, os três blocos e uma linha por cirurgia, em ordem de data', async () => {
    const buf = await planilhaDePendencias([cir({ id: 'b', data: '2026-07-30', paciente: 'Paciente Exemplo Dois', funcao: '1º Auxiliar' }), cir({})], config);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const v = (ref: string) => String(ws.getCell(ref).value ?? '');
    expect(ws.name).toBe('Planilha de Pendências - Médico');
    expect(v('A2')).toBe('Levantamento de pendências');
    expect([v('A3'), v('B3'), v('F3'), v('G3')]).toEqual(['Empresa:', 'Teste Serviços Médicos Ltda', 'CNPJ:', '11.222.333/0001-81']);
    expect([v('B4'), v('G4'), v('B5'), v('B6')]).toEqual(['Ana Teste', '52.00000-0', '(21) 90000-0000', 'Ortopedia']);
    expect([v('A7'), v('I7'), v('O7')]).toEqual(['PREENCHIMENTO PELO PRESTADOR', 'PREENCHIMENTO GHM', 'PREENCHIMENTO FATURAMENTO']);
    expect([v('A8'), v('C8'), v('E8'), v('H8'), v('I8'), v('Q8')]).toEqual(['Data', 'Função', 'Paciente', 'Observações do Prestador', 'Valor Bruto', 'Observações do Setor de Faturamento']);
    expect([v('A9'), v('B9'), v('C9'), v('E9'), v('F9')]).toEqual(['09/07/2026', 'Ana Teste', '2º Auxiliar', 'Paciente Exemplo Um', 'Bradesco / Nacional III']);
    expect([v('A10'), v('C10'), v('E10')]).toEqual(['30/07/2026', '1º Auxiliar', 'Paciente Exemplo Dois']);
    // As colunas do hospital ficam em branco para ele responder.
    expect([v('I9'), v('L9'), v('O9')]).toEqual(['', '', '']);
    expect(nomeDoArquivo(H, config, '2026-11-24')).toBe('Pendencias_Niteroi_D_Or_2026-11-24_Ana_Teste.xlsx');
  });

  it('o leitor direto abre a planilha que o próprio sistema gera (é o reserva de quando o ExcelJS falha)', async () => {
    const texto = await parseXlsxDireto(await planilhaDePendencias([cir({})], config));
    expect(texto).toContain('# Planilha de Pendências - Médico');
    expect(texto).toContain('Teste Serviços Médicos Ltda');
    expect(texto).toContain('| 09/07/2026 | Ana Teste | 2º Auxiliar |');
  });

  it('reconhece a função escrita de vários jeitos', () => {
    expect(funcaoPadrao('2º auxiliar')).toBe('2º Auxiliar');
    expect(funcaoPadrao('2o Auxiliar')).toBe('2º Auxiliar');
    expect(funcaoPadrao('cirurgiao')).toBe('Cirurgião');
    expect(funcaoPadrao('residente')).toBe('');
    expect(funcaoPadrao(null)).toBe('');
  });
});
