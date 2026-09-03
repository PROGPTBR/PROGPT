-- Equalizador de Propostas — campo dedicado pro Pedido de Cotação (RFQ)
-- original, que vira a referência principal da equalização: as propostas
-- passam a ser comparadas item a item contra esse documento (cotado
-- corretamente / ausente / divergência de quantidade / especificação
-- alterada / marca diferente / condição comercial diferente / item não
-- solicitado). Opcional — sem ele, o comportamento continua o de sempre
-- (só TCO entre propostas). Mesmo padrão de `escopo`/`politica` (texto
-- simples, não JSONB — é input, não output).

alter table comprador_quotes
  add column if not exists pedido_cotacao text not null default '';
