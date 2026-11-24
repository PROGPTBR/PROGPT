// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { AreaMedicaRoot } from '@/components/medico/AreaMedicaRoot';
import { casarItens, totalDosItens } from '@/lib/medico/conciliacao';
import { dadosDeExemplo } from '@/lib/medico/exemplo';
import type { Cirurgia, Demonstrativo, EstadoMedico, Hospital } from '@/lib/medico/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/assistants/CompradorImportDialog', () => ({ CompradorImportDialog: () => null }));

const HOJE = '2026-11-24';
afterEach(cleanup);

/** O mesmo estado que "Carregar exemplo" grava, montado em memória. */
function estadoDeExemplo(): EstadoMedico {
  const ex = dadosDeExemplo(HOJE);
  const hospitais: Hospital[] = ex.hospitais.map((h) => ({ id: h.chave, nome: h.nome, email: h.email, prazo_pagamento_dias: h.prazo, exemplo: true }));
  let cirurgias: Cirurgia[] = ex.cirurgias.map((c, i) => ({
    id: `c${i}`, hospital_id: c.hospital, data: c.data, paciente: c.paciente, procedimento: c.procedimento, convenio: c.convenio, valor: c.valor,
    origem: 'whatsapp', demonstrativo_id: null, cobrada_em: null, observacao: '', exemplo: true,
  }));
  const demonstrativos: Demonstrativo[] = ex.demonstrativos.map((d, i) => {
    const itens = casarItens(d.itens, cirurgias, d.hospital);
    const ids = new Set(itens.map((x) => x.cirurgia_id));
    cirurgias = cirurgias.map((c) => (ids.has(c.id) ? { ...c, demonstrativo_id: `d${i}` } : c));
    return { id: `d${i}`, hospital_id: d.hospital, referencia: d.referencia, recebido_em: d.recebido_em, valor_total: totalDosItens(d.itens), itens,
      nota_pedida_em: d.nota_pedida_em, nota_numero: d.nota_numero, nota_emitida_em: d.nota_emitida_em, nota_enviada_em: d.nota_enviada_em, pago_em: d.pago_em, valor_pago: d.valor_pago, exemplo: true };
  });
  return { config: ex.config, hospitais, cirurgias, demonstrativos };
}

describe('Área Médica (tela)', () => {
  it('conta nova começa nos cadastros', () => {
    render(<AreaMedicaRoot estadoInicial={{ config: { medico_nome: '', contador_nome: '', contador_email: '' }, hospitais: [], cirurgias: [], demonstrativos: [] }} hoje={HOJE} />);
    expect(screen.getByText('Hospitais')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Carregar exemplo/ })).toBeTruthy();
  });

  it('visão geral mostra os indicadores e a fila do que fazer', () => {
    render(<AreaMedicaRoot estadoInicial={estadoDeExemplo()} hoje={HOJE} />);
    expect(screen.getByText('A receber')).toBeTruthy();
    expect(screen.getByText('O que fazer agora')).toBeTruthy();
    expect(screen.getByText(/2 cirurgias feitas e não pagas/)).toBeTruthy();
    expect(screen.getByText(/pedir a nota ao contador/)).toBeTruthy();
    expect(screen.getByText(/dados fictícios de exemplo/)).toBeTruthy();
  });

  it('percorre as abas: cirurgias, demonstrativos (com o e-mail ao contador) e pendências (com a cobrança)', () => {
    render(<AreaMedicaRoot estadoInicial={estadoDeExemplo()} hoje={HOJE} />);
    const abas = screen.getByRole('navigation', { name: 'Seções da Área Médica' });

    fireEvent.click(within(abas).getByText('Cirurgias'));
    expect(screen.getAllByText('Paga').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sem pagamento, atrasada').length).toBe(2 + 1); // 2 linhas + opção do filtro

    fireEvent.click(within(abas).getByText('Demonstrativos e notas'));
    expect(screen.getAllByText('Pago').length).toBeGreaterThan(0);
    expect(screen.getByText(/faltam/)).toBeTruthy(); // pago a menos
    fireEvent.click(screen.getByRole('button', { name: 'Pedir a nota ao contador' }));
    const pedido = screen.getByRole('dialog', { name: 'Pedir a nota ao contador' });
    expect(within(pedido).getByText('paula@contabilidade-exemplo.com.br')).toBeTruthy();
    expect((within(pedido).getByLabelText('Texto do e-mail') as HTMLTextAreaElement).value).toContain('Hospital Itaipu');
    fireEvent.click(within(pedido).getByRole('button', { name: 'Fechar' }));

    fireEvent.click(within(abas).getByText(/Pendências a cobrar/));
    const cobrar = screen.getAllByRole('button', { name: /Gerar cobrança/ });
    expect(cobrar.length).toBe(3);
    fireEvent.click(cobrar[0]!);
    const texto = (screen.getByLabelText('Texto do e-mail') as HTMLTextAreaElement).value;
    expect(texto).toContain('L. M. N.');
    expect(texto).toContain('P. H. S.');
  });
});
