# Financial Health Analyzer — guia de análise

> Referência canônica para análise de saúde financeira de fornecedor. Use este documento como roteiro de coleta dos 12 indicadores e da pontuação dos 4 pilares antes (ou em vez) de usar o assistente.

---

## Fornecedor analisado

- Razão social / nome: ______________________________
- CNPJ: ______________________________
- Ano de referência: ______________________________
- Responsável pela análise: ______________________________
- Data da análise: ______________________________

---

## Fórmula de score (0-100)

O score combina 4 pilares ponderados. Cada pilar pontua 0/30 ou 40/70/100 dependendo do valor do indicador.

```
SCORE = (Pts_Liquidez × 0.30)
      + (Pts_Dívida   × 0.30)
      + (Pts_Margem   × 0.20)
      + (Pts_ROE      × 0.20)
```

### Pilar 1 — Liquidez Corrente (peso 30%)
| Valor | Pontos |
|---|---|
| > 1.5 | **100** |
| 1.1 a 1.5 | **70** |
| 0.8 a 1.1 | **40** |
| < 0.8 | **0** |

### Pilar 2 — Dívida Líquida / EBITDA (peso 30%)
| Valor | Pontos |
|---|---|
| < 1.0 | **100** |
| 1.0 a 3.0 | **70** |
| 3.0 a 5.0 | **30** |
| > 5.0 ou EBITDA negativo | **0** |

### Pilar 3 — Margem EBITDA (peso 20%)
| Valor (%) | Pontos |
|---|---|
| > 20% | **100** |
| 10% a 20% | **70** |
| 5% a 10% | **40** |
| < 5% | **0** |

### Pilar 4 — ROE (peso 20%)
| Valor (%) | Pontos |
|---|---|
| > 15% | **100** |
| 8% a 15% | **70** |
| 0% a 8% | **40** |
| < 0% | **0** |

### Classificação do score
| Score | Classificação | Recomendação |
|---|---|---|
| ≥ 80 | excellent | **buy** |
| 60-80 | good | **buy** |
| 35-60 | caution | **caution** |
| < 35 | poor | **do_not_buy** |

---

## 12 indicadores a coletar

Para cada um, anote o valor mais recente (último exercício fiscal completo):

| # | Indicador | Unidade | Valor |
|---|---|---|---|
| 1 | Receita Líquida | R$ MM | _________ |
| 2 | EBITDA | R$ MM | _________ |
| 3 | Lucro Líquido | R$ MM | _________ |
| 4 | Margem Líquida | % | _________ |
| 5 | Margem EBITDA ⭐ | % | _________ |
| 6 | Dívida Líquida / EBITDA ⭐ | x | _________ |
| 7 | Liquidez Corrente ⭐ | (ratio) | _________ |
| 8 | Patrimônio Líquido | R$ MM | _________ |
| 9 | ROE ⭐ | % | _________ |
| 10 | ROIC | % | _________ |
| 11 | Endividamento Geral | % | _________ |
| 12 | Fluxo de Caixa Operacional | R$ MM | _________ |

⭐ = pilar usado no cálculo do score determinístico.

---

## Pontuação por pilar (worksheet)

Aplique as tabelas acima:

| Pilar | Valor | Pontos | Peso | Subtotal |
|---|---|---|---|---|
| Liquidez Corrente | _____ | _____ | 0.30 | _____ |
| Dívida Líq / EBITDA | _____ | _____ | 0.30 | _____ |
| Margem EBITDA | _____ | _____ | 0.20 | _____ |
| ROE | _____ | _____ | 0.20 | _____ |
| **Score final** | | | | **_____** |

---

## Risco de falência (qualitativo)

Sinais combinados:
- [ ] Endividamento geral > 70%
- [ ] FCO negativo no último exercício
- [ ] Liquidez Corrente < 1
- [ ] EBITDA negativo
- [ ] Patrimônio Líquido negativo (insolvência técnica)

Quantos sinais marcados? **Classificação:**
- 0 sinais + score > 60: **baixo**
- 1 sinal: **médio**
- 2+ sinais: **alto** — não contratar sem garantias estruturadas

---

## Termos de pagamento sugeridos

| Faixa de score | Prazo | Garantia | Limite de exposição |
|---|---|---|---|
| ≥ 80 (excellent) | 30-60 dias | Nenhuma | 5% faturamento mensal |
| 60-80 (good) | 30 dias | Nota promissória | 3% faturamento mensal |
| 35-60 (caution) | 7-14 dias | Fiança bancária ou seguro de crédito | 1-2% faturamento mensal |
| < 35 (poor) | À vista ou não contratar | Penhor / hipoteca | 0% (reorientar fonte) |

---

## Sinais a monitorar nos próximos 6-12 meses

Liste o que verificar periodicamente para esse fornecedor:

1. ______________________________________________
2. ______________________________________________
3. ______________________________________________

---

_Documento gerado pelo Financial Health Analyzer do ProcurementGPT — parte do ecossistema 2B Supply._
