import { describe, expect, it } from 'vitest';
import {
  buildProfilePrompt,
  PROFILE_SYSTEM_PROMPT,
} from '@/lib/assistants/profile';
import {
  ProfileParamsSchema,
  type ProfileParams,
  type TemplateRow,
} from '@/lib/assistants/types';

const TEMPLATE: TemplateRow = {
  id: 't1',
  assistant_type: 'profile',
  name: 'Template padrão',
  description: 'Default',
  body_md: '# Perfil — {{categoria}}\n\nPrioridade: {{prioridade}}',
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function fullParams(): ProfileParams {
  return ProfileParamsSchema.parse({
    nomeCategoria: 'Embalagens flexíveis',
    descricao: 'Filmes e laminados para embalagem primária e secundária.',
    subSegmentos: ['filmes laminados', 'sachets stand-up', 'rótulos'],
    escopoIncluido: 'Filmes mono e multicamada, rótulos termocontráteis.',
    escopoNaoIncluido: 'Caixas de papelão (categoria à parte).',
    spendAnualBRL: 5_000_000,
    volumeFisico: '12000 ton/ano',
    numeroFornecedoresAtivos: 6,
    sazonalidade: 'pico em Q4',
    requisitosTecnicos:
      'ABNT NBR 14937, espessura 80μm ±5%, resistência à tração 25 MPa.',
    restricoesRegulatorias: 'ANVISA RDC 91/2001 (contato direto com alimentos).',
    criteriosAvaliacao: [
      'Qualidade certificada',
      'Prazo de entrega ≤ 15 dias',
      'Preço por kg',
    ],
    stakeholders: [
      { nome: 'Gerente de Produção', papel: 'usuario' },
      { nome: 'Diretor de Compras', papel: 'aprovador' },
      { nome: 'Engenheiro de Qualidade', papel: 'operacao' },
    ],
    prioridadeEstrategica: 'qualidade',
    observacoes: 'Trocar fornecedor X exige homologação de 90 dias.',
  });
}

describe('ProfileParamsSchema', () => {
  it('rejects empty subSegmentos', () => {
    const res = ProfileParamsSchema.safeParse({
      ...fullParams(),
      subSegmentos: [],
    });
    expect(res.success).toBe(false);
  });

  it('rejects empty stakeholders', () => {
    const res = ProfileParamsSchema.safeParse({
      ...fullParams(),
      stakeholders: [],
    });
    expect(res.success).toBe(false);
  });

  it('rejects unknown prioridadeEstrategica', () => {
    const res = ProfileParamsSchema.safeParse({
      ...fullParams(),
      prioridadeEstrategica: 'velocidade' as never,
    });
    expect(res.success).toBe(false);
  });

  it('accepts optional spendAnualBRL absent', () => {
    const { spendAnualBRL, ...rest } = fullParams();
    void spendAnualBRL;
    const res = ProfileParamsSchema.safeParse(rest);
    expect(res.success).toBe(true);
  });

  it('accepts optional perfilId as UUID', () => {
    const res = ProfileParamsSchema.safeParse({
      ...fullParams(),
      perfilId: 'a8c8eb1c-1234-4def-8abc-1234567890ab',
    });
    expect(res.success).toBe(true);
  });
});

describe('buildProfilePrompt', () => {
  it('injects all 15 fields into the user prompt', () => {
    const params = fullParams();
    const { system, user } = buildProfilePrompt(params, TEMPLATE, []);
    expect(system).toBe(PROFILE_SYSTEM_PROMPT);
    expect(user).toContain('Embalagens flexíveis');
    expect(user).toContain('filmes laminados');
    expect(user).toContain('sachets stand-up');
    expect(user).toContain('rótulos');
    expect(user).toContain('Filmes mono e multicamada');
    expect(user).toContain('Caixas de papelão');
    expect(user).toContain('5.000.000,00');
    expect(user).toContain('12000 ton/ano');
    expect(user).toContain('pico em Q4');
    expect(user).toContain('ABNT NBR 14937');
    expect(user).toContain('ANVISA RDC 91/2001');
    expect(user).toContain('Qualidade certificada');
    expect(user).toContain('Gerente de Produção');
    expect(user).toContain('Engenheiro de Qualidade');
    expect(user).toContain('qualidade');
  });

  it('wraps the deterministic input in <profile-input> tags', () => {
    const { user } = buildProfilePrompt(fullParams(), TEMPLATE, []);
    expect(user).toMatch(/<profile-input>/);
    expect(user).toMatch(/<\/profile-input>/);
  });

  it('falls back to "não informado" for absent optional fields', () => {
    const { spendAnualBRL, ...rest } = fullParams();
    void spendAnualBRL;
    const { user } = buildProfilePrompt(rest as ProfileParams, TEMPLATE, []);
    expect(user).toContain('Spend anual estimado: não informado');
  });
});

describe('PROFILE_SYSTEM_PROMPT', () => {
  it('mandates literal preservation of audit-critical fields', () => {
    expect(PROFILE_SYSTEM_PROMPT).toMatch(/preservar.*[Ll]iteral|palavra por palavra/);
    expect(PROFILE_SYSTEM_PROMPT).toMatch(/[Rr]equisitos técnicos/);
    expect(PROFILE_SYSTEM_PROMPT).toMatch(/[Rr]estrições regulatórias/);
  });

  it('forbids inventing missing fields', () => {
    expect(PROFILE_SYSTEM_PROMPT).toMatch(/[Nn]ão inventar|não inventar/);
  });

  it('mentions the role as Strategic Sourcing Step 1 / category management', () => {
    expect(PROFILE_SYSTEM_PROMPT).toMatch(/categori|category|sourcing/i);
  });
});
