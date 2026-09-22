import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

// Fake com estado: reproduz o suficiente do supabase-js para exercitar a
// máquina de estados de verdade (SIGA avança, AJUSTAR não). Mais fiel que
// mockar cada retorno, e pega erro de ordem que mock estático não pegaria.
type Row = Record<string, unknown>;

function makeDb(store: { processos: Row[]; etapas: Row[] }) {
  function tabela(nome: string): Row[] {
    return nome === 'fluxo_processos' ? store.processos : store.etapas;
  }

  return {
    from(nome: string) {
      const filtros: Array<[string, unknown]> = [];
      let modo: 'select' | 'insert' | 'update' = 'select';
      let payload: Row = {};

      const q: Record<string, unknown> = {
        select: () => q,
        order: () => q,
        limit: () => q,
        insert: (p: Row) => {
          modo = 'insert';
          payload = p;
          return q;
        },
        update: (p: Row) => {
          modo = 'update';
          payload = p;
          return q;
        },
        eq: (col: string, val: unknown) => {
          filtros.push([col, val]);
          return q;
        },
        maybeSingle: () => resolver(true),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolver(false)).then(resolve),
      };

      function aplica(): Row[] {
        return tabela(nome).filter((r) => filtros.every(([c, v]) => r[c] === v));
      }

      function resolver(single: boolean): { data: unknown; error: null } {
        if (modo === 'insert') {
          const novo = { id: `id-${tabela(nome).length + 1}`, ...payload };
          tabela(nome).push(novo);
          return { data: single ? novo : [novo], error: null };
        }
        if (modo === 'update') {
          const alvos = aplica();
          alvos.forEach((r) => Object.assign(r, payload));
          return { data: single ? (alvos[0] ?? null) : alvos, error: null };
        }
        const achados = aplica();
        return { data: single ? (achados[0] ?? null) : achados, error: null };
      }

      return q;
    },
  };
}

function setup(opts: { etapaAtual?: string; contexto?: Row } = {}) {
  const store = {
    processos: [
      {
        id: 'p1',
        user_id: 'u1',
        titulo: 'Compra de notebooks',
        requisicao: '10 notebooks para o time de TI',
        etapa_atual: opts.etapaAtual ?? 'solicitacao',
        status: 'em_andamento',
        contexto: opts.contexto ?? {},
        created_at: 'agora',
        updated_at: 'agora',
      } as Row,
    ],
    etapas: [] as Row[],
  };

  vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: () => makeDb(store) }));

  const executarEtapa = vi.fn().mockResolvedValue({
    resumo: 'Etapa executada.',
    campos: [],
    itens: [],
    pontos_de_revisao: ['confira isto'],
    alertas: [],
    saida: 'Saída da etapa',
  });
  vi.doMock('@/lib/fluxo/executor', () => ({ executarEtapa }));

  return { store, executarEtapa };
}

describe('rodarEtapa', () => {
  it('deixa o resultado AGUARDANDO decisão — nunca avança sozinho', async () => {
    const { store } = setup();
    const { rodarEtapa } = await import('@/lib/fluxo/process');

    const r = await rodarEtapa({ userId: 'u1', processoId: 'p1' });

    expect(r.ok).toBe(true);
    expect(store.etapas[0]!.decisao).toBe('pendente');
    // O processo continua na mesma etapa: só o SIGA move.
    expect(store.processos[0]!.etapa_atual).toBe('solicitacao');
    expect(store.processos[0]!.contexto).toEqual({});
  });

  it('recusa rodar de novo enquanto houver execução aguardando decisão', async () => {
    setup();
    const { rodarEtapa } = await import('@/lib/fluxo/process');

    await rodarEtapa({ userId: 'u1', processoId: 'p1' });
    const segunda = await rodarEtapa({ userId: 'u1', processoId: 'p1' });

    expect(segunda).toEqual({ ok: false, reason: 'ja_pendente' });
  });

  it('não vaza processo de outro usuário', async () => {
    setup();
    const { rodarEtapa } = await import('@/lib/fluxo/process');

    expect(await rodarEtapa({ userId: 'intruso', processoId: 'p1' })).toEqual({
      ok: false,
      reason: 'nao_encontrado',
    });
  });

  it('entrega ao executor a correção do AJUSTAR anterior', async () => {
    const { executarEtapa } = setup();
    const { rodarEtapa, decidirEtapa } = await import('@/lib/fluxo/process');

    await rodarEtapa({ userId: 'u1', processoId: 'p1' });
    await decidirEtapa({
      userId: 'u1',
      processoId: 'p1',
      decisao: 'ajustar',
      observacao: 'Faltou o centro de custo.',
    });
    await rodarEtapa({ userId: 'u1', processoId: 'p1' });

    expect(executarEtapa).toHaveBeenLastCalledWith(
      expect.objectContaining({ ajuste: 'Faltou o centro de custo.' }),
    );
  });
});

describe('decidirEtapa', () => {
  it('SIGA grava a saída no contexto e move para a próxima etapa', async () => {
    const { store } = setup();
    const { rodarEtapa, decidirEtapa } = await import('@/lib/fluxo/process');

    await rodarEtapa({ userId: 'u1', processoId: 'p1' });
    const r = await decidirEtapa({ userId: 'u1', processoId: 'p1', decisao: 'siga' });

    expect(r.ok).toBe(true);
    expect(store.processos[0]!.etapa_atual).toBe('aprovacao');
    expect((store.processos[0]!.contexto as Row).solicitacao).toBeTruthy();
    expect(store.etapas[0]!.decisao).toBe('siga');
  });

  it('AJUSTAR NÃO avança o processo e não entra no contexto', async () => {
    const { store } = setup();
    const { rodarEtapa, decidirEtapa } = await import('@/lib/fluxo/process');

    await rodarEtapa({ userId: 'u1', processoId: 'p1' });
    await decidirEtapa({
      userId: 'u1',
      processoId: 'p1',
      decisao: 'ajustar',
      observacao: 'refazer',
    });

    expect(store.processos[0]!.etapa_atual).toBe('solicitacao');
    expect(store.processos[0]!.contexto).toEqual({});
  });

  it('AJUSTAR abre rodada nova da MESMA etapa, preservando o histórico', async () => {
    const { store } = setup();
    const { rodarEtapa, decidirEtapa } = await import('@/lib/fluxo/process');

    await rodarEtapa({ userId: 'u1', processoId: 'p1' });
    await decidirEtapa({ userId: 'u1', processoId: 'p1', decisao: 'ajustar', observacao: 'x' });
    await rodarEtapa({ userId: 'u1', processoId: 'p1' });

    expect(store.etapas).toHaveLength(2);
    expect(store.etapas.map((e) => e.rodada)).toEqual([1, 2]);
    expect(store.etapas.map((e) => e.etapa)).toEqual(['solicitacao', 'solicitacao']);
  });

  it('recusa decidir quando não há execução pendente', async () => {
    setup();
    const { decidirEtapa } = await import('@/lib/fluxo/process');

    expect(await decidirEtapa({ userId: 'u1', processoId: 'p1', decisao: 'siga' })).toEqual({
      ok: false,
      reason: 'sem_pendencia',
    });
  });

  it('o SIGA da última etapa conclui o processo', async () => {
    const { store } = setup({ etapaAtual: 'recebimento' });
    const { rodarEtapa, decidirEtapa } = await import('@/lib/fluxo/process');

    await rodarEtapa({ userId: 'u1', processoId: 'p1' });
    const r = await decidirEtapa({ userId: 'u1', processoId: 'p1', decisao: 'siga' });

    expect(r).toMatchObject({ ok: true, concluido: true });
    expect(store.processos[0]!.status).toBe('concluido');
  });

  it('processo encerrado não roda mais etapa', async () => {
    const { store } = setup({ etapaAtual: 'recebimento' });
    store.processos[0]!.status = 'concluido';
    const { rodarEtapa } = await import('@/lib/fluxo/process');

    expect(await rodarEtapa({ userId: 'u1', processoId: 'p1' })).toEqual({
      ok: false,
      reason: 'encerrado',
    });
  });
});
