// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FeedbackDetail } from '@/components/admin/FeedbackDetail';
import type { FeedbackRow } from '@/lib/feedback';

afterEach(() => cleanup());

const item: FeedbackRow = {
  id: 'f1',
  trace_id: 't1',
  session_id: 's1',
  user_id: 'u1',
  rating: 'down',
  comment: 'resposta incompleta',
  created_at: '2026-05-08T12:00:00Z',
  updated_at: '2026-05-08T12:00:00Z',
  resolved_at: null,
};

const sessionMessages = [
  { role: 'user' as const, content: 'Como aplicar Kraljic?' },
  {
    role: 'assistant' as const,
    content: 'Aplica-se em 4 quadrantes...',
    annotations: [
      {
        traceId: 't1',
        sources: [
          { articleId: 'a1', articleTitle: 'Curva ABC', theme: 'Kraljic' },
        ],
      },
    ],
  },
];

describe('FeedbackDetail', () => {
  it('renders question, answer, sources, and comment', () => {
    render(
      <FeedbackDetail
        item={item}
        sessionMessages={sessionMessages}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByText(/Como aplicar Kraljic/)).toBeTruthy();
    expect(screen.getByText(/Aplica-se em 4 quadrantes/)).toBeTruthy();
    expect(screen.getByText('Curva ABC')).toBeTruthy();
    expect(screen.getByText(/resposta incompleta/)).toBeTruthy();
  });

  it('resolve button calls onResolve(true) when item is unresolved', () => {
    const onResolve = vi.fn();
    render(
      <FeedbackDetail item={item} sessionMessages={sessionMessages} onResolve={onResolve} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /marcar como resolvido/i }));
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('resolve button calls onResolve(false) when item is already resolved', () => {
    const onResolve = vi.fn();
    const resolved = { ...item, resolved_at: '2026-05-08T13:00:00Z' };
    render(
      <FeedbackDetail item={resolved} sessionMessages={sessionMessages} onResolve={onResolve} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /desmarcar/i }));
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it('falls back to last assistant message when traceId match fails', () => {
    const stale = [
      { role: 'user' as const, content: 'q' },
      { role: 'assistant' as const, content: 'a-without-trace', annotations: [] },
    ];
    render(
      <FeedbackDetail item={item} sessionMessages={stale} onResolve={() => {}} />,
    );
    expect(screen.getByText(/a-without-trace/)).toBeTruthy();
  });

  it('does not render comment block when item.comment is null', () => {
    const noComment = { ...item, comment: null };
    render(
      <FeedbackDetail item={noComment} sessionMessages={sessionMessages} onResolve={() => {}} />,
    );
    expect(screen.queryByText(/comentário/i)).toBeNull();
  });
});
