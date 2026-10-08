// Relatório da Busca de Fornecedores (2026-10-08): tudo o que a busca achou,
// pronto para baixar em PDF ou Excel e mandar para quem decide. Puro: monta
// o conteúdo (cabeçalho + seções em tabela); o PDF é desenhado no navegador
// (relatorio-busca-pdf.ts) e o Excel no servidor (/api/suppliers/relatorio).

import type { GroupedSupplier } from './types';
import type { FornecedorWeb, ResultadoVendorList } from './busca-ampliada';
import { semTravessao } from '@/lib/texto/sem-travessao';

export type SecaoRelatorio = { titulo: string; colunas: string[]; linhas: string[][] };

export type RelatorioBusca = {
  titulo: string;
  geradoEm: string;
  resumo: [string, string][];
  secoes: SecaoRelatorio[];
};

export type EntradaRelatorio = {
  pedido: string;
  cnae: string;
  cnaeName: string | null;
  regiao: string;
  receita: GroupedSupplier[];
  vendorList?: ResultadoVendorList[] | null;
  web?: FornecedorWeb[] | null;
  geradoEm?: Date;
};

const t = (v: string | number | null | undefined) => semTravessao(v == null ? '' : String(v)).trim();

export function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
}

const PORTE: Record<string, string> = { ME: 'Microempresa', EPP: 'Pequeno porte', DEMAIS: 'Médio ou grande' };

/** A unidade que representa a empresa: a matriz (0001) ou, sem ela, a de maior capital. */
function unidadePrincipal(g: GroupedSupplier) {
  return g.units.find((u) => u.cnpj.slice(8, 12) === '0001') ?? [...g.units].sort((a, b) => (b.capital_social ?? 0) - (a.capital_social ?? 0))[0]!;
}

export function montarRelatorioBusca(e: EntradaRelatorio): RelatorioBusca {
  const quando = e.geradoEm ?? new Date();
  const geradoEm = quando.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

  const receita: SecaoRelatorio = {
    titulo: 'Empresas na base da Receita Federal',
    colunas: ['Empresa', 'CNPJ', 'Cidade/UF', 'Porte', 'Telefone', 'E-mail', 'Abertura', 'Unidades'],
    linhas: e.receita.map((g) => {
      const u = unidadePrincipal(g);
      return [
        t(u.nome_fantasia && u.nome_fantasia !== u.razao_social ? `${u.razao_social} (${u.nome_fantasia})` : u.razao_social),
        formatarCnpj(u.cnpj),
        t([u.municipio, u.uf].filter(Boolean).join('/')),
        t(u.porte ? PORTE[u.porte] ?? u.porte : ''),
        t(u.telefone),
        t(u.email?.toLowerCase()),
        t(g.aberturaAno),
        String(g.units.length),
      ];
    }),
  };

  const secoes: SecaoRelatorio[] = [receita];
  if (e.vendorList) {
    secoes.push({
      titulo: 'Na sua vendor list',
      colunas: ['Fornecedor', 'Grupo', 'Cidade/UF', 'Telefone', 'E-mail', 'Por que entrou'],
      linhas: e.vendorList.map((f) => [
        t(f.razaoSocial),
        t(f.categoria),
        t([f.municipio, f.uf].filter(Boolean).join('/')),
        t(f.telefone),
        t(f.email),
        t(f.motivo),
      ]),
    });
  }
  if (e.web) {
    secoes.push({
      titulo: 'Na internet (confirme preço, estoque e dados antes de comprar)',
      colunas: ['Empresa', 'O que vende', 'Cidade/UF', 'Telefone', 'Site'],
      linhas: e.web.map((f) => [t(f.nome), t(f.oQueVende), t([f.cidade, f.uf].filter(Boolean).join('/')), t(f.telefone), t(f.site)]),
    });
  }

  const resumo: [string, string][] = [
    ['Pedido', t(e.pedido) || '(busca salva)'],
    ['Atividade (CNAE)', t(e.cnaeName ? `${e.cnae} · ${e.cnaeName}` : e.cnae)],
    ['Região', t(e.regiao) || 'Brasil'],
    ['Empresas na Receita', String(receita.linhas.length)],
  ];
  if (e.vendorList) resumo.push(['Na vendor list', String(e.vendorList.length)]);
  if (e.web) resumo.push(['Na internet', String(e.web.length)]);
  resumo.push(['Gerado em', geradoEm]);

  return { titulo: 'Relatório de busca de fornecedores', geradoEm, resumo, secoes };
}

/** Nome do arquivo baixado: relatorio-fornecedores-<pedido>-<data>. */
export function nomeArquivoRelatorio(pedido: string, quando = new Date()): string {
  const base = (pedido || 'busca')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `relatorio-fornecedores-${base || 'busca'}-${quando.toISOString().slice(0, 10)}`;
}
