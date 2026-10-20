import { describe, expect, it } from 'vitest';
import { fluxoLiberado } from '@/lib/fluxo/acesso';
import { EXEMPLO_ENTRADAS, EXEMPLO_SAIDAS } from '@/lib/fluxo/exemplo';
import { FLUXO_STAGES } from '@/lib/fluxo/stages';
import { FluxoStageOutputSchema } from '@/lib/fluxo/types';

describe('Fluxo sob demanda', () => {
  it('Alexandre e super admins usam de verdade; os demais veem a vitrine', () => {
    expect(fluxoLiberado('Alexandre@B2Supply.com ')).toBe(true);
    expect(fluxoLiberado('cliente@empresa.com')).toBe(false);
    expect(fluxoLiberado('cliente@empresa.com', true)).toBe(true);
    expect(fluxoLiberado(null)).toBe(false);
  });

  it('o processo de exemplo tem entrada e resultado válidos para as 8 etapas, sem travessão', () => {
    for (const s of FLUXO_STAGES) {
      expect(EXEMPLO_ENTRADAS[s.id], s.id).toBeTruthy();
      expect(FluxoStageOutputSchema.safeParse(EXEMPLO_SAIDAS[s.id]).success, s.id).toBe(true);
      expect(JSON.stringify(EXEMPLO_SAIDAS[s.id]) + EXEMPLO_ENTRADAS[s.id]).not.toMatch(/[—–]/);
    }
  });
});
