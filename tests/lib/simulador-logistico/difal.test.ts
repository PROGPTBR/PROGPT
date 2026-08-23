import { describe, expect, it } from 'vitest';
import {
  aliquotaInterestadual,
  calcularDifal,
  compararOrigens,
} from '@/lib/simulador-logistico/difal';

describe('aliquotaInterestadual', () => {
  it('Sul/Sudeste (exceto ES) → Norte/Nordeste/Centro-Oeste/ES = 7%', () => {
    expect(aliquotaInterestadual('PR', 'BA', false)).toBe(7);
    expect(aliquotaInterestadual('SP', 'AM', false)).toBe(7);
    expect(aliquotaInterestadual('MG', 'ES', false)).toBe(7);
  });

  it('Sul/Sudeste entre si (exceto ES) = 12%, não 7%', () => {
    expect(aliquotaInterestadual('PR', 'RS', false)).toBe(12);
    expect(aliquotaInterestadual('SP', 'MG', false)).toBe(12);
  });

  it('ES como origem nunca pega a regra de 7% (só entra como destino elegível)', () => {
    expect(aliquotaInterestadual('ES', 'BA', false)).toBe(12);
  });

  it('demais combinações (Norte/Nordeste/CO entre si) = 12%', () => {
    expect(aliquotaInterestadual('AM', 'PA', false)).toBe(12);
    expect(aliquotaInterestadual('BA', 'CE', false)).toBe(12);
  });

  it('bem importado ou com conteúdo de importação > 40% = 4%, independente do par', () => {
    expect(aliquotaInterestadual('PR', 'BA', true)).toBe(4);
    expect(aliquotaInterestadual('SP', 'MG', true)).toBe(4);
    expect(aliquotaInterestadual('AM', 'PA', true)).toBe(4);
  });
});

describe('calcularDifal — fórmula de base dupla', () => {
  // Exemplo público verificado (blog especializado em ICMS, base dupla):
  // valor R$1.000, alíq. interestadual 12%, alíq. interna destino 17%,
  // sem FCP → DIFAL = R$68,46. Usamos overrides explícitos de
  // aliquotaInternaDestino/fcp pra testar a FÓRMULA isoladamente da tabela
  // padrão de UF_INFO (que é só um default editável, não precisa bater
  // com o exemplo do blog).
  it('reproduz o exemplo público verificado (AM→PA, R$1.000, 12%→17%, sem FCP)', () => {
    const r = calcularDifal({
      valor: 1000,
      ufOrigem: 'AM',
      ufDestino: 'PA',
      aliquotaInternaDestino: 17,
      fcp: 0,
    });
    expect(r.aliquotaInterestadual).toBe(12);
    expect(r.baseOrigem).toBeCloseTo(1136.36, 1);
    expect(r.icmsOrigem).toBeCloseTo(136.36, 1);
    expect(r.baseDestino).toBeCloseTo(1204.82, 1);
    expect(r.icmsDestino).toBeCloseTo(204.82, 1);
    expect(r.difal).toBeCloseTo(68.46, 1);
    expect(r.totalRecolher).toBeCloseTo(68.46, 1);
  });

  it('mesma UF de origem e destino: não há operação interestadual, tudo zero', () => {
    const r = calcularDifal({ valor: 5000, ufOrigem: 'SP', ufDestino: 'SP' });
    expect(r.mesmoEstado).toBe(true);
    expect(r.aliquotaInterestadual).toBe(0);
    expect(r.difal).toBe(0);
    expect(r.totalRecolher).toBe(0);
  });

  it('FCP: base dupla do destino é consistente (ICMS destino + FCP = base destino × alíquota combinada)', () => {
    const r = calcularDifal({
      valor: 10_000,
      ufOrigem: 'SP',
      ufDestino: 'RJ',
      aliquotaInternaDestino: 20,
      fcp: 2,
    });
    expect(r.fcpValor).toBeGreaterThan(0);
    expect(r.icmsDestino + r.fcpValor).toBeCloseTo(
      r.baseDestino * 0.22,
      6,
    );
  });

  it('usa os defaults de UF_INFO quando aliquotaInternaDestino/fcp não são informados', () => {
    const r = calcularDifal({ valor: 1000, ufOrigem: 'SP', ufDestino: 'RJ' });
    expect(r.aliquotaInternaDestino).toBe(20);
    expect(r.fcp).toBe(2);
  });

  it('finalidade "revenda" ainda calcula, mas marca avisoRevenda', () => {
    const semAviso = calcularDifal({ valor: 1000, ufOrigem: 'SP', ufDestino: 'RJ' });
    expect(semAviso.avisoRevenda).toBe(false);

    const comAviso = calcularDifal({
      valor: 1000,
      ufOrigem: 'SP',
      ufDestino: 'RJ',
      finalidade: 'revenda',
    });
    expect(comAviso.avisoRevenda).toBe(true);
    expect(comAviso.difal).toBeCloseTo(semAviso.difal, 6);
  });

  it('bem importado eleva a alíquota interestadual pra 4%, aumentando o DIFAL', () => {
    const semImportacao = calcularDifal({ valor: 1000, ufOrigem: 'SP', ufDestino: 'RJ' });
    const comImportacao = calcularDifal({
      valor: 1000,
      ufOrigem: 'SP',
      ufDestino: 'RJ',
      importado: true,
    });
    expect(comImportacao.aliquotaInterestadual).toBe(4);
    expect(comImportacao.difal).toBeGreaterThan(semImportacao.difal);
  });
});

describe('compararOrigens', () => {
  it('ordena por menor custo total (DIFAL + FCP + frete informado)', () => {
    const cenarios = compararOrigens({
      valor: 1000,
      ufDestino: 'SP',
      cenarios: [
        { ufOrigem: 'RJ', freteInformado: 50 },
        { ufOrigem: 'MG', freteInformado: 200 },
        { ufOrigem: 'BA' }, // sem frete informado → 0
      ],
    });
    expect(cenarios).toHaveLength(3);
    // menor totalComFrete primeiro
    for (let i = 1; i < cenarios.length; i++) {
      expect(cenarios[i]!.totalComFrete).toBeGreaterThanOrEqual(
        cenarios[i - 1]!.totalComFrete,
      );
    }
  });

  it('frete não informado vira 0, não undefined/NaN', () => {
    const [cenario] = compararOrigens({
      valor: 1000,
      ufDestino: 'SP',
      cenarios: [{ ufOrigem: 'RJ' }],
    });
    expect(cenario!.freteInformado).toBe(0);
    expect(Number.isFinite(cenario!.totalComFrete)).toBe(true);
  });
});
