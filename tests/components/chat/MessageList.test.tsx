// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MessageList } from '@/components/chat/MessageList';

afterEach(() => cleanup());

const userMsg = { role: 'user' as const, content: 'o que é Kraljic?' };
const assistantMsg = { role: 'assistant' as const, content: 'A matriz…' };

describe('MessageList — indicador de processamento', () => {
  it('mostra os pontinhos no gap (carregando + última msg é do usuário)', () => {
    const { container } = render(
      <MessageList messages={[userMsg]} isLoading={true} />,
    );
    expect(container.querySelector('[data-thinking-dots]')).toBeTruthy();
  });

  it('mostra os pontinhos quando a lista está vazia e está carregando', () => {
    const { container } = render(<MessageList messages={[]} isLoading={true} />);
    expect(container.querySelector('[data-thinking-dots]')).toBeTruthy();
  });

  it('NÃO mostra a bolha-fantasma quando o assistant já está streamando', () => {
    // A bolha do próprio assistant (Message) cuida do indicador nesse caso.
    const { container } = render(
      <MessageList messages={[userMsg, assistantMsg]} isLoading={true} />,
    );
    // só 2 bolhas (user + assistant), sem li extra de "thinking"
    expect(container.querySelectorAll('ol > li').length).toBe(2);
  });

  it('não mostra nada de processamento quando não está carregando', () => {
    const { container } = render(
      <MessageList messages={[userMsg, assistantMsg]} isLoading={false} />,
    );
    expect(container.querySelector('[data-thinking-dots]')).toBeFalsy();
  });
});
