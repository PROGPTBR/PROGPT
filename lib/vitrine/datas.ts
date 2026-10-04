// Datas das vitrines (sub-projeto 68). Os exemplos são montados a partir de um
// "hoje" que o servidor calcula NO FUSO DE BRASÍLIA e passa para o cliente como
// 'YYYY-MM-DD' — o Railway roda em UTC, então `new Date()` puro já seria
// "amanhã" depois das 21h e os prazos dos exemplos pulariam um dia. Passar a
// string pronta também evita divergência de hidratação entre servidor e browser.

export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

function partes(iso: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return [y, m, d];
}

/** 'YYYY-MM-DD' → Date à meia-noite local (sem passar por UTC). */
export function dataDeIso(iso: string): Date {
  const [y, m, d] = partes(iso);
  return new Date(y, m - 1, d);
}

/** 'YYYY-MM-DD' no calendário local de `now` deslocado em `dias`. */
export function isoDia(now: Date, dias: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Diferença em dias de calendário (b - a) entre duas datas 'YYYY-MM-DD'. */
export function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = partes(a);
  const [yb, mb, db] = partes(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function formatarData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
