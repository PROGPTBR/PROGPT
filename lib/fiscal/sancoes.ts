// Consulta de sanções/inidoneidade no Portal da Transparência (CGU):
// CEIS (Empresas Inidôneas e Suspensas) + CNEP (Empresas Punidas).
// API oficial gratuita — base https://api.portaldatransparencia.gov.br/api-de-dados,
// header `chave-api-dados`. Token grátis: portaldatransparencia.gov.br/api-de-dados/cadastrar-email
//
// Fail-soft: sem PORTAL_TRANSPARENCIA_TOKEN, a feature fica desligada e a
// homologação segue sem o bloco de sanções. NUNCA lança pro caller.

import { cached } from './cache';

const BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados';
const TIMEOUT_MS = 15_000;

export type Sancao = {
  fonte: 'CEIS' | 'CNEP';
  nome: string;
  tipo: string;
  orgao: string;
  dataInicio: string;
  dataFim: string;
};

export type SancoesResult = {
  enabled: boolean; // token configurado?
  consultado: boolean; // a API respondeu (mesmo que vazio)?
  sancoes: Sancao[];
  error?: string;
};

export function isSancoesEnabled(): boolean {
  return !!process.env.PORTAL_TRANSPARENCIA_TOKEN?.trim();
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

async function fetchSancao(
  path: '/ceis' | '/cnep',
  cnpjDigits: string,
): Promise<unknown[]> {
  const token = process.env.PORTAL_TRANSPARENCIA_TOKEN!.trim();
  const res = await fetch(
    `${BASE}${path}?cnpjSancionado=${cnpjDigits}&pagina=1`,
    {
      headers: { 'chave-api-dados': token, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Portal Transparência ${path}: ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

// A estrutura dos registros varia; extraímos defensivamente. O sinal crítico
// (existe sanção?) é robusto independentemente dos detalhes de campo.
function mapSancao(fonte: 'CEIS' | 'CNEP', raw: unknown): Sancao {
  const o = (raw ?? {}) as Record<string, unknown>;
  const get = (v: unknown): string =>
    typeof v === 'string' ? v : v && typeof v === 'object' && 'nome' in v
      ? String((v as Record<string, unknown>).nome ?? '')
      : v && typeof v === 'object' && 'descricaoResumida' in v
        ? String((v as Record<string, unknown>).descricaoResumida ?? '')
        : '';
  const sancionado = (o.sancionado ?? {}) as Record<string, unknown>;
  return {
    fonte,
    nome: get(sancionado.nome) || get(o.nomeSancionado) || get(o.nome),
    tipo: get(o.tipoSancao) || get(o.categoriaSancao) || get(o.descricaoFundamentacao),
    orgao: get(o.orgaoSancionador),
    dataInicio: typeof o.dataInicioSancao === 'string' ? o.dataInicioSancao : '',
    dataFim: typeof o.dataFimSancao === 'string' ? o.dataFimSancao : '',
  };
}

export function consultarSancoes(cnpj: string): Promise<SancoesResult> {
  const d = onlyDigits(cnpj);
  return cached(`sancoes:${d}`, async () => {
    const result: SancoesResult = {
      enabled: isSancoesEnabled(),
      consultado: false,
      sancoes: [],
    };
    if (!result.enabled) return result;
    try {
      const [ceis, cnep] = await Promise.all([
        fetchSancao('/ceis', d),
        fetchSancao('/cnep', d),
      ]);
      result.consultado = true;
      result.sancoes = [
        ...ceis.map((r) => mapSancao('CEIS', r)),
        ...cnep.map((r) => mapSancao('CNEP', r)),
      ];
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
    return result;
  });
}
