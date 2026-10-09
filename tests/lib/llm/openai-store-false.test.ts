import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Privacidade (sub-projeto 82): a política e o documento de auditoria afirmam
// que as respostas não ficam guardadas na OpenAI. Toda chamada nova à
// Responses API precisa de `store: false`.
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : arquivos(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('Responses API com store: false', () => {
  it('toda chamada responses.create desliga o armazenamento', () => {
    const faltando: string[] = [];
    for (const f of [...arquivos('lib'), ...arquivos('app')]) {
      const src = readFileSync(f, 'utf8');
      const re = /responses\.create\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const trecho = src.slice(m.index, m.index + 400);
        if (!/store:\s*false/.test(trecho)) faltando.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(faltando).toEqual([]);
  });
});
