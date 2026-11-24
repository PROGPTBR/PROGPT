import { afterEach, describe, expect, it, vi } from 'vitest';

import { avisoDoDia } from '@/lib/medico/aviso-texto';
import { etapaDe } from '@/lib/medico/conciliacao';
import { instanciaDoMedico, numeroLimpo, textoDaMensagem, userIdDaInstancia } from '@/lib/medico/evolution';
import { lerExtrato, sugerirPagamentos } from '@/lib/medico/extrato';
import { cobrancaAoPaciente, pedidoDeNotaDireto } from '@/lib/medico/mensagens';
import { CONFIG_VAZIA, type Cirurgia, type Demonstrativo, type Hospital } from '@/lib/medico/types';

vi.mock('@/lib/auth', () => ({ getProfile: vi.fn(async () => null) }));
vi.mock('@/lib/db/supabase', () => ({ getServerSupabase: vi.fn() }));

const HOJE = '2026-11-24';
const UID = '5efba61c-6b36-49d1-b443-b235b003ad54';
const H: Hospital = { id: 'h1', nome: 'Hospital Itaipu', email: 'fin@itaipu.com', prazo_pagamento_dias: 30, exemplo: false };

function dem(extra: Partial<Demonstrativo> = {}): Demonstrativo {
  return { id: 'd1', hospital_id: 'h1', referencia: '', recebido_em: '2026-11-01', valor_total: 5000, itens: [], nota_pedida_em: '2026-11-02', nota_numero: '77', nota_emitida_em: '2026-11-03', nota_enviada_em: '2026-11-03', pago_em: null, valor_pago: null, exemplo: false, tipo: 'hospital', pagador_nome: '', pagador_documento: '', pagador_contato: '', ...extra };
}

afterEach(() => vi.unstubAllEnvs());

describe('WhatsApp (Evolution)', () => {
  it('a instância do médico leva o id dele e só ela é reconhecida', () => {
    const inst = instanciaDoMedico(UID);
    expect(inst).toBe('medico-5efba61c6b3649d1b443b235b003ad54');
    expect(userIdDaInstancia(inst)).toBe(UID);
    // Instâncias de outros sistemas no mesmo servidor não são da Área Médica.
    expect(userIdDaInstancia('conexao')).toBeNull();
    expect(userIdDaInstancia('corretor-5efba61c-6b36-49d1-b443-b235b003ad54')).toBeNull();
  });

  it('limpa o número e põe o 55', () => {
    expect(numeroLimpo('(21) 99979-2912')).toBe('5521999792912');
    expect(numeroLimpo('+55 21 99979-2912')).toBe('5521999792912');
    expect(numeroLimpo('paciente@email.com')).toBeNull();
    expect(numeroLimpo('')).toBeNull();
  });

  it('lê o texto das formas de mensagem e ignora o que não é texto', () => {
    expect(textoDaMensagem({ message: { conversation: ' feita hoje ' } })).toBe('feita hoje');
    expect(textoDaMensagem({ message: { extendedTextMessage: { text: 'hérnia ok' } } })).toBe('hérnia ok');
    expect(textoDaMensagem({ message: { imageMessage: { caption: 'foto da ficha' } } })).toBe('foto da ficha');
    expect(textoDaMensagem({ message: { audioMessage: {} } })).toBe('');
    expect(textoDaMensagem({})).toBe('');
  });
});

describe('e-mail de entrada', () => {
  it('o endereço do médico leva o id dele e é reconhecido na volta', async () => {
    vi.stubEnv('RESEND_INBOUND_DOMAIN', 'entrada.exemplo.com');
    const { aliasDoMedico, userIdDoAliasMedico } = await import('@/lib/medico/integracoes');
    const alias = aliasDoMedico(UID)!;
    expect(alias).toBe('medico-5efba61c6b3649d1b443b235b003ad54@entrada.exemplo.com');
    expect(userIdDoAliasMedico(['outro@x.com', `Dr <${alias.toUpperCase()}>`])).toBe(UID);
    expect(userIdDoAliasMedico(['proc2pay-5efba61c6b3649d1b443b235b003ad54@entrada.exemplo.com'])).toBeNull();
    expect(userIdDoAliasMedico(undefined)).toBeNull();
  });
});

describe('cobrança direta', () => {
  const d = dem({ tipo: 'direto', valor_total: 1800, pagador_nome: 'Carla Souza', pagador_documento: '123.456.789-09', pagador_contato: '21999990000', nota_numero: '90', itens: [{ data: '2026-11-24', paciente: 'C. S.', procedimento: 'Anestesia para cesariana', convenio: 'Particular', valor: 1800, cirurgia_id: 'c1' }] });
  const config = { ...CONFIG_VAZIA, medico_nome: 'Dra. Ana', contador_email: 'c@c.com', chave_pix: 'ana@pix.com' };

  it('o pedido de nota leva o tomador; a cobrança leva o valor e o Pix', () => {
    const pedido = pedidoDeNotaDireto(d, H, config);
    expect(pedido.para).toBe('c@c.com');
    expect(pedido.corpo).toContain('Tomador: Carla Souza');
    expect(pedido.corpo).toContain('123.456.789-09');
    const cobranca = cobrancaAoPaciente(d, config);
    expect(cobranca.para).toBe('21999990000');
    expect(cobranca.corpo).toContain('Pix: ana@pix.com');
    expect(cobranca.corpo).toContain('R$');
    for (const t of [pedido.corpo, cobranca.corpo]) expect(t).not.toMatch(/[—–]/);
  });
});

describe('aviso diário', () => {
  const cirurgia: Cirurgia = { id: 'c1', hospital_id: 'h1', data: '2026-09-01', paciente: 'Maria Teste', procedimento: 'X', convenio: '', valor: 100, origem: 'manual', demonstrativo_id: null, cobrada_em: null, funcao: '', registro: '', cobrancas: [], observacao: '', exemplo: false };
  const base = { config: { ...CONFIG_VAZIA, medico_nome: 'Dr. Teste' }, hospitais: [H], cirurgias: [] as Cirurgia[], demonstrativos: [] as Demonstrativo[], entradas: [], conta: null, movimentos: [] };

  it('dia sem pendência não gera mensagem', () => {
    expect(avisoDoDia(base, HOJE, 'https://x/area-medica')).toBeNull();
  });

  it('resume o que está parado, com o link, sem nome de paciente', () => {
    const aviso = avisoDoDia(
      {
        ...base,
        cirurgias: [cirurgia],
        demonstrativos: [dem({ tipo: 'direto', pagador_nome: 'Carla Souza', nota_enviada_em: '2026-11-10' })],
        entradas: [{ id: 'e', canal: 'whatsapp', remetente: '', assunto: '', texto: 't', recebido_em: '2026-11-24T10:00:00Z' }],
      },
      HOJE,
      'https://x/area-medica',
    )!;
    expect(aviso.assunto).toContain('3 pendências');
    expect(aviso.texto).toContain('Dr. Teste');
    expect(aviso.texto).toContain('1 cirurgia feita e não paga');
    expect(aviso.texto).toContain('Cobrança direta: pagamento atrasado');
    expect(aviso.texto).toContain('1 mensagem nova no grupo');
    expect(aviso.texto).toContain('https://x/area-medica');
    expect(aviso.texto).not.toContain('Maria');
    expect(aviso.texto).not.toContain('Carla');
    expect(aviso.texto).not.toMatch(/[—–]/);
  });
});

describe('conferência do extrato', () => {
  const OFX = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261120120000[-3:BRT]<TRNAMT>4350.00<MEMO>TED RECEBIDA HOSPITAL ITAIPU SA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261121<TRNAMT>-200.00<MEMO>TARIFA</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261122<TRNAMT>1800,00<MEMO>PIX RECEBIDO CARLA SOUZA</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261015<TRNAMT>5000.00<MEMO>PIX RECEBIDO OUTRA PESSOA</STMTTRN>
</BANKTRANLIST></OFX>`;

  it('lê só os créditos do OFX e do CSV', () => {
    expect(lerExtrato(OFX).map((c) => [c.data, c.valor])).toEqual([
      ['2026-11-20', 4350],
      ['2026-11-22', 1800],
      ['2026-10-15', 5000],
    ]);
    const csv = 'Data;Histórico;Valor;Saldo\n20/11/2026;TED RECEBIDA HOSPITAL ITAIPU;4.350,00;10.000,00\n21/11/2026;TARIFA;-200,00;9.800,00';
    expect(lerExtrato(csv)).toEqual([{ data: '2026-11-20', valor: 4350, descricao: 'TED RECEBIDA HOSPITAL ITAIPU' }]);
  });

  it('acha o pagamento com valor igual e o com retenção quando o extrato cita quem pagou', () => {
    const direto = dem({ id: 'd2', tipo: 'direto', valor_total: 1800, pagador_nome: 'Carla Souza', nota_emitida_em: '2026-11-21', nota_enviada_em: '2026-11-21' });
    const pago = dem({ id: 'd3', pago_em: '2026-11-05' });
    const s = sugerirPagamentos(lerExtrato(OFX), [dem(), direto, pago], [H]);
    expect(etapaDe(pago)).toBe('pago');
    expect(s.map((x) => [x.demonstrativo_id, x.confianca, x.credito.valor, x.diferenca])).toEqual([
      ['d2', 'certa', 1800, 0],
      // 5000 de outra pessoa em 15/10 é anterior à nota: não serve. Fica o do hospital, com R$ 650 retidos.
      ['d1', 'provavel', 4350, 650],
    ]);
  });
});
