import {
  calcularRegimeGeral,
  classificacoes,
  infoNcm,
  ncmAplicavel,
  type Classificacao,
} from './calculadora';
import { calcularSimples } from './simples';
import {
  aliquotasSimplesDoAno,
  CANDIDATAS_SUGESTAO,
  CENARIOS_REFORMA,
  dataDoFatoGerador,
  interpretarResposta,
  interpretarSimples,
  itensParaMotor,
  totalizar,
  type FornecedorSimples,
  type ItemCalculo,
  type Referencia,
  type RegimeComprador,
  type ResultadoItemAno,
  type TotalAno,
} from './cenarios';

// Orquestração da Calculadora da Reforma no servidor (sub-projeto 96).

export type Sugestao = {
  ncm: string;
  descricaoNcm: string;
  impostoSeletivo: boolean;
  /** Classificações com redução em que o NCM se enquadra (motor oficial). */
  opcoes: Array<Pick<Classificacao, 'codigo' | 'cst' | 'descricao' | 'reducaoCbs'>>;
};

async function emLotes<T, R>(lista: readonly T[], tamanho: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < lista.length; i += tamanho) {
    out.push(...(await Promise.all(lista.slice(i, i + tamanho).map(fn))));
  }
  return out;
}

export async function sugerirClassificacao(ncm: string): Promise<Sugestao> {
  const n = ncm.replace(/\D/g, '');
  const [info, todas] = await Promise.all([infoNcm(n), classificacoes()]);
  const porCodigo = new Map(todas.map((c) => [c.codigo, c]));
  const validas = await emLotes(CANDIDATAS_SUGESTAO, 5, async (cod) => ((await ncmAplicavel(cod, n)) ? cod : null));
  const opcoes = validas
    .filter((c): c is (typeof CANDIDATAS_SUGESTAO)[number] => !!c && porCodigo.has(c))
    .map((c) => {
      const cl = porCodigo.get(c)!;
      return { codigo: cl.codigo, cst: cl.cst, descricao: cl.descricao, reducaoCbs: cl.reducaoCbs };
    })
    .sort((a, b) => b.reducaoCbs - a.reducaoCbs);
  return {
    ncm: n,
    descricaoNcm: info?.descricao ?? '',
    impostoSeletivo: info?.impostoSeletivo ?? false,
    opcoes,
  };
}

export type ResultadoCalculo = {
  anos: Array<{
    ano: number;
    rotulo: string;
    oficial: boolean;
    itens: ResultadoItemAno[];
    total: TotalAno;
  }>;
};

export async function calcularCenarios(args: {
  uf: string;
  municipio: number;
  regime: RegimeComprador;
  referencia: Referencia;
  itens: ItemCalculo[];
  /** Fornecedor do Simples Nacional: calcula pelo motor oficial do Simples. */
  fornecedorSimples?: FornecedorSimples | null;
}): Promise<ResultadoCalculo> {
  const todas = await classificacoes();
  const mapa = new Map(todas.map((c) => [c.codigo, c]));
  const fs = args.fornecedorSimples ?? null;
  // Um cálculo por cenário, em paralelo: o motor responde em ~1 s.
  const anos = await Promise.all(
    CENARIOS_REFORMA.map(async (cen) => {
      let itens: ResultadoItemAno[];
      if (fs) {
        const aliq = aliquotasSimplesDoAno(cen.ano, fs, args.referencia);
        const resposta = aliq
          ? await calcularSimples(
              dataDoFatoGerador(cen.ano).slice(0, 10),
              args.itens.map((it, i) => ({
                numero: i + 1,
                cAtivSN: fs.atividade,
                cClassTrib: it.cClassTrib,
                baseCalculo: it.valor,
                pCBSSN: aliq.pCBSSN,
                pIBSSN: aliq.pIBSSN,
              })),
            )
          : null;
        itens = interpretarSimples({ resposta, itens: args.itens, ano: cen.ano, regime: args.regime, classificacoes: mapa });
      } else {
        const resposta = await calcularRegimeGeral({
          dhFatoGerador: dataDoFatoGerador(cen.ano),
          municipio: args.municipio,
          uf: args.uf,
          itens: itensParaMotor(args.itens, cen.ano, args.referencia),
        });
        itens = interpretarResposta({
          resposta,
          itens: args.itens,
          ano: cen.ano,
          regime: args.regime,
          classificacoes: mapa,
        });
      }
      return { ano: cen.ano, rotulo: cen.rotulo, oficial: cen.oficial, itens, total: totalizar(args.itens, itens) };
    }),
  );
  return { anos };
}
