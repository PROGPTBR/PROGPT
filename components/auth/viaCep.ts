// Busca de endereço por CEP (ViaCEP) — puramente auxiliar/decorativo: os
// campos que ela preenche (street/district/city/state) NÃO são enviados ao
// servidor em nenhum momento (só postalCode + addressNumber são, ver
// app/api/signup/route.ts). Por isso NUNCA deve travar o cadastro: qualquer
// falha (rede, timeout, CEP não encontrado, resposta inesperada) devolve
// `null` em vez de propagar exceção — o chamador trata `null` deixando o
// usuário preencher manualmente.
export async function buscarCep(cep: string) {
  const numbers = cep.replace(/\D/g, "");

  if (numbers.length !== 8) return null;

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${numbers}/json/`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.erro) return null;

    return data;
  } catch {
    return null;
  }
}