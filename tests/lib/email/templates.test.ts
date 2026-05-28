import { describe, expect, it } from 'vitest';
import {
  buildWelcomeEmail,
  buildPaymentConfirmedEmail,
  buildPaymentOverdueEmail,
  buildSubscriptionCancelledEmail,
} from '@/lib/email/templates';

describe('buildWelcomeEmail', () => {
  it('includes PROGPT, the username part of the email, and a link to /chat', () => {
    const { subject, html } = buildWelcomeEmail({ email: 'maria@empresa.com' });
    expect(subject).toMatch(/PROGPT/);
    expect(html).toContain('maria');
    expect(html).toContain('/chat');
    expect(html).toContain('PROGPT');
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
