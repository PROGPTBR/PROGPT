import { describe, it, expect, beforeEach, vi } from 'vitest';

// Backlog do diretor (2026-08-19, Batch I) — GET /api/assistants/runs/[id]/eml.
// A mensagem sai com o .docx do run já anexado, owner-gated como as rotas
// irmãs docx/xlsx.

beforeEach(() => {
  vi.resetModules();
});

const DONE_RUN = {
  id: 'run-12345678',
  assistant_type: 'rfp',
  status: 'done',
  output_md: '# RFQ Embalagens\n\n**Escopo**: filmes laminados.\n\nDetalhes aqui.',
  params: {},
};

function mockBase(opts: {
  user?: { id: string } | null;
  run?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
} = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi
      .fn()
      .mockResolvedValue('user' in opts ? opts.user : { id: 'u1' }),
  }));
  const getRunForOwner = vi
    .fn()
    .mockResolvedValue(opts.run === null ? null : (opts.run ?? DONE_RUN));
  vi.doMock('@/lib/assistants/runs', () => ({ getRunForOwner }));
  const buildRunDocx = vi.fn().mockResolvedValue({
    buffer: Buffer.from('PK-fake-docx-bytes'),
    filename: 'rfp-run-1234.docx',
    title: 'RFQ Embalagens Flexíveis',
  });
  vi.doMock('@/lib/assistants/run-docx', () => ({ buildRunDocx }));
  vi.doMock('@/lib/db/user-company', () => ({
    getUserCompany: vi.fn().mockResolvedValue(
      opts.company === undefined
        ? { company_name: 'ACME S.A.', company_email: 'compras@acme.com.br' }
        : opts.company,
    ),
  }));
  return { getRunForOwner, buildRunDocx };
}

function makeReq(query = ''): Request {
  return new Request(`http://localhost/api/assistants/runs/run-12345678/eml${query}`);
}

async function callRoute(query = '') {
  const mod = await import('@/app/api/assistants/runs/[id]/eml/route');
  return mod.GET(makeReq(query), { params: { id: 'run-12345678' } });
}

describe('GET /api/assistants/runs/[id]/eml', () => {
  it('returns 401 when there is no session', async () => {
    mockBase({ user: null });
    expect((await callRoute()).status).toBe(401);
  });

  it('returns 404 (not 403) when the run belongs to someone else', async () => {
    mockBase({ run: null });
    expect((await callRoute()).status).toBe(404);
  });

  it('returns 409 while the run has no output yet', async () => {
    mockBase({ run: { ...DONE_RUN, status: 'running', output_md: null } });
    const res = await callRoute();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: 'not_ready' });
  });

  it('serves an .eml attachment with the docx inside', async () => {
    const { buildRunDocx } = mockBase();
    const res = await callRoute();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('message/rfc822');
    expect(res.headers.get('Content-Disposition')).toContain('rfp-run-1234.eml');
    expect(buildRunDocx).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'run-12345678' }),
      'u1',
    );

    const body = await res.text();
    expect(body).toContain('X-Unsent: 1');
    expect(body).toContain('multipart/mixed');
    expect(body).toContain('filename="rfp-run-1234.docx"');
    expect(body).toContain(Buffer.from('PK-fake-docx-bytes').toString('base64'));
    // O corpo é carta de encaminhamento — o documento vai no anexo.
    expect(body).toContain('em anexo');
  });

  it('keeps only well-formed recipients from ?to', async () => {
    mockBase();
    const res = await callRoute('?to=a%40x.com,nao-e-email,b%40y.com');
    const body = await res.text();
    expect(body).toContain('To: a@x.com, b@y.com');
    expect(body).not.toContain('nao-e-email');
  });

  it('omits the To header when no recipient was passed', async () => {
    mockBase();
    expect(await (await callRoute()).text()).not.toContain('To:');
  });
});

describe('buildBodyText', () => {
  it('names the attachment and signs with the buyer company', async () => {
    mockBase();
    const { buildBodyText } = await import(
      '@/app/api/assistants/runs/[id]/eml/route'
    );
    const out = buildBodyText('RFQ Embalagens', 'Resumo do documento.', {
      companyName: 'ACME S.A.',
      companyEmail: 'compras@acme.com.br',
      filename: 'rfp-1234.docx',
    });
    expect(out).toContain('"RFQ Embalagens"');
    expect(out).toContain('rfp-1234.docx');
    expect(out).toContain('Resumo do documento.');
    expect(out).toContain('ACME S.A.');
    expect(out).toContain('compras@acme.com.br');
  });

  it('truncates a long document and points to the attachment', async () => {
    mockBase();
    const { buildBodyText } = await import(
      '@/app/api/assistants/runs/[id]/eml/route'
    );
    const out = buildBodyText('T', 'x'.repeat(5000), {
      companyName: null,
      companyEmail: null,
      filename: 'f.docx',
    });
    expect(out).toContain('[...] O documento completo está no anexo.');
    expect(out.length).toBeLessThan(2000);
  });
});
