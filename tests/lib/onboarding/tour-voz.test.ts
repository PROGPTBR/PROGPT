import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { TOUR_STEPS } from '@/lib/onboarding/tour-steps';
import { assinaturaFala, textoFalado, urlVozDoPasso } from '@/lib/onboarding/tour-voz';

const manifest: Record<string, string> = JSON.parse(readFileSync('public/tour/voz/manifest.json', 'utf8'));

describe('voz do assistente do tour', () => {
  it('todo passo tem áudio gravado com o texto atual', () => {
    // Falhou? Rode scripts/gerar-voz-tour.ts (instruções no topo do arquivo).
    const faltando = TOUR_STEPS.filter((s) => !existsSync(`public/tour/voz/${s.id}.mp3`)).map((s) => s.id);
    const velhos = TOUR_STEPS.filter((s) => manifest[s.id] !== assinaturaFala(textoFalado(s))).map((s) => s.id);
    expect(faltando).toEqual([]);
    expect(velhos).toEqual([]);
  });

  it('ajusta a pronúncia do que a voz lê errado', () => {
    expect(textoFalado({ title: 'O PROGPT', body: 'Baixe o "relatório" .docx e a planilha .xlsx.' })).toBe(
      'O Pró GPT. Baixe o relatório Word e a planilha Excel.',
    );
  });

  it('o endereço muda quando o texto do passo muda (não toca áudio velho do cache)', () => {
    const a = urlVozDoPasso({ id: 'x', title: 'A', body: 'texto' });
    const b = urlVozDoPasso({ id: 'x', title: 'A', body: 'texto novo' });
    expect(a).toMatch(/^\/tour\/voz\/x\.mp3\?v=[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });
});
