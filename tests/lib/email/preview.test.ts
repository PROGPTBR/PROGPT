import { describe, expect, it } from 'vitest';
import { buildEmailPreview } from '@/lib/email/preview';
import { EMAIL_PREVIEW_OPTIONS } from '@/lib/email/preview-options';

describe('buildEmailPreview', () => {
  it.each(EMAIL_PREVIEW_OPTIONS)('gera a prévia de $label', ({ id }) => {
    const preview = buildEmailPreview(id, {
      title: 'Nova busca',
      summary: 'Agora está mais fácil encontrar assistentes.',
      slug: 'nova-busca',
      category: 'improvement',
    });

    expect(preview.subject.length).toBeGreaterThan(0);
    expect(preview.html).toContain('<!DOCTYPE html>');
    expect(preview.html).toContain('progpt-logo-neon.png');
    expect(preview.html).toContain('background:#050b18');
    expect(preview.html).not.toContain('{{ .ConfirmationURL }}');
  });
});

