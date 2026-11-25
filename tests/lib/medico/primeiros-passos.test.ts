import { describe, expect, it } from 'vitest';

import { estadoDeExemplo } from '@/lib/medico/exemplo';
import { aConfirmar, pagamentosRecentes, primeirosPassos } from '@/lib/medico/primeiros-passos';
import { CONFIG_VAZIA } from '@/lib/medico/types';

const HOJE = '2026-11-24';

describe('primeiros passos', () => {
  it('conta nova: nada feito; os passos apontam para a tela certa', () => {
    const passos = primeirosPassos({ config: CONFIG_VAZIA, hospitais: [], cirurgias: [], demonstrativos: [], entradas: [], conta: null, movimentos: [], documentos: [], indicacoes: [] });
    expect(passos.map((p) => p.feito)).toEqual([false, false, false, false, false]);
    expect(passos.map((p) => p.destino)).toEqual(['cadastros', 'cadastros', 'integracoes', 'agenda', 'demonstrativos']);
  });

  it('o exemplo não conta como passo feito (é fictício), mas o cadastro do médico conta', () => {
    const estado = estadoDeExemplo(HOJE);
    const passos = primeirosPassos(estado);
    expect(passos.find((p) => p.id === 'hospitais')!.feito).toBe(false);
    expect(passos.find((p) => p.id === 'contador')!.feito).toBe(true);
    expect(passos.find((p) => p.id === 'contato')!.feito).toBe(false);
  });

  it('cirurgia marcada pela agenda pede confirmação depois da data; pagamento recente aparece por 7 dias', () => {
    const estado = estadoDeExemplo(HOJE);
    const marcada = { ...estado.cirurgias[0]!, id: 'x', data: '2026-11-23', confirmar: true };
    const futura = { ...marcada, id: 'y', data: '2026-11-30' };
    const antiga = { ...marcada, id: 'z', data: '2026-11-01', confirmar: false };
    expect(aConfirmar([marcada, futura, antiga], HOJE).map((c) => c.id)).toEqual(['x']);

    const recentes = pagamentosRecentes(estado.demonstrativos, HOJE);
    expect(recentes.every((d) => d.pago_em! >= '2026-11-17')).toBe(true);
    expect(pagamentosRecentes([{ ...estado.demonstrativos[0]!, pago_em: '2026-10-01' }], HOJE)).toEqual([]);
  });
});
