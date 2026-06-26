export function maskCpf(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  return numbers
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function maskPhone(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 7) {
    return numbers.replace(/^(\d{2})(\d+)/, "($1) $2");
  }

  return numbers.replace(
    /^(\d{2})(\d{5})(\d+)/,
    "($1) $2-$3"
  );
}

export function formatCep(value: string) {
const numbers = value.replace(/\D/g,"").slice(0,8);
return numbers.replace(/^(\d{5})(\d)/,"$1-$2");
}