import { CalculadoraErro, chamarEm, comCache, urlCalculadoraPropria } from './calculadora';

// Calculadora oficial do Simples Nacional (Receita Federal / Serpro, código
// aberto, NT 2026.005). Sub-projeto 99. Não existe versão pública aberta: roda
// só na nossa cópia (services/calculadora-rtc no Railway,
// CALCULADORA_RTC_PROPRIA_URL). Sem ela, a opção some da tela.
//
// O que o motor faz: valida a atividade do Simples e a classificação do item
// e calcula a CBS e o IBS que a empresa do Simples recolhe no DAS
// (vCBSSN/vIBSSN). É esse valor que o comprador do regime regular pode tomar
// como crédito. O motor NÃO descobre a alíquota efetiva do fornecedor (ela
// depende do faturamento dos últimos 12 meses): quem chama informa pCBSSN e
// pIBSSN, que vêm na nota do fornecedor ou do contador dele.

const UM_DIA = 24 * 60 * 60 * 1000;

export function simplesDisponivel(): boolean {
  return urlCalculadoraPropria() !== null;
}

function base(): string {
  const u = urlCalculadoraPropria();
  if (!u) throw new CalculadoraErro('A calculadora do Simples Nacional não está configurada.', 503);
  return `${u}/api/calculadora`;
}

export type AtividadeSimples = {
  codigo: string;
  descricao: string;
  anexo: string;
};

type AtividadeBruta = {
  codigo: string;
  descricao: string;
  rotuloAnexo?: string;
  disponivel?: boolean;
  admissivelNoDocumento?: boolean;
};

/** Atividades do Simples que podem sair em NF-e na data (catálogo oficial). */
export function atividadesSimples(data: string): Promise<AtividadeSimples[]> {
  return comCache(`sn-ativ:${data}`, UM_DIA, async () => {
    const lista = await chamarEm<AtividadeBruta[]>(base(), `/simples-nacional/atividades?data=${data}&tpDoc=55`);
    return lista
      .filter((a) => a.disponivel !== false && a.admissivelNoDocumento !== false)
      .map((a) => ({ codigo: a.codigo, descricao: a.descricao, anexo: a.rotuloAnexo ?? '' }));
  });
}

export type ItemSimples = {
  numero: number;
  cAtivSN: string;
  cClassTrib: string;
  baseCalculo: number;
  pCBSSN: number;
  pIBSSN: number;
};

export type ObjetoSimples = {
  nObj: number;
  estadoItem: string;
  tribCalc?: { vCBSSN?: string; vIBSSN?: string; pCBSSN?: string; pIBSSN?: string; tpRBSNDescricao?: string };
  erros?: Array<{ code?: string; title?: string; detail?: string }>;
};

export type RespostaSimples = { objetos: ObjetoSimples[] };

const dec = (n: number) => n.toFixed(4);

/** Calcula a CBS e o IBS do fornecedor do Simples (empresa optante, CRT 1). */
export function calcularSimples(data: string, itens: ItemSimples[]): Promise<RespostaSimples> {
  return chamarEm<RespostaSimples>(
    base(),
    '/observabilidade/simples-nacional',
    {
      method: 'POST',
      body: JSON.stringify({
        id: `2bsupplyia-${Date.now()}`,
        versao: '2.0.0',
        data,
        tpDoc: '55',
        CRT: '1',
        itens: itens.map((it) => ({
          numero: it.numero,
          cAtivSN: it.cAtivSN,
          cClassTrib: it.cClassTrib,
          baseCalculo: it.baseCalculo.toFixed(2),
          valorImpostoSeletivo: '0.00',
          pCBSSN: dec(it.pCBSSN),
          pIBSSN: dec(it.pIBSSN),
        })),
      }),
    },
    2,
  );
}
