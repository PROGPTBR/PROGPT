# Painel de carteira a partir de um follow-up do cliente

Gera o painel de compras (KPIs, backlog, OTIF, matriz de lead time, rankings)
a partir de uma planilha de follow-up exportada do ERP — item a item, uma linha
por item de solicitação.

```bash
# 1. planilha → CSV (xlsx grande; leitura em streaming)
python3 scripts/followup/xlsx-to-csv.py ~/Downloads/Follow-up.xlsx /tmp/followup.csv

# 2. CSV → documento
npx tsx scripts/followup/render.ts /tmp/followup.csv /tmp/painel.docx

# 3. documento → PDF
soffice --headless --convert-to pdf /tmp/painel.docx
```

Colunas esperadas (nomes do follow-up da CBL): `N. SC`, `Status SC`, `Dt. SC`,
`Prioridade`, `Comprador`, `SLA SC p/ PC`, `Pedido`, `Status pedido`,
`Dt. Entrega Prevista`, `Dt. Entrada`, `Fornecedor`.

`Entregue no prazo` **não existe na planilha** — é derivado de
`Dt. Entrada <= Dt. Entrega Prevista`, e só entram linhas com as duas datas.
Trocar de cliente costuma significar remapear os nomes das colunas em
`compute.ts`; a conta em si não muda.
