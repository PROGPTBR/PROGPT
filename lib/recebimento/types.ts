import { z } from 'zod';

// Recebimento de NF (sub-projeto 95): o pedido de compra (PO) é a referência;
// o fornecedor anexa a nota, o sistema separa a nota de ENTREGA (vai para o
// almoxarifado, sem valores) da nota FINANCEIRA (vai para o financeiro) e
// confere cada uma contra o pedido.

export const PedidoItemSchema = z.object({
  codigo: z.string().trim().max(60).default(''),
  descricao: z.string().trim().min(1).max(300),
  ncm: z.string().trim().max(20).default(''),
  unidade: z.string().trim().max(10).default('UN'),
  quantidade: z.number().positive().max(1e9),
  valor_unitario: z.number().min(0).max(1e10),
  /** Alíquotas que o pedido informa. Nulo = o pedido não informou e a
   *  conferência tributária desse imposto não é feita. */
  icms_pct: z.number().min(0).max(100).nullable().default(null),
  ipi_pct: z.number().min(0).max(100).nullable().default(null),
});
export type PedidoItem = z.infer<typeof PedidoItemSchema>;

export const PedidoInputSchema = z.object({
  numero: z.string().trim().max(60).default(''),
  titulo: z.string().trim().max(200).default(''),
  fornecedor_nome: z.string().trim().min(1).max(200),
  fornecedor_cnpj: z.string().trim().max(20).default(''),
  fornecedor_email: z.string().trim().max(200).default(''),
  almoxarifado_nome: z.string().trim().max(120).default(''),
  almoxarifado_email: z.string().trim().max(200).default(''),
  financeiro_nome: z.string().trim().max(120).default(''),
  financeiro_email: z.string().trim().max(200).default(''),
  condicoes: z.string().trim().max(4000).default(''),
  itens: z.array(PedidoItemSchema).min(1).max(300),
});
export type PedidoInput = z.infer<typeof PedidoInputSchema>;

/** Para onde a nota vai dentro da empresa. */
export type FinalidadeNota = 'entrega' | 'financeira' | 'unica';

export const FINALIDADE_LABEL: Record<FinalidadeNota, string> = {
  entrega: 'Nota de entrega (remessa)',
  financeira: 'Nota financeira (faturamento)',
  unica: 'Nota única (entrega e faturamento)',
};

export type NotaItem = {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  icms_pct: number | null;
  ipi_pct: number | null;
  /** Grupo de CBS/IBS da nota (layout da reforma, obrigatório desde 2026).
   *  Ausente em nota antiga ou lida de PDF. */
  ibscbs?: { cst: string; cClassTrib: string; vCBS: number | null; vIBS: number | null } | null;
  /** NT 2026.008 (em produção desde 16/11/2026): valor do item sem nenhum
   *  tributo (vUnComLiq e vProdLiq). Opcional no leiaute por ora: nulo
   *  quando a nota não traz. */
  liquido?: { unitario: number | null; total: number | null } | null;
  /** Tributos que ficam "por dentro" do vProd, para conferir o líquido. */
  embutidos?: { icms: number | null; fcp: number | null; pis: number | null; cofins: number | null } | null;
  /** NT 2026.008: ICMS que incidirá no fornecimento futuro (nota de
   *  pagamento antecipado). */
  icms_previsto?: number | null;
};

export type NotaLida = {
  numero: string;
  serie: string;
  chave: string;
  emitente_nome: string;
  emitente_cnpj: string;
  data_emissao: string;
  natureza: string;
  valor_total: number | null;
  /** NT 2026.008: soma dos valores líquidos (vProdLiqTot). */
  valor_liquido_total?: number | null;
  itens: NotaItem[];
};

export type Severidade = 'alta' | 'media' | 'info';

export type Apontamento = {
  tipo:
    | 'item_fora_do_pedido'
    | 'quantidade_acima'
    | 'entrega_parcial'
    | 'unidade_diferente'
    | 'descricao_diferente'
    | 'ncm_divergente'
    | 'ncm_ausente'
    | 'preco_acima'
    | 'preco_abaixo'
    | 'imposto_divergente'
    | 'imposto_nao_informado'
    | 'valor_acima_do_pedido'
    | 'emitente_diferente'
    | 'nota_repetida'
    | 'liquido_divergente';
  severidade: Severidade;
  /** Índice do item no pedido (null quando o item não casou com nenhum). */
  item: number | null;
  mensagem: string;
  /** Apontamento que fala de dinheiro: nunca vai para o almoxarifado. */
  financeiro: boolean;
};

export type Conferencia = {
  ok: boolean;
  apontamentos: Apontamento[];
  /** Item da nota → item do pedido (null = não casou). */
  casamento: Array<number | null>;
};

export type RecebimentoPedido = {
  id: string;
  user_id: string;
  numero: string;
  titulo: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  fornecedor_email: string;
  almoxarifado_nome: string;
  almoxarifado_email: string;
  financeiro_nome: string;
  financeiro_email: string;
  condicoes: string;
  itens: PedidoItem[];
  valor_total: number;
  status: StatusPedido;
  fornecedor_token: string;
  almoxarifado_token: string;
  financeiro_token: string;
  pagamento_liberado_em: string | null;
  pagamento_liberado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type RecebimentoNota = {
  id: string;
  pedido_id: string;
  user_id: string;
  finalidade: FinalidadeNota;
  numero: string;
  serie: string;
  chave: string;
  emitente_nome: string;
  emitente_cnpj: string;
  data_emissao: string;
  natureza: string;
  valor_total: number | null;
  itens: NotaItem[];
  origem: 'xml' | 'pdf';
  enviado_por: 'fornecedor' | 'comprador';
  conferencia: Conferencia;
  arquivo_nome: string;
  arquivo_path: string | null;
  created_at: string;
};

export type EntradaItem = { item: number; quantidade: number; ressalva: string };

export type RecebimentoEntrada = {
  id: string;
  pedido_id: string;
  user_id: string;
  nota_id: string | null;
  itens: EntradaItem[];
  responsavel: string;
  observacao: string;
  created_at: string;
};

export type StatusPedido =
  | 'aguardando_nota'
  | 'aguardando_entrega'
  | 'parcial'
  | 'aguardando_ok'
  | 'pagamento_liberado'
  | 'cancelado';

export const STATUS_LABEL: Record<StatusPedido, string> = {
  aguardando_nota: 'Aguardando nota do fornecedor',
  aguardando_entrega: 'Nota recebida, aguardando entrega',
  parcial: 'Entrega parcial, com pendência',
  aguardando_ok: 'Tudo entregue, aguardando o OK do almoxarifado',
  pagamento_liberado: 'Pagamento liberado',
  cancelado: 'Cancelado',
};
