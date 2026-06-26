export async function buscarCep(cep: string) {
  const numbers = cep.replace(/\D/g, "");

  if (numbers.length !== 8) return null;

  const response = await fetch(
    `https://viacep.com.br/ws/${numbers}/json/`
  );

  const data = await response.json();

  if (data.erro) return null;

  return data;
}