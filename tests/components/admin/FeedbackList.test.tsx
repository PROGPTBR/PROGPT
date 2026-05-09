// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FeedbackList } from '@/components/admin/FeedbackList';
import type { FeedbackRow } from '@/lib/feedback';

afterEach(() => cleanup());

const rows: FeedbackRow[] = [
  {
    id: 'f1',
    trace_id: 't1',
    session_id: 's1',
    user_id: 'u1',
    rating: 'down',
    comment: 'resposta confusa',
    created_at: '2026-05-08T12:00:00Z',
    updated_at: '2026-05-08T12:00:00Z',
    resolved_at: null,
  },
  {
    id: 'f2',
    trace_id: 't2',
    session_id: 's2',
    user_id: 'u2',
    rating: 'up',
    comment: null,
    created_at: '2026-05-08T11:00:00Z',
    updated_at: '2026-05-08T11:00:00Z',
    resolved_at: '2026-05-08T13:00:00Z',
  },
];

describe('FeedbackList', () => {
  it('renders rows with rating, comment preview, date, resolved badge', () => {
    render(
      <FeedbackList
        rows={rows}
        selectedId={null}
        filters={{ rating: undefined, resolved: false, hasComment: undefined }}
        onSelect={() => {}}
        onFilterChange={() => {}}
      />,
    );
    expect(screen.getByText(/resposta confusa/)).toBeTruthy();
    expect(screen.getByText(/resolvido/i)).toBeTruthy();
  });

  it('click on row calls onSelect with id', () => {
    const onSelect = vi.fn();
    render(
      <FeedbackList
        rows={rows}
        selectedId={null}
        filters={{ rating: undefined, resolved: false, hasComment: undefined }}
        onSelect={onSelect}
        onFilterChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/resposta confusa/).closest('tr')!);
    expect(onSelect).toHaveBeenCalledWith('f1');
  });

  it('rating toggle in filter bar fires onFilterChange', () => {
    const onFilterChange = vi.fn();
    render(
      <FeedbackList
        rows={rows}
        selectedId={null}
        filters={{ rating: undefined, resolved: false, hasComment: undefined }}
        onSelect={() => {}}
        onFilterChange={onFilterChange}
      />,
    );
    const downBtn = screen.getByRole('button', { name: /^👎/ });
    fireEvent.click(downBtn);
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ rating: 'down' }));
  });

  it('shows fallback when rows is empty', () => {
    render(
      <FeedbackList
        rows={[]}
        selectedId={null}
        filters={{ rating: undefined, resolved: false, hasComment: undefined }}
        onSelect={() => {}}
        onFilterChange={() => {}}
      />,
    );
    expect(screen.getByText(/sem feedback|nenhum/i)).toBeTruthy();
  });
});
