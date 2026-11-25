import { describe, expect, it } from 'vitest';

import { destaques, mural, notasEmAndamento, topParaCobrar } from '@/lib/medico/cockpit';
import { estadoDeExemplo } from '@/lib/medico/exemplo';

const HOJE = '2026-11-24';

describe('cockpit', () => {
  const estado = estadoDeExemplo(HOJE);

  it('monta os destaques do que importa agora, com pouco texto e sem paciente', () => {
    const lista = destaques(estado, HOJE);
    expect(lista.map((d) => d.id)).toEqual(['receber', 'cobrar', 'fazer', 'recebido']);
    expect(lista[0]).toMatchObject({ selo: 'A receber', destino: 'demonstrativos' });
    expect(lista[1]).toMatchObject({ titulo: '2 cirurgias', destino: 'pendencias', tom: 'vermelho' });
    for (const d of lista) {
      expect(d.titulo.length).toBeLessThanOrEqual(40);
      expect(`${d.titulo} ${d.apoio}`).not.toMatch(/L\. M\. N\.|P\. H\. S\.|[—–]/);
    }
  });

  it('conta vazia mostra só o que há a receber (zero)', () => {
    const vazio = { ...estado, cirurgias: [], demonstrativos: [] };
    expect(destaques(vazio, HOJE).map((d) => d.id)).toEqual(['receber']);
  });

  it('mural: um cartaz por hospital, do que mais tem a receber para o que menos tem', () => {
    const cartazes = mural(estado, HOJE);
    expect(cartazes).toHaveLength(3);
    expect(cartazes.map((c) => c.aReceber)).toEqual([...cartazes.map((c) => c.aReceber)].sort((a, b) => b - a));
    expect(cartazes.find((c) => c.nome.includes('Or'))!.paraCobrar).toBe(2);
  });

  it('top para cobrar e notas em andamento não levam nome de paciente', () => {
    const top = topParaCobrar(estado, HOJE);
    expect(top).toHaveLength(2);
    expect(JSON.stringify(top)).not.toMatch(/L\. M\. N\.|P\. H\. S\./);
    expect(top[0]!.detalhe).toContain('cobrada 1x');
    const notas = notasEmAndamento(estado);
    expect(notas).toHaveLength(3);
    expect(notas.every((n) => n.passo >= 1 && n.passo <= 4)).toBe(true);
  });
});
