import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import { getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { consultarCnpj, isFiscalEnabled } from '@/lib/fiscal/client';
import type { PropostaTributaria } from './calculo';

// Lê as propostas coladas/importadas e devolve os dados fiscais de cada uma
// para o comprador conferir na tela antes do cálculo. Tudo que a proposta não
// diz volta vazio (null) e a tela mostra "não informado": a IA não chuta
// alíquota.
//
// Esquema 100% obrigatório (nulos em vez de opcionais): o tier de geração em
// produção liga o modo estrito do structured output (ver
// tests/lib/llm/structured-output-strict.test.ts).

export const ExtracaoTributariaSchema = z.object({
  propostas: z.array(
    z.object({
      fornecedor: z.string(),
      cnpj: z.string().nullable(),
      uf: z.string().nullable(),
      regimeFornecedor: z.enum(['regular', 'simples', 'simples_hibrido', 'nao_informado']),
      valorProdutos: z.number().nullable(),
      ipiPct: z.number().nullable(),
      icmsPct: z.number().nullable(),
      pisCofinsPct: z.number().nullable(),
      stValor: z.number().nullable(),
      freteValor: z.number().nullable(),
      observacoes: z.string(),
    }),
  ),
});
export type ExtracaoTributaria = z.infer<typeof ExtracaoTributariaSchema>;

const SYSTEM = `Você extrai dados fiscais de propostas comerciais de fornecedores brasileiros.

Para CADA fornecedor (cada documento ou bloco de proposta), devolva:
- fornecedor: razão social ou nome como aparece.
- cnpj: só se aparecer no texto; senão null.
- uf: sigla do estado do fornecedor (pelo endereço ou CNPJ); senão null.
- regimeFornecedor: "simples_hibrido" se a empresa é do Simples Nacional mas OPTOU pelo regime regular do IBS e da CBS ("optante pelo regime regular do IBS/CBS", "Simples híbrido", "IBS e CBS apurados fora do DAS"); "simples" se o texto disser Simples Nacional, ME/EPP optante, "documento emitido por ME ou EPP optante pelo Simples", "não gera direito a crédito fiscal de IPI"; "regular" se mostrar destaque normal de ICMS/PIS/Cofins ou disser Lucro Real/Presumido; senão "nao_informado".
- valorProdutos: valor TOTAL dos produtos ou serviços da proposta, em reais, SEM IPI e SEM ICMS-ST (o ICMS normal já está embutido no preço). Se houver vários itens, some. Se só houver preço unitário e quantidade, multiplique.
- ipiPct, icmsPct: alíquotas em % (ex.: 18 para 18%). Fornecedor do Simples: o percentual de crédito de ICMS que a nota permite aproveitar ("permite o aproveitamento do crédito de ICMS de X%") vai em icmsPct. Se a proposta disser só "impostos inclusos" sem alíquota, null.
- pisCofinsPct: só se a proposta informar PIS/Cofins (ex.: 9,25 ou 3,65); fornecedor do Simples sempre null. Nunca coloque aqui o crédito de ICMS.
- stValor: valor de ICMS-ST em reais, se houver; senão null.
- freteValor: valor do frete em reais; se for CIF/incluso, 0; se não disser, null.
- observacoes: até 2 frases com o que importa para impostos (ex.: "impostos inclusos sem alíquota", "frete FOB a combinar", "ICMS diferido").

Nunca invente número. Não use travessão.`;

const n = (v: number | null, padrao: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : padrao);
const so2 = (s: string | null) => (s ?? '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();

/** Converte a extração em propostas editáveis, com padrões explícitos para o que faltou. */
export function paraPropostas(ex: ExtracaoTributaria): (PropostaTributaria & { observacoes: string; faltando: string[] })[] {
  return ex.propostas.slice(0, 8).map((p) => {
    const faltando: string[] = [];
    if (p.valorProdutos == null) faltando.push('valor');
    if (p.icmsPct == null) faltando.push('ICMS');
    if (p.regimeFornecedor === 'nao_informado') faltando.push('regime do fornecedor');
    const regime =
      p.regimeFornecedor === 'simples' || p.regimeFornecedor === 'simples_hibrido' ? p.regimeFornecedor : 'regular';
    const simples = regime !== 'regular';
    return {
      fornecedor: p.fornecedor.trim().slice(0, 200) || 'Fornecedor',
      cnpj: (p.cnpj ?? '').replace(/[^\d./-]/g, '').slice(0, 20),
      uf: so2(p.uf),
      regimeFornecedor: regime,
      valorProdutos: n(p.valorProdutos, 0),
      ipiPct: n(p.ipiPct, 0),
      icmsPct: n(p.icmsPct, simples ? 0 : 18),
      // No Simples o PIS/Cofins está no DAS: não há alíquota embutida a separar.
      pisCofinsPct: simples ? 0 : n(p.pisCofinsPct, 9.25),
      stValor: n(p.stValor, 0),
      freteValor: n(p.freteValor, 0),
      reducaoReformaPct: 0,
      observacoes: p.observacoes.trim().slice(0, 400),
      faltando,
    };
  });
}

/** Confirma na Receita (serviço fiscal) quem é do Simples. Fail-soft: sem serviço, nada muda. */
async function confirmarRegimes(props: ReturnType<typeof paraPropostas>): Promise<void> {
  if (!isFiscalEnabled()) return;
  await Promise.all(
    props.map(async (p) => {
      const digits = p.cnpj.replace(/\D/g, '');
      if (digits.length !== 14) return;
      try {
        const dados = await Promise.race([
          consultarCnpj(digits),
          new Promise<null>((r) => setTimeout(() => r(null), 12_000)),
        ]);
        if (!dados) return;
        if (typeof dados.simples_nacional === 'boolean') {
          // A Receita diz se é do Simples, mas não se optou pelo regime
          // regular do IBS/CBS (isso só aparece no Portal do Simples, com
          // captcha): "híbrido" lido na proposta é mantido.
          p.regimeFornecedor = dados.simples_nacional
            ? p.regimeFornecedor === 'simples_hibrido'
              ? 'simples_hibrido'
              : 'simples'
            : 'regular';
          p.faltando = p.faltando.filter((f) => f !== 'regime do fornecedor');
          if (dados.simples_nacional && p.pisCofinsPct === 9.25) p.pisCofinsPct = 0;
        }
        if (!p.uf && dados.endereco && 'uf' in dados.endereco) {
          p.uf = so2(String((dados.endereco as { uf?: string }).uf ?? ''));
        }
      } catch {
        // Serviço fora ou CNPJ não encontrado: fica o que veio da proposta.
      }
    }),
  );
}

export async function extrairPropostasTributarias(texto: string) {
  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');
  const out = await generateObject({
    model: openai(model),
    system: SYSTEM,
    schema: ExtracaoTributariaSchema,
    messages: [{ role: 'user', content: texto.slice(0, 120_000) }],
  });
  void recordApiUsage({
    provider: 'openai',
    operation: 'assistant-tributario-extract',
    model,
    tokensIn: out.usage.promptTokens,
    tokensOut: out.usage.completionTokens,
    callCount: 1,
  });
  const propostas = paraPropostas(out.object);
  await confirmarRegimes(propostas);
  return propostas;
}
