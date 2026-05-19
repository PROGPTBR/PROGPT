# Análise Financeira de Fornecedor — {{fornecedor}}

> CNPJ: {{cnpj}}
> Ano de referência: {{ano_referencia}}
> Análise preparada por **{{empresa_nome}}**

## Sumário executivo

Síntese da saúde financeira do fornecedor **{{fornecedor}}** com base nos 12 indicadores canônicos e na pontuação determinística calculada pelo sistema (bloco \<financial-classification\>). Cite o score (0-100), a classificação (excellent/good/caution/poor) e a recomendação de compra (buy/caution/do_not_buy). Em 2-3 frases, traga a tese central de risco.

## 1. Liquidez Corrente (peso 30%)

Explique o valor de Liquidez Corrente observado e o que ele indica sobre a capacidade do fornecedor de honrar obrigações de curto prazo. Compare com benchmark típico do setor (sem inventar números). Termine com "Implicação para o comprador: ...".

## 2. Dívida Líquida / EBITDA (peso 30%)

Explique o múltiplo observado e a alavancagem implícita. Comente se EBITDA é positivo/negativo. Conecte com prazo razoável de exposição contratual. Termine com "Implicação para o comprador: ...".

## 3. Margem EBITDA (peso 20%)

Explique a margem EBITDA e o que ela indica sobre eficiência operacional do fornecedor. Compare com média do setor (qualitativamente). Termine com "Implicação para o comprador: ...".

## 4. ROE (peso 20%)

Explique o retorno sobre patrimônio e o que ele indica sobre rentabilidade pra acionistas (proxy de saúde financeira de longo prazo). Termine com "Implicação para o comprador: ...".

## Demonstrativo resumido (outros 8 indicadores)

Liste os 8 indicadores restantes em tabela markdown, comentando sinais relevantes:

| Indicador | Valor | Sinal |
|---|---|---|
| Receita Líquida | (valor) | (crescente / estável / decrescente?) |
| EBITDA | (valor) | (proxy de geração de caixa operacional) |
| Lucro Líquido | (valor) | (positivo? negativo recorrente?) |
| Margem Líquida | (valor) | (compatível com setor?) |
| Patrimônio Líquido | (valor) | (positivo? cresce?) |
| ROIC | (valor) | (acima do custo de capital típico?) |
| Endividamento Geral | (valor) | (% de passivo sobre ativo) |
| Fluxo de Caixa Operacional | (valor) | (positivo? recorrente?) |

## Recomendação de compra

Com base no score e na composição dos pilares, classifique a recomendação:

- **buy** (score ≥ 60): fornecedor com saúde financeira adequada — contratar com prazos normais
- **caution** (35 ≤ score < 60): saúde mista — contratar com cautela (ver termos abaixo)
- **do_not_buy** (score < 35): risco alto — não contratar sem garantias estruturadas ou reorientar fonte

Justifique a recomendação em 2-3 frases citando os pilares de maior peso na decisão.

## Termos de pagamento sugeridos

Baseado no risco classificado:
- **Prazo de pagamento**: (à vista / 7 / 14 / 30 / 45 / 60 / 90 dias)
- **Garantias exigidas**: (não / nota promissória / fiança bancária / seguro de crédito Coface/Atradius / penhor / hipoteca)
- **Limite de exposição**: (% do faturamento mensal estimado do comprador — sugestão: 2% buy / 5% caution / 0% do_not_buy)
- **Cadência de revisão**: (anual / semestral / trimestral) — quanto pior o score, mais frequente

## Análise de risco de falência

Classifique o risco de inadimplência/falência (baixo / médio / alto) combinando os indicadores:
- Endividamento geral alto + FCO negativo + liquidez < 1 → **alto** (alerta vermelho)
- 2 desses 3 sinais → **médio** (monitoramento próximo)
- Nenhum desses sinais e score > 60 → **baixo** (operação normal)

Não use modelos específicos (Altman Z-score, Kanitz, etc.) a menos que tenha confiança nos inputs.

## Sinais de alerta / oportunidades

Liste 3-5 sinais que o comprador deve monitorar nos próximos 6-12 meses (ex.: queda recorrente de margem, redução de FCO, aumento da dívida líquida sem crescimento proporcional de EBITDA, etc.). Para cada sinal, diga o que verificar ao longo do tempo e qual o gatilho de ação.

{{observacoes}}
