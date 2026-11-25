import { describe, expect, it } from 'vitest';

import { estadoDeExemplo } from '@/lib/medico/exemplo';
import { DOCUMENTOS_DE_PARTIDA, faltaNoInicio, precisaDoInicio, QUEM_PREENCHE, situacaoDoInicio } from '@/lib/medico/inicio';
import { primeirosPassos } from '@/lib/medico/primeiros-passos';
import { CONFIG_VAZIA, TIPOS_DE_DOCUMENTO, type Documento } from '@/lib/medico/types';

const HOJE = '2026-11-24';
const doc = (tipo: Documento['tipo']): Documento => ({ id: tipo, demonstrativo_id: null, tipo, nome: `${tipo}.pdf`, mime: 'application/pdf', tamanho: 10, created_at: '2026-11-24T10:00:00Z' });

describe('formulário de início', () => {
  it('conta nova precisa do formulário; conta que já tem hospital real, não; respondido ou pulado, não', () => {
    expect(precisaDoInicio({ config: CONFIG_VAZIA, hospitais: [] })).toBe(true);
    const ex = estadoDeExemplo(HOJE);
    // Só hospitais de exemplo: ainda é conta nova.
    expect(precisaDoInicio({ config: CONFIG_VAZIA, hospitais: ex.hospitais })).toBe(true);
    expect(precisaDoInicio({ config: CONFIG_VAZIA, hospitais: [{ ...ex.hospitais[0]!, exemplo: false }] })).toBe(false);
    expect(precisaDoInicio({ config: { ...CONFIG_VAZIA, inicio_status: 'pulado' }, hospitais: [] })).toBe(false);
  });

  it('lista o que só o médico sabe e ainda falta, na ordem do formulário', () => {
    expect(faltaNoInicio({ config: CONFIG_VAZIA, hospitais: [], documentos: [] }).map((f) => f.id)).toEqual(['empresa', 'contador', 'hospitais', 'banco', 'demonstrativo']);
    const ex = estadoDeExemplo(HOJE);
    const h = { ...ex.hospitais[0]!, exemplo: false, email: '' };
    const cheio = { config: { ...ex.config, empresa_nome: 'X Ltda', empresa_cnpj: '00.000.000/0001-00', banco_nome: 'BTG Pactual' }, hospitais: [h], documentos: [doc('demonstrativo')] };
    expect(faltaNoInicio(cheio).map((f) => f.id)).toEqual(['hospital_email']);
    expect(faltaNoInicio({ ...cheio, hospitais: [{ ...h, email: 'h@h.com' }] })).toEqual([]);
  });

  it('o que a equipe preenche não aparece como falta do médico; os documentos pedidos existem como tipo', () => {
    for (const campo of QUEM_PREENCHE.equipe) expect(faltaNoInicio({ config: CONFIG_VAZIA, hospitais: [], documentos: [] }).map((f) => f.id)).not.toContain(campo);
    for (const d of DOCUMENTOS_DE_PARTIDA) expect(TIPOS_DE_DOCUMENTO).toContain(d.tipo);
    expect(DOCUMENTOS_DE_PARTIDA.filter((d) => d.obrigatorio).map((d) => d.tipo)).toEqual(['demonstrativo']);
  });

  it('situação para a equipe e o passo de volta quando o médico pulou', () => {
    expect(situacaoDoInicio({ config: CONFIG_VAZIA, hospitais: [], documentos: [] })).toEqual({ status: 'pendente', faltam: 5, documentos: 0 });
    const pulou = { ...estadoDeExemplo(HOJE), config: { ...CONFIG_VAZIA, inicio_status: 'pulado' as const } };
    expect(primeirosPassos(pulou)[0]).toMatchObject({ id: 'inicio', destino: 'inicio', feito: false });
    expect(primeirosPassos(estadoDeExemplo(HOJE)).some((p) => p.id === 'inicio')).toBe(false);
  });
});
