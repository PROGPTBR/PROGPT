import { describe, expect, it } from 'vitest';

import { cirurgiasDoDia, diaSeguinte, lembreteDaVespera, lerContatos, mesVizinho, semanasDoMes } from '@/lib/medico/agenda';
import { arquivoAceito } from '@/lib/medico/documentos';
import type { Cirurgia, Hospital } from '@/lib/medico/types';

import { vi } from 'vitest';
vi.mock('@/lib/db/supabase', () => ({ getServerSupabase: vi.fn() }));

const H: Hospital = { id: 'h1', nome: 'CHN', email: '', prazo_pagamento_dias: 30, exemplo: false };
function cir(id: string, data: string, hora: string, extra: Partial<Cirurgia> = {}): Cirurgia {
  return { id, hospital_id: 'h1', data, hora, paciente: 'Paciente Exemplo', procedimento: 'Sutura de menisco', convenio: '', valor: null, origem: 'manual', demonstrativo_id: null, cobrada_em: null, funcao: '1º Auxiliar', registro: '', cobrancas: [], observacao: '', exemplo: false, ...extra };
}

describe('agenda', () => {
  it('monta o mês em semanas de domingo a sábado', () => {
    const s = semanasDoMes('2026-11'); // 1º de novembro de 2026 é domingo
    expect(s[0]![0]).toBe('2026-11-01');
    expect(s.flat().filter(Boolean)).toHaveLength(30);
    expect(s.every((semana) => semana.length === 7)).toBe(true);
    const dez = semanasDoMes('2026-12'); // 1º de dezembro é terça
    expect(dez[0]!.slice(0, 3)).toEqual([null, null, '2026-12-01']);
    expect(mesVizinho('2026-12', 1)).toBe('2027-01');
    expect(mesVizinho('2026-01', -1)).toBe('2025-12');
    expect(diaSeguinte('2026-12-31')).toBe('2027-01-01');
  });

  it('ordena o dia pela hora, com as sem hora no fim', () => {
    const lista = cirurgiasDoDia([cir('a', '2026-11-25', '14:00'), cir('b', '2026-11-25', ''), cir('c', '2026-11-25', '07:30'), cir('d', '2026-11-26', '06:00')], '2026-11-25');
    expect(lista.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('o lembrete da véspera traz hora, hospital e procedimento, sem o paciente', () => {
    const l = lembreteDaVespera([cir('a', '2026-11-25', '07:30'), cir('b', '2026-11-25', '13:00', { procedimento: 'Fratura de fêmur' }), cir('c', '2026-11-27', '08:00')], [H], '2026-11-24', 'Dr. Teste')!;
    expect(l.assunto).toBe('Agenda de amanhã: 2 cirurgias');
    expect(l.texto).toContain('25/11/2026');
    expect(l.texto).toContain('• 07:30, CHN, Sutura de menisco, 1º Auxiliar');
    expect(l.texto.indexOf('07:30')).toBeLessThan(l.texto.indexOf('13:00'));
    expect(l.texto).not.toContain('Paciente Exemplo');
    expect(l.texto).not.toMatch(/[—–]/);
    expect(lembreteDaVespera([cir('c', '2026-11-27', '08:00')], [H], '2026-11-24', '')).toBeNull();
  });
});

describe('lista de contatos para indicar', () => {
  it('lê nome e WhatsApp ou e-mail de várias formas e não repete', () => {
    const lista = lerContatos(`Dra. Marina Lopes, (21) 99999-0000
Dr. Paulo Reis; paulo@clinica.com.br
João Silva\t21988887777
Marina de novo - 21 99999-0000
linha sem contato
+55 21 97777-6666`);
    expect(lista).toEqual([
      { nome: 'Dra. Marina Lopes', contato: '(21) 99999-0000' },
      { nome: 'Dr. Paulo Reis', contato: 'paulo@clinica.com.br' },
      { nome: 'João Silva', contato: '21988887777' },
    ]);
  });
});

describe('documentos', () => {
  it('aceita o que o médico guarda e recusa o resto', () => {
    expect(arquivoAceito('nota.pdf', 'application/pdf')).toBe(true);
    expect(arquivoAceito('foto.jpg', 'image/jpeg')).toBe(true);
    expect(arquivoAceito('nfe.xml', '')).toBe(true); // navegador sem tipo: vale a extensão
    expect(arquivoAceito('pendencias.xlsx', 'application/octet-stream')).toBe(true);
    expect(arquivoAceito('programa.exe', 'application/x-msdownload')).toBe(false);
    expect(arquivoAceito('pagina.html', 'text/html')).toBe(false);
  });
});
