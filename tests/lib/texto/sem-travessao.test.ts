import { describe, expect, it } from 'vitest';
import { semTravessao, semTravessaoProfundo } from '@/lib/texto/sem-travessao';

describe('semTravessao', () => {
  it('troca o travessão entre frases por vírgula e o colado por hífen', () => {
    expect(semTravessao('Requer aprovação — fornecedor não homologado.')).toBe('Requer aprovação, fornecedor não homologado.');
    expect(semTravessao('Período 2025–2026')).toBe('Período 2025-2026');
    expect(semTravessao('- **Selic alta** — mais espaço para negociar')).toBe('- **Selic alta**, mais espaço para negociar');
  });

  it('não deixa travessão solto no começo ou no fim da linha', () => {
    expect(semTravessao('— Item sem valor\nTotal —')).toBe('Item sem valor\nTotal');
  });

  it('limpa todos os textos de um resultado estruturado, sem mexer em números', () => {
    const r = semTravessaoProfundo({ a: 'x — y', lista: ['p — q', 3], n: 7, sub: { t: 'z—w' } });
    expect(r).toEqual({ a: 'x, y', lista: ['p, q', 3], n: 7, sub: { t: 'z-w' } });
  });
});

describe('mimeDoArquivo (Excel do Windows chega sem tipo)', () => {
  it('reconhece pela extensão quando o tipo vem vazio ou genérico', async () => {
    const { mimeDoArquivo } = await import('@/lib/chat-attachments');
    expect(mimeDoArquivo('proposta.xlsx', '')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(mimeDoArquivo('PROPOSTA.PDF', 'application/octet-stream')).toBe('application/pdf');
    expect(mimeDoArquivo('foto.jpeg', '')).toBe('image/jpeg');
    expect(mimeDoArquivo('x.pdf', 'application/pdf')).toBe('application/pdf');
  });
});
