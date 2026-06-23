// Shapes genéricos das APIs públicas de compras (govdata). Tipos específicos
// por feature entram nas fases (precos.ts, indicadores.ts, fornecedor.ts).
// Contrato em docs/product/govdata-api-contract.md.

/** Wrapper de paginação do PNCP consulta (/v1/atas, /v1/contratos, ...). */
export interface PncpPage<T> {
  data: T[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina?: number;
  paginasRestantes: number;
  empty?: boolean;
}

/** Wrapper de paginação do Compras.gov.br dados abertos. */
export interface ComprasPage<T> {
  resultado: T[];
  totalRegistros: number;
  totalPaginas: number;
  paginasRestantes: number;
}

/** Ponto de série temporal do BACEN SGS (`valor` vem como string). */
export interface BacenPonto {
  data: string; // dd/MM/yyyy
  valor: string;
}
