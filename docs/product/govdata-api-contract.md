# Contrato das APIs públicas de dados de compras (govdata)

> Sub-projeto 37. Consumimos as APIs públicas **subjacentes** que o `mcp-brasil`
> encapsula — **sem rodar o servidor mcp-brasil e sem cliente MCP**. Todas são
> REST abertas, **sem chave**. Cliente em [lib/govdata/client.ts](../../lib/govdata/client.ts).
> Validado ao vivo no spike de 2026-06-23.

## Bases (todas com default público + override por env)

| Base | Default | Env override |
|------|---------|--------------|
| `pncp` | `https://pncp.gov.br/api/consulta` | `PNCP_API_URL` |
| `compras` | `https://dadosabertos.compras.gov.br` | `COMPRAS_API_URL` |
| `bacen` | `https://api.bcb.gov.br/dados` | `BACEN_API_URL` |

Kill-switch global: `GOVDATA_ENABLED=false` desliga tudo (default ON, pois é grátis).

---

## BACEN SGS (indicadores econômicos) — Fase 3

`GET /serie/bcdata.sgs.{codigo}/dados?formato=json[&dataInicial=dd/MM/yyyy&dataFinal=...]`
ou `.../dados/ultimos/{N}?formato=json`.

Resposta: **array** de `{ "data": "dd/MM/yyyy", "valor": "14.25" }` (valor é string).

Séries úteis (confirmadas no spike):
- `432` — Meta Selic definida pelo Copom (% a.a.)
- `433` — IPCA mensal (% no mês) → acumular 12m no código
- `1` — Câmbio livre dólar (venda)
- (a confirmar p/ construção: `189` IGP-M, `192` INCC — checar antes de usar)

## Compras.gov.br dados abertos — Fases 1 e 2

OpenAPI completo em `https://dadosabertos.compras.gov.br/v3/api-docs` (77 paths).
**`tamanhoPagina` tem mínimo 10, máximo 500.** Wrapper:
`{ resultado: T[], totalRegistros, totalPaginas, paginasRestantes }`.

### Preços praticados (🥇 o prêmio) — `03 - PESQUISA DE PREÇO`
`GET /modulo-pesquisa-preco/1_consultarMaterial?codigoItemCatalogo={CATMAT}&pagina=1&tamanhoPagina=10`
(opcionais: `estado`, `codigoMunicipio`, `dataCompraInicio`, `dataCompraFim`, `poder`, `esfera`).
`codigoItemCatalogo` é **obrigatório** — não há busca de preço por texto livre.

Cada item de `resultado[]` (validado, ex. `codigoItemCatalogo=341842` → 15 amostras):
`precoUnitario` (number), `quantidade`, `dataCompra` (YYYY-MM-DD), `niFornecedor` (CNPJ),
`nomeFornecedor`, `marca`, `descricaoItem`, `siglaUnidadeFornecimento`, `nomeUnidadeMedida`,
`estado`, `municipio`, `nomeOrgao`, `nomeUasg`, `poder`, `esfera`, `modalidade`, `idCompra`.
Serviços (CATSER): `/modulo-pesquisa-preco/3_consultarServico?codigoItemCatalogo=...`.

### Catálogo CATMAT/CATSER — `01 - CATÁLOGO - MATERIAL` / `02 - SERVIÇO`
Hierarquia: Grupo → Classe → PDM → Item.
`GET /modulo-material/4_consultarItemMaterial?codigoClasse={N}` (ou `codigoItem`, `codigoPdm`,
`codigoGrupo`, `descricaoItem`, `statusItem`, `bps`).
`GET /modulo-material/{1_consultarGrupoMaterial,2_consultarClasseMaterial,3_consultarPdmMaterial}`.

> ⚠️ **`descricaoItem` NÃO faz busca por substring** — retornou 0 para "caneta", "SACO",
> "AÇÚCAR" etc. no spike. O catálogo só é navegável **por código**. Logo, `texto → código
> CATMAT` precisa de um índice próprio (seed do catálogo Grupo/Classe/PDM/Item com FTS no
> Postgres, padrão `cnae_taxonomy`) ou navegação hierárquica guiada por LLM. **Decisão e
> implementação na Fase 1.**

### Contratos por fornecedor — Fase 2
PNCP `/v1/contratos` traz `niFornecedor`/`nomeRazaoSocialFornecedor`/`valorGlobal`, mas filtra
por **órgão** (não por fornecedor). Fonte de contratos POR fornecedor a fixar na Fase 2
(Portal da Transparência endpoint de fornecedor — reusa `PORTAL_TRANSPARENCIA_TOKEN` — ou
Compras dados abertos por `niFornecedor`).

## PNCP consulta — `https://pncp.gov.br/api/consulta`

`tamanhoPagina` mínimo 10 (máx 500). Datas `YYYYMMDD`. Wrapper:
`{ data: T[], totalRegistros, totalPaginas, numeroPagina, paginasRestantes, empty }`.

- `GET /v1/atas?dataInicial=YYYYMMDD&dataFinal=YYYYMMDD&pagina=1` — atas de registro de preço
  (campos: `numeroControlePNCPAta`, `objetoContratacao`, `cnpjOrgao`, `nomeOrgao`,
  `vigenciaInicio/Fim`, `cancelado`). Sem preço unitário neste nível.
- `GET /v1/contratos?dataInicial=...&dataFinal=...&pagina=1` — contratos (com fornecedor + valor).
- `GET /v1/contratacoes/publicacao?dataInicial=...&dataFinal=...&codigoModalidadeContratacao=...&pagina=1`.

## Comportamento do cliente (fail-soft)

Timeout 20s; **1 retry** em 5xx/timeout/erro de rede (instabilidade das APIs gov), **nunca** em
4xx nem quando desligado (status 0). Cache 24h por consulta. Nunca logar payload cru.
