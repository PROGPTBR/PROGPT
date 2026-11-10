import { describe, expect, it } from 'vitest';
import {
  ProductUpdateCreateSchema,
  ProductUpdatePatchSchema,
  slugifyUpdateTitle,
} from '@/lib/updates/types';

const valid = {
  title: 'Nova busca de fornecedores',
  slug: 'nova-busca-de-fornecedores',
  category: 'new_feature',
  summary: 'Resumo da atualização.',
  content_md: '- Item',
  image_url: '/atualizacoes/imagem.png',
  video_url: 'https://cdn.example.com/video.mp4',
  media_caption: 'Demonstração',
  published_at: '2026-11-10T12:00:00-03:00',
  status: 'published',
};

describe('schemas de atualizações', () => {
  it('aceita o contrato completo', () => {
    expect(ProductUpdateCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejeita slug fora do padrão e URL insegura', () => {
    expect(ProductUpdateCreateSchema.safeParse({ ...valid, slug: 'Com Espaços' }).success).toBe(false);
    expect(ProductUpdateCreateSchema.safeParse({ ...valid, image_url: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('exige ao menos um campo no patch', () => {
    expect(ProductUpdatePatchSchema.safeParse({}).success).toBe(false);
    expect(ProductUpdatePatchSchema.safeParse({ status: 'draft' }).success).toBe(true);
  });

  it('gera slug estável em ASCII', () => {
    expect(slugifyUpdateTitle('  Correção: Cotação & RFP!  ')).toBe('correcao-cotacao-rfp');
  });
});
