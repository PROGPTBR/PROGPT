import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

// Fluxo de Compras, Fase 1 (sub-projeto 90): acompanhamento pelo solicitante
// e aprovação do gestor por e-mail. Mesmo fake com estado do process.test.ts,
// com as tabelas novas.
type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

function makeDb(store: Store) {
  return {
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: { id, email: 'comprador@empresa.com' } }, error: null }),
      },
    },
    from(nome: string) {
      const tabela = (store[nome] ??= []);
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
        return tabela.filter((r) => filtros.every(([c, v]) => r[c] === v));
      }

      function resolver(single: boolean): { data: unknown; error: null } {
        if (modo === 'insert') {
          const novo = {
            id: `${nome}-${tabela.length + 1}`,
            status: 'pendente',
            expira_em: new Date(Date.now() + 86_400_000).toISOString(),
            created_at: new Date().toISOString(),
            ...payload,
          };
          tabela.push(novo);
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

function setup() {
  const store: Store = {
    fluxo_processos: [
      {
        id: 'p1',
        user_id: 'u1',
        titulo: 'Compra de notebooks',
        requisicao: '10 notebooks para o time de TI',
        etapa_atual: 'solicitacao',
        status: 'em_andamento',
        contexto: {},
        acompanhamento_token: 'tok-acompanhamento-0123456789',
        solicitante_nome: 'Ana',
        solicitante_email: 'ana@empresa.com',
        created_at: '2026-10-01T12:00:00Z',
        updated_at: '2026-10-01T12:00:00Z',
      },
    ],
    fluxo_etapas: [],
    fluxo_aprovacoes: [],
    profiles: [{ id: 'u1', full_name: 'Carla Compras' }],
  };

  vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: () => makeDb(store) }));
  vi.doMock('@/lib/fluxo/executor', () => ({
    executarEtapa: vi.fn().mockResolvedValue({
      resumo: 'Requisição padronizada: 10 notebooks, R$ 48.000.',
      campos: [{ rotulo: 'Valor', valor: 'R$ 48.000' }],
      itens: [],
      pontos_de_revisao: [],
      alertas: [],
      saida: 'Requisição pronta para aprovação.',
    }),
  }));
  const sendEmail = vi.fn().mockResolvedValue({ ok: true });
  vi.doMock('@/lib/email/client', () => ({ sendEmail, getAppUrl: () => 'https://progpt.com.br' }));

  return { store, sendEmail };
}

async function rodar() {
  const { rodarEtapa } = await import('@/lib/fluxo/process');
  await rodarEtapa({ userId: 'u1', processoId: 'p1' });
}

describe('montarAcompanhamento (o que o solicitante vê)', () => {
  it('mostra o andamento sem preço, proposta nem resumo da IA', async () => {
    setup();
    await rodar();
    const { getAcompanhamentoPorToken } = await import('@/lib/fluxo/acompanhamento');
    const a = await getAcompanhamentoPorToken('tok-acompanhamento-0123456789');

    expect(a).not.toBeNull();
    expect(a!.etapas).toHaveLength(8);
    expect(a!.etapas[0]!.estado).toBe('atual');
    expect(a!.etapas[1]!.estado).toBe('futura');
    expect(a!.aguardando).toBe('Em revisão pelo time de compras.');
    // O valor da compra aparece na saída da IA; não pode aparecer no link público.
    expect(JSON.stringify(a)).not.toContain('48.000');
  });

  it('token desconhecido devolve null', async () => {
    setup();
    const { getAcompanhamentoPorToken } = await import('@/lib/fluxo/acompanhamento');
    expect(await getAcompanhamentoPorToken('nao-existe-mas-tem-tamanho')).toBeNull();
    expect(await getAcompanhamentoPorToken('curto')).toBeNull();
  });
});

describe('aviso ao solicitante', () => {
  it('SIGA envia e-mail para quem pediu a compra, com o link de acompanhamento', async () => {
    const { sendEmail } = setup();
    await rodar();
    const { decidirEtapa } = await import('@/lib/fluxo/process');
    await decidirEtapa({ userId: 'u1', processoId: 'p1', decisao: 'siga' });
    await new Promise((r) => setTimeout(r, 0));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0]![0] as { to: string; subject: string; html: string };
    expect(arg.to).toBe('ana@empresa.com');
    expect(arg.subject).toContain('avançou');
    expect(arg.html).toContain('/acompanhar/tok-acompanhamento-0123456789');
  });

  it('AJUSTAR não avisa o solicitante (é ajuste interno)', async () => {
    const { sendEmail } = setup();
    await rodar();
    const { decidirEtapa } = await import('@/lib/fluxo/process');
    await decidirEtapa({ userId: 'u1', processoId: 'p1', decisao: 'ajustar', observacao: 'refazer' });
    await new Promise((r) => setTimeout(r, 0));
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('aprovação do gestor por e-mail', () => {
  it('sem etapa executada não há o que aprovar', async () => {
    setup();
    const { pedirAprovacao } = await import('@/lib/fluxo/acompanhamento');
    const r = await pedirAprovacao({ userId: 'u1', processoId: 'p1', aprovadorNome: 'Gil', aprovadorEmail: 'gil@empresa.com' });
    expect(r).toEqual({ ok: false, reason: 'sem_pendencia' });
  });

  it('recusa e-mail inválido e processo de outro usuário', async () => {
    setup();
    await rodar();
    const { pedirAprovacao } = await import('@/lib/fluxo/acompanhamento');
    expect(
      await pedirAprovacao({ userId: 'u1', processoId: 'p1', aprovadorNome: '', aprovadorEmail: 'gil' }),
    ).toEqual({ ok: false, reason: 'email_invalido' });
    expect(
      await pedirAprovacao({ userId: 'intruso', processoId: 'p1', aprovadorNome: '', aprovadorEmail: 'gil@empresa.com' }),
    ).toEqual({ ok: false, reason: 'nao_encontrado' });
  });

  it('aprovar pelo link avança a etapa, registra quem aprovou e não deixa usar de novo', async () => {
    const { store, sendEmail } = setup();
    await rodar();
    const { pedirAprovacao, decidirAprovacao } = await import('@/lib/fluxo/acompanhamento');

    const pedido = await pedirAprovacao({ userId: 'u1', processoId: 'p1', aprovadorNome: 'Gil Gestor', aprovadorEmail: 'Gil@Empresa.com' });
    expect(pedido.ok).toBe(true);
    // O token vai só no e-mail do gestor, nunca na resposta para o comprador.
    expect(JSON.stringify(pedido)).not.toContain('"token"');
    const emailGestor = sendEmail.mock.calls[0]![0] as { to: string; html: string };
    expect(emailGestor.to).toBe('gil@empresa.com');

    const token = store.fluxo_aprovacoes![0]!.token as string;
    expect(emailGestor.html).toContain(`/aprovar/${token}`);

    const r = await decidirAprovacao({ token, aprovado: true });
    expect(r).toEqual({ ok: true, aprovado: true });
    expect(store.fluxo_processos![0]!.etapa_atual).toBe('aprovacao');
    expect(store.fluxo_etapas![0]!.observacao).toContain('Aprovado por Gil Gestor');
    expect(store.fluxo_aprovacoes![0]!.status).toBe('aprovado');

    const deNovo = await decidirAprovacao({ token, aprovado: true });
    expect(deNovo).toMatchObject({ ok: false, reason: 'indisponivel', estado: 'aprovado' });
  });

  it('reprovar exige motivo e devolve a etapa para ajuste', async () => {
    const { store } = setup();
    await rodar();
    const { pedirAprovacao, decidirAprovacao } = await import('@/lib/fluxo/acompanhamento');
    await pedirAprovacao({ userId: 'u1', processoId: 'p1', aprovadorNome: 'Gil', aprovadorEmail: 'gil@empresa.com' });
    const token = store.fluxo_aprovacoes![0]!.token as string;

    expect(await decidirAprovacao({ token, aprovado: false, comentario: '  ' })).toEqual({ ok: false, reason: 'sem_motivo' });

    const r = await decidirAprovacao({ token, aprovado: false, comentario: 'Orçamento acima do previsto.' });
    expect(r).toEqual({ ok: true, aprovado: false });
    expect(store.fluxo_processos![0]!.etapa_atual).toBe('solicitacao');
    expect(store.fluxo_etapas![0]!.decisao).toBe('ajustar');
    expect(store.fluxo_etapas![0]!.observacao).toContain('Orçamento acima do previsto.');
  });

  it('pedido novo substitui o anterior; o link antigo deixa de valer', async () => {
    const { store } = setup();
    await rodar();
    const { pedirAprovacao, decidirAprovacao } = await import('@/lib/fluxo/acompanhamento');
    await pedirAprovacao({ userId: 'u1', processoId: 'p1', aprovadorNome: 'A', aprovadorEmail: 'a@empresa.com' });
    await pedirAprovacao({ userId: 'u1', processoId: 'p1', aprovadorNome: 'B', aprovadorEmail: 'b@empresa.com' });

    const [antigo, novo] = store.fluxo_aprovacoes!;
    expect(antigo!.status).toBe('cancelado');
    expect(novo!.status).toBe('pendente');
    expect(await decidirAprovacao({ token: antigo!.token as string, aprovado: true })).toMatchObject({
      ok: false,
      reason: 'indisponivel',
    });
  });
});

describe('estadoDaAprovacao', () => {
  it('vencido, superado e pendente', async () => {
    const { estadoDaAprovacao } = await import('@/lib/fluxo/acompanhamento');
    const agora = new Date('2026-10-22T12:00:00Z');
    expect(estadoDaAprovacao({ status: 'pendente', expira_em: '2026-10-21T00:00:00Z' }, { decisao: 'pendente' }, agora)).toBe('expirado');
    expect(estadoDaAprovacao({ status: 'pendente', expira_em: '2026-10-30T00:00:00Z' }, { decisao: 'siga' }, agora)).toBe('superado');
    expect(estadoDaAprovacao({ status: 'pendente', expira_em: '2026-10-30T00:00:00Z' }, null, agora)).toBe('superado');
    expect(estadoDaAprovacao({ status: 'pendente', expira_em: '2026-10-30T00:00:00Z' }, { decisao: 'pendente' }, agora)).toBe('pendente');
    expect(estadoDaAprovacao({ status: 'cancelado', expira_em: '2026-10-30T00:00:00Z' }, { decisao: 'pendente' }, agora)).toBe('cancelado');
  });
});

describe('e-mails do Fluxo', () => {
  it('escapam o que o cliente digitou e não têm travessão', async () => {
    const { buildFluxoAprovacaoEmail, buildFluxoAndamentoEmail, buildFluxoDecisaoGestorEmail } = await import(
      '@/lib/email/templates'
    );
    const malicioso = '<script>alert(1)</script>';
    const emails = [
      buildFluxoAprovacaoEmail({
        aprovadorNome: malicioso,
        compradorNome: malicioso,
        tituloCompra: malicioso,
        etapaLabel: 'Aprovação da Solicitação',
        resumo: malicioso,
        link: 'https://progpt.com.br/aprovar/x',
        expiraEm: '05/11/2026',
      }),
      buildFluxoAndamentoEmail({ solicitanteNome: malicioso, tituloCompra: malicioso, link: 'https://x', etapaConcluida: malicioso }),
      buildFluxoDecisaoGestorEmail({
        aprovadorNome: malicioso,
        aprovadorEmail: 'g@e.com',
        tituloCompra: malicioso,
        etapaLabel: 'x',
        aprovado: false,
        comentario: malicioso,
        link: 'https://x',
      }),
    ];
    for (const e of emails) {
      expect(e.html).not.toContain('<script>');
      expect(e.html).toContain('&lt;script&gt;');
      expect(e.html).not.toMatch(/[—–]/);
    }
  });
});
