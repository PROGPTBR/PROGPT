# Contrato REST — mcp-fiscal-brasil (spike, Fase 0)

Serviço open-source **mcp-fiscal-brasil** (Python/FastAPI, MIT, sem API keys —
usa BrasilAPI/ReceitaWS/SEFAZ; já faz retry exponencial + rate-limit por host +
cache pluggável). Rodamos como **serviço REST separado no Railway** e o PROGPT
(Node) consome via HTTP (`lib/fiscal/client.ts`, padrão `lib/billing/asaas.ts`).

- Imagem: `ghcr.io/dehor-labs/mcp-fiscal-brasil:latest`
- Comando do servidor REST: `mcp-fiscal-api` · host `0.0.0.0` · **porta 8000**
- OpenAPI/Swagger: `GET /docs`
- Env do serviço: `MCP_FISCAL_LOG_LEVEL` (INFO), `BRASILAPI_BASE_URL`, `HTTP_TIMEOUT` (s, default 30)
- No PROGPT: `FISCAL_API_URL` (URL interna Railway, ex. `http://mcp-fiscal.railway.internal:8000`). Vazio ⇒ feature desligada (fail-soft).

## Endpoints consumidos

| Método | Path | Tool | Uso no PROGPT |
|---|---|---|---|
| GET | `/health` | — | healthcheck |
| GET | `/v1/cnpj/{cnpj}` | `consultar_cnpj` | dados cadastrais |
| GET | `/v1/simples/{cnpj}` | simples status | optante Simples/MEI |
| GET | `/v1/agentic/supplier/{cnpj}?estrito=<bool>` | `risk_score_supplier` | **score de risco do fornecedor** |
| GET | `/v1/agentic/compliance/{cnpj}` | `analyze_cnpj_compliance` | **relatório de compliance** (inclui categoria `certidoes`) |
| GET | `/v1/agentic/regimes?faturamento_anual=<float>&setor=<comércio\|serviços\|indústria>&folha_pagamento_anual=<float?>` | `compare_tax_regimes` | comparação de regime tributário |

> **Não expostos no REST** (existem só como tools MCP): `consultar_certidao_federal`,
> `consultar_certidao_fgts`, `consultar_empresas_lote`. Consequências:
> - Certidões entram via o `analyze_cnpj_compliance` (achado de categoria `certidoes`).
> - Enriquecimento em lote (Fase 3) é **por-CNPJ com cap de concorrência** + cache, não batch.

## Shapes de resposta (Pydantic → JSON)

`RiskLevel = "baixo" | "medio" | "alto" | "critico"`

**SupplierRiskScore** (`/v1/agentic/supplier/{cnpj}`):
`{ cnpj, razao_social, risco: RiskLevel, score: int(0-100), fatores: string[], recomendacao: "aprovar"|"aprovar_com_ressalvas"|"investigar"|"recusar", data_analise: date }`

**ComplianceReport** (`/v1/agentic/compliance/{cnpj}`):
`{ cnpj, razao_social, risco_geral: RiskLevel, score: int(0-100), achados: ComplianceFinding[], resumo_executivo, fontes_consultadas: string[] }`
**ComplianceFinding**: `{ categoria: "situacao_cadastral"|"regime_tributario"|"atividade"|"endereco"|"certidoes"|"qsa", severidade: RiskLevel, titulo, detalhe, recomendacao: string|null }`

**TaxRegimeComparison** (`/v1/agentic/regimes`):
`{ cenario_faturamento_anual, cenario_setor, folha_pagamento_anual|null, opcoes: TaxRegimeOption[], melhor_opcao, economia_anual_vs_pior, observacoes }`
**TaxRegimeOption**: `{ regime, aplicavel, motivo_inaplicavel|null, aliquota_efetiva_estimada|null, imposto_anual_estimado|null, pros: string[], contras: string[] }`

**CNPJResponse** (`/v1/cnpj/{cnpj}`): `{ cnpj, razao_social, nome_fantasia|null, situacao_cadastral, data_situacao_cadastral|null, natureza_juridica, porte|null, capital_social|null, atividade_principal|null, simples_nacional|null, mei|null, endereco|null, ... }` (consumimos só um subconjunto).

> Field names dos endpoints agênticos são ASCII limpos. O `/v1/cnpj` tem campos
> aninhados com acento (`código`/`descrição` em AtividadeCNAE) — por isso
> centramos o cliente nos endpoints agênticos e consumimos do `/v1/cnpj` só
> campos top-level seguros.
