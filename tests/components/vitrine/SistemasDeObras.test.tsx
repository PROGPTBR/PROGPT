// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SistemasDeObras } from '@/components/vitrine/SistemasDeObras';

afterEach(cleanup);

describe('SistemasDeObras', () => {
  it('começa no CentraldeObras e troca para o Obras & Materiais', () => {
    render(<SistemasDeObras />);
    expect(screen.getByTitle('CentraldeObras 2BSUPPLY.IA').getAttribute('src')).toBe('/demos/centraldeobras/');

    fireEvent.click(screen.getByRole('tab', { name: 'Obras & Materiais 2BSUPPLY.IA' }));
    const frame = screen.getByTitle('Obras & Materiais 2BSUPPLY.IA');
    expect(frame.getAttribute('src')).toBe('/demos/obrasmateriais/');
    expect(screen.getByRole('tab', { name: 'Obras & Materiais 2BSUPPLY.IA' }).getAttribute('aria-selected')).toBe('true');
  });
});
