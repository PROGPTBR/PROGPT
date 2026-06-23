import { describe, it, expect } from 'vitest';
import {
  certidoesLinks,
  certidoesLinksMarkdown,
} from '@/lib/assistants/certidoes-links';

describe('certidoesLinks', () => {
  it('sempre traz os 3 portais federais (Receita/PGFN, FGTS, CNDT)', () => {
    const links = certidoesLinks(null);
    const blob = links.map((l) => l.label + l.url).join(' ');
    expect(blob).toMatch(/Receita\/PGFN|Débitos Federais/);
    expect(blob).toMatch(/FGTS/);
    expect(blob).toMatch(/CNDT/);
    expect(links.length).toBeGreaterThanOrEqual(5); // + estadual + municipal
  });

  it('UF conhecida → link da SEFAZ daquele estado', () => {
    const sp = certidoesLinks('sp').find((l) => l.label.includes('estadual'));
    expect(sp?.url).toContain('sp.gov.br');
    expect(sp?.label).toContain('SP');
  });

  it('UF desconhecida → fallback com nota', () => {
    const est = certidoesLinks('ZZ').find((l) => l.label.includes('estadual'));
    expect(est?.nota).toBeTruthy();
  });

  it('markdown gera bullets com links', () => {
    const md = certidoesLinksMarkdown('SP');
    expect(md).toMatch(/- \[.+\]\(https?:\/\//);
  });
});
