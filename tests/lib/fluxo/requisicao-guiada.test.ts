import { describe, expect, it } from 'vitest';
import { PERGUNTAS_GUIADAS, montarRequisicao, pendentes } from '@/lib/fluxo/requisicao-guiada';

describe('modo guiado do Fluxo', () => {
  it('monta título e texto só com o que foi respondido, na ordem das perguntas', () => {
    const r = montarRequisicao({
      oQue: '  notebook i5,   16 GB ',
      tipo: 'Material',
      quantidade: '40 unidades',
      prazo: 'Em até 15 dias',
      entrega: 'Comercial, sede',
      justificativa: '',
    });
    expect(r.titulo).toBe('40 unidades de notebook i5, 16 GB');
    expect(r.requisicao).toBe(
      'Tipo: Material\nItem ou serviço: notebook i5, 16 GB\nQuantidade: 40 unidades\nPrazo desejado: Em até 15 dias\nÁrea solicitante e local de entrega: Comercial, sede',
    );
  });

  it('aponta as obrigatórias que faltam', () => {
    expect(pendentes({ tipo: 'Serviço', oQue: 'limpeza' }).map((p) => p.campo)).toEqual(['quantidade', 'prazo', 'entrega']);
  });

  it('o texto montado passa no mínimo da API (10 caracteres)', () => {
    const r = montarRequisicao({ tipo: 'Material', oQue: 'caneta', quantidade: '10', prazo: 'Sem pressa', entrega: 'RH' });
    expect(r.requisicao.length).toBeGreaterThanOrEqual(10);
  });

  it('pelo menos metade das perguntas é opcional ou tem resposta rápida (menos digitação)', () => {
    const faceis = PERGUNTAS_GUIADAS.filter((p) => !p.obrigatoria || p.opcoes?.length).length;
    expect(faceis).toBeGreaterThanOrEqual(PERGUNTAS_GUIADAS.length / 2);
  });
});
