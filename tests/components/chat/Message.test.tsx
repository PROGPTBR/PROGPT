// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Message } from '@/components/chat/Message';

afterEach(() => cleanup());

describe('Message', () => {
  it('renders user message as plain text', () => {
    render(<Message role="user" content="**não** deve renderizar markdown" isStreaming={false} />);
    // The literal stars should be visible (not interpreted)
    expect(screen.getByText(/\*\*não\*\* deve renderizar/)).toBeTruthy();
  });

  it('renders assistant markdown (heading + bullet) as DOM', () => {
    const md = `# título\n\n- item um\n- item dois`;
    const { container } = render(<Message role="assistant" content={md} isStreaming={false} />);
    expect(screen.getByRole('heading', { level: 1, name: /título/ })).toBeTruthy();
    const prose = container.querySelector('.prose');
    const items = prose?.querySelectorAll('li') || [];
    expect(Array.from(items).map((li) => li.textContent)).toEqual(['item um', 'item dois']);
  });

  it('shows pulsing dot only while streaming on the last assistant bubble', () => {
    const { container, rerender } = render(
      <Message role="assistant" content="texto" isStreaming={true} />,
    );
    expect(container.querySelector('[data-streaming-dot]')).toBeTruthy();
    rerender(<Message role="assistant" content="texto" isStreaming={false} />);
    expect(container.querySelector('[data-streaming-dot]')).toBeFalsy();
  });

  it('renders followup chips on last assistant message when not streaming', () => {
    const { container } = render(
      <Message
        role="assistant"
        content="resposta"
        isStreaming={false}
        isLast
        followups={['A?', 'B?']}
        onPickFollowup={() => {}}
      />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('does NOT render chips when not last', () => {
    const { container } = render(
      <Message
        role="assistant"
        content="r"
        isStreaming={false}
        isLast={false}
        followups={['A?']}
        onPickFollowup={() => {}}
      />,
    );
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('does NOT render chips while streaming', () => {
    const { container } = render(
      <Message
        role="assistant"
        content="r"
        isStreaming={true}
        isLast
        followups={['A?']}
        onPickFollowup={() => {}}
      />,
    );
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('does NOT render chips for user role', () => {
    const { container } = render(
      <Message
        role="user"
        content="r"
        isStreaming={false}
        isLast
        followups={['A?']}
        onPickFollowup={() => {}}
      />,
    );
    expect(container.querySelectorAll('button').length).toBe(0);
  });
});

describe('Message — assistant tool CTA derived from content', () => {
  it('renders the CTA card (link to the tool) when the content mentions a path, even with NO backend annotation', () => {
    render(
      <Message
        role="assistant"
        isStreaming={false}
        content="Use a ferramenta dedicada em /assistants/rfp — ela gera um .docx."
      />,
    );
    const card = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/assistants/rfp');
    expect(card).toBeTruthy();
    expect(card!.textContent).toMatch(/RFP|Cota/i);
  });

  it('strips the raw /assistants path from the rendered text (no ugly path inline)', () => {
    const { container } = render(
      <Message
        role="assistant"
        isStreaming={false}
        content="abra a ferramenta em /assistants/kraljic para a matriz"
      />,
    );
    const prose = container.querySelector('.prose');
    // the raw path is gone from the body...
    expect(prose?.textContent).not.toMatch(/\/assistants\/kraljic/);
    expect(prose?.textContent).toMatch(/abra a ferramenta para a matriz/);
    // ...but the card (with the link) is present
    const card = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/assistants/kraljic');
    expect(card).toBeTruthy();
  });

  it('does NOT render the big card while streaming (the inline link may still appear, the card must not)', () => {
    render(
      <Message
        role="assistant"
        isStreaming
        content="Use /assistants/porter para as 5 forças."
      />,
    );
    // The card carries a distinctive title ("Abrir Análise de Porter").
    expect(screen.queryByText(/Abrir Análise de Porter/i)).toBeNull();
  });

  it('renders no CTA when content has no assistant path', () => {
    render(
      <Message
        role="assistant"
        isStreaming={false}
        content="Kraljic foi publicado na HBR em 1983."
      />,
    );
    const any = screen
      .queryAllByRole('link')
      .find((a) => a.getAttribute('href')?.startsWith('/assistants/'));
    expect(any).toBeFalsy();
  });

  it('renders the scorecard card when the content mentions /assistants/scorecard', () => {
    render(
      <Message
        role="assistant"
        isStreaming={false}
        content="Para isso, use a ferramenta dedicada em /assistants/scorecard."
      />,
    );
    const card = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/assistants/scorecard');
    expect(card).toBeTruthy();
    expect(card!.textContent).toMatch(/Scorecard/i);
  });

  it('honors an explicit backend annotation even when content has no path', () => {
    render(
      <Message
        role="assistant"
        isStreaming={false}
        content="texto sem caminho"
        assistantCTA="financial"
      />,
    );
    const card = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/assistants/financial');
    expect(card).toBeTruthy();
  });
});
