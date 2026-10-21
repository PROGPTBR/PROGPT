import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GLOSSARIO, termo } from '@/lib/tributario/glossario';

describe('glossário de impostos para leigos', () => {
  it('ids únicos e textos sem travessão', () => {
    expect(new Set(GLOSSARIO.map((t) => t.id)).size).toBe(GLOSSARIO.length);
    for (const t of GLOSSARIO) {
      expect(`${t.nome} ${t.sigla} ${t.oQueE} ${t.ondeAcho ?? ''}`, t.id).not.toMatch(/[—–]/);
      expect(t.oQueE.length, t.id).toBeGreaterThan(40);
    }
  });

  it('todo "?" da Análise Tributária aponta para um termo que existe', () => {
    const tela = readFileSync('components/assistants/TributarioAssistant.tsx', 'utf8');
    const ids = [...tela.matchAll(/(?:ajuda|<Ajuda id)="([a-z_]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) expect(() => termo(id), id).not.toThrow();
  });

  it('termo desconhecido falha alto (evita "?" vazio na tela)', () => {
    expect(() => termo('nao_existe')).toThrow();
  });
});
