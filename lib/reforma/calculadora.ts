// Cliente da Calculadora de Tributos oficial da Reforma Tributária (Receita
// Federal, Plataforma RTC). É o mesmo motor que a Receita usa: CBS, IBS
// estadual e IBS municipal por item, com redução, memória de cálculo e base
// legal. Sub-projeto 96.
//
// Por padrão usa a calculadora pública da Receita. A Receita também distribui
// a calculadora para rodar no nosso próprio servidor (Java, com a base de
// regras embarcada, sem enviar dados): basta subir o serviço e apontar
// CALCULADORA_RTC_URL para ele, sem mudar nada no código.

const PADRAO = 'https://consumo.tributos.gov.br/servico/calcular-tributos-consumo/api/calculadora';
const TIMEOUT_MS = 20_000;

export function urlCalculadora(): string {
  return (process.env.CALCULADORA_RTC_URL || PADRAO).replace(/\/+$/, '');
}

export function calculadoraLigada(): boolean {
  return process.env.CALCULADORA_RTC_ENABLED !== 'false';
}

export class CalculadoraErro extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detalhe?: string,
  ) {
    super(message);
  }
}

async function chamar<T>(path: string, init?: RequestInit, tentativas = 2): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < tentativas; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${urlCalculadora()}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
        cache: 'no-store',
      });
      const texto = await res.text();
      if (!res.ok) {
        let detalhe: string | undefined;
        try {
          const j = JSON.parse(texto) as { detail?: string; title?: string };
          detalhe = j.detail || j.title;
        } catch {
          detalhe = texto.slice(0, 300);
        }
        // 4xx é resposta do motor (dado inválido): não adianta repetir.
        if (res.status < 500) throw new CalculadoraErro('A calculadora oficial recusou os dados.', res.status, detalhe);
        ultimo = new CalculadoraErro('A calculadora oficial está fora do ar.', res.status, detalhe);
        continue;
      }
      return JSON.parse(texto) as T;
    } catch (err) {
      if (err instanceof CalculadoraErro && err.status < 500) throw err;
      ultimo = err;
    } finally {
      clearTimeout(t);
    }
  }
  if (ultimo instanceof CalculadoraErro) throw ultimo;
  throw new CalculadoraErro('Não foi possível falar com a calculadora oficial.', 503, String(ultimo));
}

// --- Cache em memória (o processo do Railway é de longa duração) ------------

const cache = new Map<string, { ate: number; valor: unknown }>();
const UM_DIA = 24 * 60 * 60 * 1000;

async function comCache<T>(chave: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const c = cache.get(chave);
  if (c && c.ate > Date.now()) return c.valor as T;
  const valor = await fn();
  cache.set(chave, { ate: Date.now() + ttl, valor });
  return valor;
}

export function limparCacheCalculadora(): void {
  cache.clear();
}

// --- Dados abertos -----------------------------------------------------------

export type VersaoCalculadora = {
  versaoApp: string;
  versaoDb: string;
  descricaoVersaoDb?: string;
  dataVersaoDb: string;
  ambiente?: string;
};

export function versaoCalculadora(): Promise<VersaoCalculadora> {
  return comCache('versao', 60 * 60 * 1000, () => chamar<VersaoCalculadora>('/dados-abertos/versao'));
}

export type Uf = { sigla: string; nome: string; codigo: number };
export type Municipio = { codigo: number; nome: string };

export function ufs(): Promise<Uf[]> {
  return comCache('ufs', UM_DIA, () => chamar<Uf[]>('/dados-abertos/ufs'));
}

export function municipios(siglaUf: string): Promise<Municipio[]> {
  const uf = siglaUf.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  return comCache(`mun:${uf}`, UM_DIA, () => chamar<Municipio[]>(`/dados-abertos/ufs/municipios?siglaUf=${uf}`));
}

type ClassificacaoBruta = {
  codigo: string;
  descricao: string;
  descricaoTratamentoTributario?: string;
  nomenclatura?: string;
  tipoAliquota?: string;
  percentualReducaoCbs?: number;
  percentualReducaoIbsUf?: number;
  percentualReducaoIbsMun?: number;
  indicaApropriacaoCreditoAdquirenteCbs?: boolean;
  indicaApropriacaoCreditoAdquirenteIbs?: boolean;
  creditoOperacaoAntecedente?: string;
  tiposDfeClassificacao?: Array<{ tipo: number }>;
};

type SituacaoBruta = { codigo: string; descricao: string; classificacoesTributarias: Array<{ codigo: string }> };

export type Classificacao = {
  codigo: string;
  cst: string;
  cstDescricao: string;
  descricao: string;
  tratamento: string;
  nomenclatura: string;
  reducaoCbs: number;
  reducaoIbsUf: number;
  reducaoIbsMun: number;
  creditoCbs: boolean;
  creditoIbs: boolean;
};

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Classificações tributárias (cClassTrib) oficiais que valem para NF-e,
 *  com o CST de cada uma. */
export function classificacoes(data = hoje()): Promise<Classificacao[]> {
  return comCache(`class:${data}`, UM_DIA, async () => {
    const [lista, situacoes] = await Promise.all([
      chamar<ClassificacaoBruta[]>(`/dados-abertos/classificacoes-tributarias/cbs-ibs?data=${data}`),
      chamar<SituacaoBruta[]>(`/dados-abertos/situacoes-tributarias/cbs-ibs?data=${data}&siglaDfe=NFE`),
    ]);
    const cstDe = new Map<string, { codigo: string; descricao: string }>();
    for (const s of situacoes) for (const c of s.classificacoesTributarias) cstDe.set(c.codigo, { codigo: s.codigo, descricao: s.descricao });
    return lista
      .filter((c) => cstDe.has(c.codigo) && (c.tiposDfeClassificacao ?? []).some((t) => t.tipo === 55))
      .map((c) => ({
        codigo: c.codigo,
        cst: cstDe.get(c.codigo)!.codigo,
        cstDescricao: cstDe.get(c.codigo)!.descricao,
        descricao: c.descricao,
        tratamento: c.descricaoTratamentoTributario ?? '',
        nomenclatura: c.nomenclatura ?? '',
        reducaoCbs: c.percentualReducaoCbs ?? 0,
        reducaoIbsUf: c.percentualReducaoIbsUf ?? 0,
        reducaoIbsMun: c.percentualReducaoIbsMun ?? 0,
        creditoCbs: !!c.indicaApropriacaoCreditoAdquirenteCbs,
        creditoIbs: !!c.indicaApropriacaoCreditoAdquirenteIbs,
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  });
}

export type InfoNcm = {
  descricao: string;
  impostoSeletivo: boolean;
};

export function infoNcm(ncm: string, data = hoje()): Promise<InfoNcm | null> {
  const n = ncm.replace(/\D/g, '');
  if (n.length !== 8) return Promise.resolve(null);
  return comCache(`ncm:${n}:${data}`, UM_DIA, async () => {
    try {
      const r = await chamar<{ subitem?: string; subposicao?: string; posicao?: string; tributadoPeloImpostoSeletivo?: boolean }>(
        `/dados-abertos/ncm?ncm=${n}&data=${data}`,
      );
      const descricao = [r.posicao, r.subitem && r.subitem !== r.subposicao ? r.subitem : r.subposicao]
        .filter(Boolean)
        .join(' · ')
        .replace(/<[^>]+>/g, '');
      return { descricao, impostoSeletivo: !!r.tributadoPeloImpostoSeletivo };
    } catch (err) {
      if (err instanceof CalculadoraErro && err.status < 500) return null;
      throw err;
    }
  });
}

/** O NCM pode usar esta classificação (ex.: está no anexo da redução)? */
export function ncmAplicavel(cClassTrib: string, ncm: string, data = hoje()): Promise<boolean> {
  const n = ncm.replace(/\D/g, '');
  return comCache(`apl:${cClassTrib}:${n}:${data}`, UM_DIA, async () => {
    try {
      const r = await chamar<{ valido?: boolean }>(
        `/dados-abertos/classificacoes-tributarias/ncm-aplicavel?cClassTrib=${cClassTrib}&ncm=${n}&dataOcorrenciaFatoGerador=${data}`,
      );
      return !!r.valido;
    } catch (err) {
      if (err instanceof CalculadoraErro && err.status < 500) return false;
      throw err;
    }
  });
}

// --- Cálculo -------------------------------------------------------------------

export type ItemOperacao = {
  numero: number;
  ncm?: string;
  cst: string;
  cClassTrib: string;
  baseCalculo: number;
  quantidade?: number;
  unidade?: string;
  aliquotasNominais?: { cbs: number; ibsEstadual: number; ibsMunicipal: number };
};

export type OperacaoEntrada = {
  dhFatoGerador: string;
  municipio: number;
  uf: string;
  itens: ItemOperacao[];
};

type GrupoTributo = { vBC?: string; gRed?: { pRedAliq?: string; pAliqEfet?: string }; memoriaCalculo?: string } & Record<string, unknown>;

export type ObjetoCalculado = {
  nObj: number;
  tribCalc: {
    IBSCBS?: {
      CST: string;
      cClassTrib: string;
      gIBSCBS?: {
        vBC: string;
        gIBSUF?: GrupoTributo & { pIBSUF?: string; vIBSUF?: string };
        gIBSMun?: GrupoTributo & { pIBSMun?: string; vIBSMun?: string };
        vIBS?: string;
        gCBS?: GrupoTributo & { pCBS?: string; vCBS?: string };
      };
    };
  };
};

export type RespostaCalculo = { objetos: ObjetoCalculado[] };

export function calcularRegimeGeral(op: OperacaoEntrada): Promise<RespostaCalculo> {
  return chamar<RespostaCalculo>(
    '/regime-geral',
    {
      method: 'POST',
      body: JSON.stringify({
        id: `progpt-${Date.now()}`,
        versao: '0.0.1',
        tpDoc: 55,
        ...op,
      }),
    },
    // Cálculo é POST sem efeito colateral: uma nova tentativa é segura.
    2,
  );
}
