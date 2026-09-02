import { describe, expect, it } from 'vitest';
import {
  buildWelcomeEmail,
  buildPaymentConfirmedEmail,
  buildPaymentOverdueEmail,
  buildSubscriptionCancelledEmail,
} from '@/lib/email/templates';

describe('buildWelcomeEmail', () => {
  it('includes PROGPT, the username part of the email, and a link to /chat when there is no magic link', () => {
    const { subject, html } = buildWelcomeEmail({ email: 'maria@empresa.com' });
    expect(subject).toMatch(/PROGPT/);
    expect(html).toContain('maria');
    expect(html).toContain('/chat');
    expect(html).toContain('PROGPT');
    expect(html).not.toContain('/login');
  });

  it('uses the magic link as the primary CTA and still offers /login when one is provided', () => {
    const { html } = buildWelcomeEmail({
      email: 'maria@empresa.com',
      magicLink: 'https://x.supabase.co/auth/v1/verify?type=magiclink&token=abc',
    });
    expect(html).toContain('https://x.supabase.co/auth/v1/verify?type=magiclink&token=abc');
    expect(html).toContain('Entrar automaticamente');
    expect(html).toContain('/login');
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
