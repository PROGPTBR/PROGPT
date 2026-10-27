// Link do Google Maps para o endereço de um fornecedor.
//
// A Receita guarda o endereço com espaços de preenchimento
// ("AVENIDA X, 3663       4 ANDAR"): eles são juntados antes de montar
// a busca. Sem endereço, cai na cidade (melhor que nada) e, sem cidade,
// não há link.

export type EnderecoFornecedor = {
  endereco?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
};

function limpar(v: string | null | undefined): string {
  return (v ?? '').replace(/\s+/g, ' ').trim();
}

function formatarCep(cep: string | null | undefined): string {
  const d = (cep ?? '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : '';
}

/** Endereço legível em uma linha: "Rua X, 10 - Fortaleza/CE - 60811-341". */
export function enderecoCompleto(e: EnderecoFornecedor): string {
  const rua = limpar(e.endereco);
  const cidade = limpar(e.municipio);
  const uf = limpar(e.uf);
  const local = cidade && uf ? `${cidade}/${uf}` : cidade || uf;
  return [rua, local, formatarCep(e.cep)].filter(Boolean).join(' - ');
}

/** URL do Google Maps, ou null quando não há nem endereço nem cidade. */
export function googleMapsHref(e: EnderecoFornecedor): string | null {
  const rua = limpar(e.endereco);
  const cidade = limpar(e.municipio);
  if (!rua && !cidade) {
    return null;
  }
  const query = [rua, cidade, limpar(e.uf), formatarCep(e.cep), 'Brasil']
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
