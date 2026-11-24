// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { AreaMedicaRoot } from '@/components/medico/AreaMedicaRoot';
import { casarItens, totalDosItens } from '@/lib/medico/conciliacao';
import { dadosDeExemplo } from '@/lib/medico/exemplo';
import { CONFIG_VAZIA, type Cirurgia, type Demonstrativo, type EstadoMedico, type Hospital, type Integracoes } from '@/lib/medico/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/assistants/CompradorImportDialog', () => ({ CompradorImportDialog: () => null }));
vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ estado: 'close', grupos: [], configurado: true }), { status: 200 })));

const HOJE = '2026-11-24';
afterEach(cleanup);
const INTEGRACOES: Integracoes = { whatsapp: true, email_envio: true, email_entrada: 'medico-abc@inbound.exemplo.com', super_admin: false, btg: true };

/** O mesmo estado que "Carregar exemplo" grava, montado em memória. */
function estadoDeExemplo(): EstadoMedico {
  const ex = dadosDeExemplo(HOJE);
  const hospitais: Hospital[] = ex.hospitais.map((h) => ({ id: h.chave, nome: h.nome, email: h.email, prazo_pagamento_dias: h.prazo, exemplo: true }));
  let cirurgias: Cirurgia[] = ex.cirurgias.map((c, i) => ({
    id: `c${i}`, hospital_id: c.hospital, data: c.data, paciente: c.paciente, procedimento: c.procedimento, convenio: c.convenio, valor: c.valor,
    origem: 'whatsapp', demonstrativo_id: null, cobrada_em: c.cobrancas.at(-1) ?? null, funcao: c.funcao, registro: '', hora: '', cobrancas: c.cobrancas, observacao: '', exemplo: true,
  }));
  const demonstrativos: Demonstrativo[] = ex.demonstrativos.map((d, i) => {
    const itens = casarItens(d.itens, cirurgias, d.hospital);
    const ids = new Set(itens.map((x) => x.cirurgia_id));
    cirurgias = cirurgias.map((c) => (ids.has(c.id) ? { ...c, demonstrativo_id: `d${i}` } : c));
    return { id: `d${i}`, hospital_id: d.hospital, referencia: d.referencia, recebido_em: d.recebido_em, valor_total: totalDosItens(d.itens), itens,
      nota_pedida_em: d.nota_pedida_em, nota_numero: d.nota_numero, nota_emitida_em: d.nota_emitida_em, nota_enviada_em: d.nota_enviada_em, pago_em: d.pago_em, valor_pago: d.valor_pago, exemplo: true, tipo: 'hospital' as const, pagador_nome: '', pagador_documento: '', pagador_contato: '' };
  });
  return { config: { ...CONFIG_VAZIA, ...ex.config }, hospitais, cirurgias, demonstrativos, entradas: [], conta: null, movimentos: [], documentos: [], indicacoes: [], integracoes: INTEGRACOES };
}

describe('Área Médica (tela)', () => {
  it('conta nova começa nos cadastros', () => {
    render(<AreaMedicaRoot estadoInicial={{ config: CONFIG_VAZIA, hospitais: [], cirurgias: [], demonstrativos: [], entradas: [], conta: null, movimentos: [], documentos: [], indicacoes: [], integracoes: INTEGRACOES }} hoje={HOJE} />);
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
    const cobrar = screen.getAllByRole('button', { name: /Enviar ao hospital/ });
    expect(cobrar.length).toBe(3);
    expect(screen.getAllByRole('link', { name: /Baixar planilha/ }).length).toBe(3);
    // As duas que o hospital deixou de fora já foram cobradas há 32 dias, sem resposta.
    expect(screen.getAllByText(/sem resposta há 32 dias/).length).toBe(2);
    expect(screen.getByText('2 precisam ser cobradas agora.')).toBeTruthy();
    fireEvent.click(cobrar[0]!);
    const texto = (screen.getByLabelText('Texto do e-mail') as HTMLTextAreaElement).value;
    expect(texto).toContain('planilha de levantamento de pendências');
    expect(texto).toContain('já foram enviadas antes');
  });

  it('caixa de entrada: mensagens do grupo e e-mail recebido aparecem para conferir', () => {
    const estado = estadoDeExemplo();
    estado.config.grupo_nome = 'Cirurgias Dr. Eduardo';
    estado.entradas = [
      { id: 'e1', canal: 'whatsapp', remetente: 'Secretária', assunto: '', texto: 'feita hoje hérnia do J.P.', recebido_em: '2026-11-24T12:00:00Z' },
      { id: 'e2', canal: 'whatsapp', remetente: 'Você', assunto: '', texto: 'ok', recebido_em: '2026-11-24T12:05:00Z' },
      { id: 'e3', canal: 'email', remetente: 'repasse@hospital.com', assunto: 'Demonstrativo de novembro', texto: 'linhas...', recebido_em: '2026-11-24T13:00:00Z' },
    ];
    render(<AreaMedicaRoot estadoInicial={estado} hoje={HOJE} />);
    const abas = screen.getByRole('navigation', { name: 'Seções da Área Médica' });

    fireEvent.click(within(abas).getByText('Cirurgias'));
    expect(screen.getByText(/2 mensagens novas/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ler cirurgias' }));
    expect((screen.getByLabelText('Texto com as cirurgias') as HTMLTextAreaElement).value).toContain('Secretária: feita hoje hérnia do J.P.');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    fireEvent.click(within(abas).getByText('Demonstrativos e notas'));
    expect(screen.getByText('Demonstrativo de novembro')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir demonstrativo' }));
    expect((screen.getByLabelText('Texto do demonstrativo') as HTMLTextAreaElement).value).toContain('linhas...');
  });

  it('cobrança direta, envio automático e integrações estão na tela', () => {
    render(<AreaMedicaRoot estadoInicial={estadoDeExemplo()} hoje={HOJE} />);
    const abas = screen.getByRole('navigation', { name: 'Seções da Área Médica' });

    fireEvent.click(within(abas).getByText('Demonstrativos e notas'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir a nota ao contador' }));
    expect(screen.getByRole('button', { name: /Enviar agora/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: /Cobrança direta/ }));
    expect(screen.getByText('CPF ou CNPJ de quem paga')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    fireEvent.click(within(abas).getByText('Integrações'));
    expect(screen.getByText('Seu WhatsApp')).toBeTruthy();
    expect(screen.getByText('Avisos fora da tela')).toBeTruthy();
    expect(screen.getByText('medico-abc@inbound.exemplo.com')).toBeTruthy();
    // O quadro do número de avisos da 2B Supply é só para super admin.
    expect(screen.queryByText(/Número que envia os avisos/)).toBeNull();
  });

  it('banco: liga a conta do BTG, mostra o que entrou e saiu e sugere o pagamento com imposto retido', () => {
    const estado = estadoDeExemplo();
    render(<AreaMedicaRoot estadoInicial={estado} hoje={HOJE} abaInicial="banco" />);
    expect(screen.getByRole('button', { name: 'Conectar BTG' })).toBeTruthy();
    expect(screen.getByText(/Conferir extrato/)).toBeTruthy();
    cleanup();

    const enviada = estado.demonstrativos.find((d) => d.nota_enviada_em && !d.pago_em)!;
    estado.conta = { cnpj: '11222333000181', conectado_em: '2026-11-01T12:00:00Z', erro: '' };
    estado.movimentos = [
      { id: 'm1', data: '2026-11-23T15:00:00Z', sentido: 'entrada', valor: enviada.valor_total - 500, forma: 'TED', descricao: "TED RECEBIDA NITEROI D'OR", contraparte: '', demonstrativo_id: null },
      { id: 'm2', data: '2026-11-20T15:00:00Z', sentido: 'saida', valor: 1200, forma: 'Pix', descricao: 'Pix enviado', contraparte: 'CONTABILIDADE', demonstrativo_id: null },
    ];
    render(<AreaMedicaRoot estadoInicial={estado} hoje={HOJE} abaInicial="banco" />);
    expect(screen.getByText(/11\.222\.333\/0001-81/)).toBeTruthy();
    expect(screen.getByText('Entrou neste mês')).toBeTruthy();
    expect(screen.getByText('Saiu neste mês')).toBeTruthy();
    expect(screen.getByText('Provável')).toBeTruthy();
    expect(screen.getByText(/a menos que a nota/)).toBeTruthy();
  });
});
