// Proc2Pay — processo de exemplo (tela de demonstração). Totalmente em memória,
// sem DB nem LLM: serve para mostrar/vender o fluxo de ponta a ponta antes de
// abrir um processo real. Decisão do briefing: "tela de exemplo".

import type { Proc2PayProcess, Proc2PayStageRun, StageId } from './types';

const REQ = {
  solicitante: 'Manutenção Industrial',
  categoria: 'MRO — válvulas',
  criticidade: 'alta' as const,
  descricao:
    'Reposição de válvulas de esfera para a linha de vapor da caldeira 2 (parada programada em 30 dias).',
  itens: [
    { descricao: 'Válvula esfera 2" inox 316, classe 150', qtd: 10, unidade: 'un' },
    { descricao: 'Válvula esfera 1.1/2" inox 316, classe 150', qtd: 6, unidade: 'un' },
  ],
  prazoDesejado: '30 dias',
  orcamentoEstimado: 48000,
};

const ARTIFACTS: Record<string, string> = {
  analise_critica: `## Análise crítica da requisição

**Pronta para seguir** — com 2 ajustes recomendados.

- ✅ Item, quantidade e prazo claros (parada em 30 dias).
- ⚠️ Faltou a **classe de pressão** explícita das válvulas de 1.1/2" (assumido cl.150 por simetria — confirmar).
- ⚠️ Exigir **certificado de material 3.1** no critério (item de vapor, segurança).`,

  validacao_escopo: `## Validação técnica do escopo

**Objeto:** válvulas de esfera, corpo inox 316, classe 150, para linha de vapor — 10× 2" + 6× 1.1/2".

### Critérios técnicos de aceitação
- Material com **certificado 3.1** (EN 10204).
- Vedação compatível com vapor saturado.
- Rastreabilidade de lote.
- Atendimento à norma da planta para linha de vapor.`,

  estrategia: `## Estratégia de compra — Matriz de Kraljic

**Quadrante: Gargalo (bottleneck).** Baixo impacto no resultado financeiro, porém **alto risco de suprimento** (item técnico, inox 316, prazo crítico de parada).

**Postura recomendada:** garantir o fornecimento — qualificar 2+ fontes, contrato de disponibilidade, estoque de segurança. Preço é secundário diante do risco de parada da caldeira.

- Nº de fornecedores: ≥ 2 homologados
- Alavanca principal: **prazo e disponibilidade**, não preço
- Armadilha a evitar: fonte única em item de parada crítica`,

  selecao_fornecedores: `## Seleção de fornecedores

**Critérios:** homologação em inox 316, certificado de material (3.1), prazo ≤ 25 dias, atendimento técnico.

| Fornecedor | Perfil | Por que cotar |
|---|---|---|
| Válvulas Industriais SA | Fabricante | Estoque pronto, certificado 3.1 |
| Inox Fluid Control | Distribuidor | Prazo curto, atende a região |
| TecVal Componentes | Fabricante | Preço competitivo, lead maior |`,

  rfq_rfp: `## RFQ — Válvulas de esfera inox 316

**Objeto:** fornecimento de 16 válvulas de esfera (10× 2" + 6× 1.1/2"), classe 150, inox 316, com certificado de material 3.1.

**Critérios de avaliação:** prazo de entrega (peso 40%), conformidade técnica (30%), preço (20%), condição de pagamento (10%).

**Condições pedidas:** entrega ≤ 25 dias, validade da proposta 15 dias, pagamento 28 ddl.

**Instruções:** responder com preço unitário, frete, prazo e certificações até [data].`,

  recebimento_propostas: `### Propostas recebidas

\`\`\`
Válvulas Industriais SA — R$ 2.850/un (2") · R$ 2.100/un (1.1/2") · frete CIF · 18 dias · 28 ddl
Inox Fluid Control     — R$ 2.990/un (2") · R$ 2.250/un (1.1/2") · frete CIF · 12 dias · à vista
TecVal Componentes     — R$ 2.640/un (2") · R$ 1.980/un (1.1/2") · frete FOB · 35 dias · 28 ddl
\`\`\``,

  equalizacao: `## Equalização técnica e comercial

**Recomendação: Válvulas Industriais SA** — melhor equilíbrio entre TCO e risco de prazo (item de parada crítica).

### Ranking (TCO comparável)
1. **Válvulas Industriais SA** — ≈ R$ 41.100 · 18 dias · CIF · 28 ddl
2. **TecVal Componentes** — ≈ R$ 38.280 (mais barato) · **35 dias (risco para a parada)** · FOB
3. **Inox Fluid Control** — ≈ R$ 43.400 · 12 dias · à vista

> TecVal é o menor preço, mas o prazo de 35 dias estoura a janela da parada (30 dias) — desclassificado pelo risco.

### Pontos de negociação
- Reduzir frete CIF / antecipar 2 dias o prazo
- Pagamento 35 ddl em vez de 28`,

  negociacao: `## Plano de negociação — Válvulas Industriais SA

**Objetivo:** travar 16 dias de prazo + 35 ddl, mantendo preço.

- **BATNA:** Inox Fluid Control (12 dias, porém à vista e + caro).
- **Alavancas:** volume recorrente da planta, pagamento à vista parcial em troca de desconto de 3%.
- **Concessões aceitáveis:** abrir mão dos 35 ddl se o prazo cair para 15 dias.

**Acordo-alvo:** 15 dias úteis, 28 ddl, desconto de 2% no total.`,

  aprovacao: `Decisão de aprovação: **aprovado**

> Dentro do orçamento (R$ 48k) e prazo da parada. Fornecedor homologado. Liberar emissão da PO.`,

  follow_up: `## Follow-up da entrega

| Marco | Prazo | Status |
|---|---|---|
| Confirmação da PO pelo fornecedor | D+1 | ✅ confirmado |
| Produção / separação | D+8 | em andamento |
| Expedição (com certificado 3.1) | D+12 | pendente |
| Recebimento e conferência | D+15 | pendente |

**Cadência:** cobrar status a cada 3 dias úteis; alertar Manutenção se a expedição passar de D+13 (risco para a parada).`,

  avaliacao: `## Avaliação do fornecedor — Válvulas Industriais SA

| Critério | Nota |
|---|---|
| Qualidade / conformidade | 9 |
| Prazo / cumprimento | 8 |
| Preço / competitividade | 7 |
| Atendimento | 9 |

**Score consolidado: 84/100 — Estratégico (manter/desenvolver).** Cumpriu prazo da parada com certificação correta; candidato a acordo de disponibilidade para itens de caldeira.`,

  emissao_po: `## Pedido de Compra — PO-2026-000482

**Fornecedor:** Válvulas Industriais SA
**Condição:** 28 ddl · **Prazo:** 15 dias úteis · **Frete:** CIF

| Item | Qtd | Unitário | Total |
|---|---|---|---|
| Válvula esfera 2" inox 316 cl.150 | 10 | R$ 2.793 | R$ 27.930 |
| Válvula esfera 1.1/2" inox 316 cl.150 | 6 | R$ 2.058 | R$ 12.348 |
| **Total** | | | **R$ 40.278** |

**Observações:** exigir certificado de material 3.1 na entrega. Entregar na doca 2, A/C Manutenção.

_PO gerada pelo Proc2Pay — enviar ao fornecedor por e-mail para confirmação._`,
};

const STAGE_OUTPUTS: Partial<Record<StageId, unknown>> = {
  analise_critica: { ok: true, gaps: ['Confirmar classe de pressão da válvula 1.1/2"', 'Exigir certificado 3.1'] },
  validacao_escopo: { resumo: 'Válvulas esfera inox 316 cl.150 p/ vapor', criterios: ['Certificado 3.1', 'Rastreabilidade de lote'] },
  estrategia: { quadranteKraljic: 'gargalo', postura: 'Garantir fornecimento com 2+ fontes' },
  selecao_fornecedores: [
    { nome: 'Válvulas Industriais SA', homologado: true },
    { nome: 'Inox Fluid Control', homologado: true },
    { nome: 'TecVal Componentes', homologado: false },
  ],
  rfq_rfp: { documento: 'RFQ enviada', geradoEm: '2026-06-01T12:00:00Z' },
  recebimento_propostas: [{ texto: '3 propostas recebidas' }],
  equalizacao: { vencedor: { nome: 'Válvulas Industriais SA' }, pontos_negociacao: ['frete', 'prazo'] },
  negociacao: { acordo: '15 dias úteis, 28 ddl, -2%' },
  aprovacao: { decision: 'aprovado' },
  emissao_po: { numero: 'PO-2026-000482', valor: 40278, fornecedor: { nome: 'Válvulas Industriais SA' } },
  follow_up: [
    { marco: 'Confirmação da PO', status: 'confirmado' },
    { marco: 'Expedição', status: 'pendente' },
  ],
  avaliacao: { score: 84, resumo: 'Estratégico — manter/desenvolver' },
};

const ORDER: StageId[] = [
  'requisicao',
  'analise_critica',
  'validacao_escopo',
  'estrategia',
  'selecao_fornecedores',
  'rfq_rfp',
  'recebimento_propostas',
  'equalizacao',
  'negociacao',
  'aprovacao',
  'emissao_po',
  'follow_up',
  'avaliacao',
];

export function buildExampleProcess(): {
  process: Proc2PayProcess;
  stageRuns: Proc2PayStageRun[];
} {
  const context: Record<string, unknown> = { requisicao: REQ };
  for (const [stage, out] of Object.entries(STAGE_OUTPUTS)) context[stageProduces(stage as StageId)] = out;

  const process: Proc2PayProcess = {
    id: 'exemplo',
    user_id: 'exemplo',
    numero: 'PC-2026-000482',
    titulo: 'Reposição de válvulas — caldeira 2 (exemplo)',
    status: 'emissao_po',
    state: 'concluido',
    origem: 'exemplo',
    requisicao: REQ,
    context: context as Proc2PayProcess['context'],
    is_example: true,
    created_at: '2026-06-01T12:00:00Z',
    updated_at: '2026-06-01T12:00:00Z',
  };

  const stageRuns: Proc2PayStageRun[] = ORDER.filter((s) => ARTIFACTS[s]).map((stage, i) => ({
    id: `ex-${i}`,
    process_id: 'exemplo',
    user_id: 'exemplo',
    stage,
    assistant_run_id: null,
    status: 'concluido',
    input: null,
    output: (STAGE_OUTPUTS[stage] ?? null) as Record<string, unknown> | null,
    artifact_md: ARTIFACTS[stage] ?? null,
    error_message: null,
    created_at: '2026-06-01T12:00:00Z',
    updated_at: '2026-06-01T12:00:00Z',
  }));

  return { process, stageRuns };
}

// Mapa local etapa→chave de context (evita import circular com stages.ts).
function stageProduces(stage: StageId): string {
  const m: Record<string, string> = {
    requisicao: 'requisicao',
    analise_critica: 'analise_critica',
    validacao_escopo: 'escopo',
    estrategia: 'estrategia',
    selecao_fornecedores: 'fornecedores',
    rfq_rfp: 'rfp',
    recebimento_propostas: 'propostas',
    equalizacao: 'equalizacao',
    negociacao: 'negociacao',
    aprovacao: 'aprovacao',
    emissao_po: 'po',
    follow_up: 'entregas',
    avaliacao: 'avaliacao',
  };
  return m[stage] ?? stage;
}
