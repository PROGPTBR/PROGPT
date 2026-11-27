import { describe, expect, it } from 'vitest';

import { linkWhatsapp, mensagemDeAcesso } from '@/lib/medico/mensagem-acesso';

const BASE = { nome: 'Dr. Eduardo Kastrup', email: 'medico@exemplo.com', senha: 'abcd-2345-WXYZ', link: 'https://2bsupply.ia.br/medicos', hospitais: 2, cirurgias: 11, demonstrativos: 3, contador: false, celular: false, emailEntrada: 'medico-abc@entrada.exemplo' };

describe('mensagem de acesso (sub-projeto 119)', () => {
  it('leva endereço, e-mail, senha, o que já foi lançado e o que falta', () => {
    const t = mensagemDeAcesso(BASE);
    expect(t).toContain('https://2bsupply.ia.br/medicos');
    expect(t).toContain('medico@exemplo.com');
    expect(t).toContain('abcd-2345-WXYZ');
    expect(t).toContain('11 cirurgias lançadas');
    expect(t).toContain('faltam 3 coisas');
    expect(t).toContain('medico-abc@entrada.exemplo');
    expect(t).not.toMatch(/[—–]/);
  });

  it('o que já está cadastrado sai da lista do que falta', () => {
    const t = mensagemDeAcesso({ ...BASE, contador: true, celular: true });
    expect(t).toContain('falta 1 coisa');
    expect(t).not.toContain('contador');
    const nada = mensagemDeAcesso({ ...BASE, contador: true, celular: true, emailEntrada: null, hospitais: 0, cirurgias: 0, demonstrativos: 0 });
    expect(nada).not.toContain('Para tudo ficar automático');
    expect(nada).not.toContain('Já lançamos');
  });

  it('link do WhatsApp com DDI e sem número', () => {
    expect(linkWhatsapp('oi', '(21) 99999-0000')).toBe('https://wa.me/5521999990000?text=oi');
    expect(linkWhatsapp('oi')).toBe('https://wa.me/?text=oi');
  });
});
