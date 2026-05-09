// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TopQueries } from '@/components/admin/TopQueries';

afterEach(() => cleanup());

describe('TopQueries', () => {
  it('renders rows with content and count', () => {
    render(
      <TopQueries
        rows={[{ content: 'O que é Kraljic?', count: 8 }, { content: 'Como reduzir custos?', count: 5 }]}
        loading={false}
      />,
    );
    expect(screen.getByText('O que é Kraljic?')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('shows fallback when rows is empty', () => {
    render(<TopQueries rows={[]} loading={false} />);
    expect(screen.getByText(/sem queries|nenhuma/i)).toBeTruthy();
  });

  it('shows loading state', () => {
    render(<TopQueries rows={[]} loading={true} />);
    expect(screen.getByText(/carregando/i)).toBeTruthy();
  });
});
