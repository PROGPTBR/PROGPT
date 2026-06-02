// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingQuickStartCard } from '@/components/chat/OnboardingQuickStartCard';

const KEY = 'procurementgpt_onboarding_quick_start_v1';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('OnboardingQuickStartCard', () => {
  it('renders the 3 quick-win steps linking to the right assistants', async () => {
    render(<OnboardingQuickStartCard />);
    const links = await screen.findAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/assistants/suppliers');
    expect(hrefs).toContain('/assistants/abc');
    expect(hrefs).toContain('/assistants/rfp');
  });

  it('dismiss hides the card and persists the choice in localStorage', async () => {
    const user = userEvent.setup();
    render(<OnboardingQuickStartCard />);
    await screen.findByText(/Comece por aqui/i);
    await user.click(screen.getByRole('button', { name: /dispensar/i }));
    expect(screen.queryByText(/Comece por aqui/i)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeTruthy();
  });

  it('does not render when already dismissed', () => {
    localStorage.setItem(KEY, 'dismissed');
    render(<OnboardingQuickStartCard />);
    expect(screen.queryByText(/Comece por aqui/i)).toBeNull();
  });
});
