// Links diretos dos portais oficiais de certidões, para consulta manual.
// Certidões não saem por API gratuita (captcha/portal/certificado A1), então
// o relatório de homologação traz os links para o comprador emitir na hora.
// Os portais federais não aceitam o CNPJ na URL (têm captcha) — levam à página
// de emissão. Estadual/municipal variam por localidade.

export type CertidaoLink = { label: string; url: string; nota?: string };

// SEFAZ estadual — portal de certidão de débitos por UF (cobertura dos maiores;
// fallback genérico para os demais).
const SEFAZ_UF: Record<string, string> = {
  SP: 'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/emitirCrda.jsf',
  RJ: 'https://www4.fazenda.rj.gov.br/certidao-fiscal/',
  MG: 'https://www2.fazenda.mg.gov.br/sol/',
  RS: 'https://www.sefaz.rs.gov.br/Receita/CertidaoSituacaoFiscal.aspx',
  SC: 'https://sat.sef.sc.gov.br/tax.NET/Sat.Cers.Web/EmissaoCertidao.aspx',
  PR: 'https://www.cdn.fazenda.pr.gov.br/cdn/emissaoUnificada.do',
  BA: 'https://servicos.sefaz.ba.gov.br/sistemas/dezweb/login.aspx',
  GO: 'https://www.sefaznet.go.gov.br/certidao/',
  PE: 'https://efisco.sefaz.pe.gov.br/sfi_trb_gcs/PRConsultarCertidaoNegativa',
  CE: 'https://servicos.sefaz.ce.gov.br/internet/certidao/',
  DF: 'https://ww1.receita.fazenda.df.gov.br/cidadao/certidoes',
};

export function certidoesLinks(uf?: string | null): CertidaoLink[] {
  const ufKey = (uf ?? '').trim().toUpperCase();
  return [
    {
      label: 'Certidão de Débitos Federais e Dívida Ativa da União (Receita/PGFN)',
      url: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',
    },
    {
      label: 'CRF — Certificado de Regularidade do FGTS (Caixa)',
      url: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    },
    {
      label: 'CNDT — Certidão Negativa de Débitos Trabalhistas (TST)',
      url: 'https://www.tst.jus.br/certidao',
    },
    {
      label: `Certidão estadual${ufKey ? ` — SEFAZ ${ufKey}` : ''}`,
      url: SEFAZ_UF[ufKey] ?? 'https://www.gov.br/pt-br/servicos',
      nota: SEFAZ_UF[ufKey]
        ? undefined
        : 'Emitir no portal da SEFAZ do estado da sede.',
    },
    {
      label: 'Certidão municipal (tributos municipais)',
      url: 'https://www.gov.br/pt-br/servicos',
      nota: 'Emitir no portal da prefeitura do município sede.',
    },
  ];
}

/** Bloco markdown com os links, para injetar no prompt de homologação. */
export function certidoesLinksMarkdown(uf?: string | null): string {
  return certidoesLinks(uf)
    .map((l) => `- [${l.label}](${l.url})${l.nota ? ` — ${l.nota}` : ''}`)
    .join('\n');
}
