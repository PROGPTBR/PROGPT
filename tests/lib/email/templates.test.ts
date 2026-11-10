import { describe, expect, it } from 'vitest';
import {
  buildWelcomeEmail,
  buildPaymentConfirmedEmail,
  buildPaymentOverdueEmail,
  buildSubscriptionCancelledEmail,
  buildUpdateAnnouncementEmail,
} from '@/lib/email/templates';

describe('buildWelcomeEmail', () => {
  it('includes PROGPT, the account email in the status card, and links to /chat, /login and /forgot-password', () => {
    const { subject, html } = buildWelcomeEmail({ email: 'maria@empresa.com' });
    expect(subject).toMatch(/PROGPT/);
    expect(html).toContain('maria');
    expect(html).toContain('maria@empresa.com');
    expect(html).toContain('/chat');
    expect(html).toContain('/login');
    expect(html).toContain('/forgot-password');
    expect(html).toContain('PROGPT');
    expect(html).not.toContain('ATUALIZAÇÃO DO SISTEMA');
  });

  it('uses the magic link as the primary CTA and still offers /login and /forgot-password when one is provided', () => {
    const { html } = buildWelcomeEmail({
      email: 'maria@empresa.com',
      magicLink: 'https://x.supabase.co/auth/v1/verify?type=magiclink&token=abc',
    });
    expect(html).toContain('https://x.supabase.co/auth/v1/verify?type=magiclink&token=abc');
    expect(html).toContain('Entrar automaticamente');
    expect(html).toContain('/login');
    expect(html).toContain('/forgot-password');
  });
});

describe('buildUpdateAnnouncementEmail', () => {
  it('reutiliza o shell, mostra título, resumo e CTA para a atualização', () => {
    const { subject, html } = buildUpdateAnnouncementEmail({
      title: 'Busca mais rápida',
      summary: 'Agora ficou mais simples encontrar assistentes.',
      slug: 'busca-mais-rapida',
      category: 'new_feature',
    });

    expect(subject).toBe('Novidade no PROGPT: Busca mais rápida');
    expect(html).toContain('Busca mais rápida');
    expect(html).toContain('Agora ficou mais simples encontrar assistentes.');
    expect(html).toContain('Ver atualização');
    expect(html).toContain('ATUALIZAÇÃO DO SISTEMA — NOVO RECURSO');
    expect(html).toContain('font-size:12px');
    expect(html).toContain('letter-spacing:0.08em');
    expect(html).toContain('/atualizacoes#busca-mais-rapida');
    expect(html).toContain('progpt-logo-neon.png');
    expect(html).toContain('background:#050b18');
    expect(html).not.toContain('{{ .ConfirmationURL }}');
  });

  it('escapa conteúdo administrável antes de inseri-lo no HTML', () => {
    const { html } = buildUpdateAnnouncementEmail({
      title: '<script>alert(1)</script>',
      summary: '<img src=x onerror=alert(1)>',
      slug: 'seguro',
      category: 'fix',
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  it.each([
    ['new_feature', 'NOVO RECURSO'],
    ['improvement', 'MELHORIA'],
    ['fix', 'CORREÇÃO'],
  ] as const)('exibe o rótulo legível da categoria %s', (category, label) => {
    const { html } = buildUpdateAnnouncementEmail({
      title: 'Título',
      summary: 'Resumo',
      slug: 'titulo',
      category,
    });

    expect(html).toContain(`ATUALIZAÇÃO DO SISTEMA — ${label}`);
    expect(html).toContain('white-space:normal');
  });
});

describe('buildPaymentConfirmedEmail', () => {
  it('formats the amount in BRL convention and includes next due date', () => {
    const { subject, html } = buildPaymentConfirmedEmail({
      email: 'x@y.com',
      amountBrl: 99,
      nextDueDate: '28/06/2026',
    });
    expect(subject).toMatch(/99,00/);
    expect(html).toContain('99,00');
    expect(html).toContain('28/06/2026');
    expect(html).toContain('/account/billing');
  });
});

describe('buildPaymentOverdueEmail', () => {
  it('flags the access cutoff date and links to billing', () => {
    const { subject, html } = buildPaymentOverdueEmail({
      email: 'x@y.com',
      accessUntil: '15/07/2026',
    });
    expect(subject).toMatch(/PROGPT/);
    expect(html).toContain('15/07/2026');
    expect(html).toContain('/account/billing');
  });
});

describe('buildSubscriptionCancelledEmail', () => {
  it('shows the cancellation date and offers reactivation link', () => {
    const { subject, html } = buildSubscriptionCancelledEmail({
      email: 'x@y.com',
      accessUntil: '15/07/2026',
    });
    expect(subject).toContain('15/07/2026');
    expect(html).toContain('15/07/2026');
    expect(html).toContain('/pricing');
  });
});
