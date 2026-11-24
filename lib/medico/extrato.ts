import { diasEntre, etapaDe, partesDoNome } from './conciliacao';
import type { Demonstrativo, Hospital } from './types';

// Conferência do extrato do banco (sub-projeto 101). PURO.
//
// O médico exporta o extrato do internet banking (OFX, ou CSV) e o sistema
// acha os créditos que pagam as notas em aberto. É o mesmo cruzamento que a
// ligação direta com o banco vai usar quando o aplicativo for liberado: muda
// só de onde vêm os créditos.

export type Credito = { data: string; valor: number; descricao: string };

function numeroBr(v: string): number | null {
  const t = v.trim().replace(/\s|R\$/g, '');
  if (!t) return null;
  const normal = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function dataIso(v: string): string | null {
  const t = v.trim();
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Créditos de um extrato OFX (o formato que os bancos exportam para contabilidade). */
export function lerOfx(texto: string): Credito[] {
  const out: Credito[] = [];
  for (const bloco of texto.split(/<STMTTRN>/i).slice(1)) {
    const campo = (nome: string) => new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i').exec(bloco)?.[1]?.trim() ?? '';
    const valor = numeroBr(campo('TRNAMT').replace(',', '.'));
    const data = dataIso(campo('DTPOSTED'));
    if (valor == null || valor <= 0 || !data) continue;
    out.push({ data, valor, descricao: [campo('MEMO'), campo('NAME')].filter(Boolean).join(' ').slice(0, 200) });
  }
  return out;
}

/** Créditos de um extrato em CSV: acha sozinho as colunas de data, descrição e valor. */
export function lerCsv(texto: string): Credito[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  const sep = [';', '\t', ','].sort((a, b) => (linhas[0]?.split(b).length ?? 0) - (linhas[0]?.split(a).length ?? 0))[0]!;
  const out: Credito[] = [];
  for (const linha of linhas) {
    const cols = linha.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    const data = cols.map(dataIso).find(Boolean);
    if (!data) continue;
    // O valor é a última coluna com cara de dinheiro que não seja o saldo: fica com a primeira positiva depois da data.
    const valores = cols.filter((c) => /^-?[\d.]*\d,\d{2}$|^-?\d+\.\d{2}$/.test(c.replace(/\s|R\$/g, ''))).map((c) => numeroBr(c)!);
    const valor = valores[0];
    if (valor == null || valor <= 0) continue;
    const descricao = cols.filter((c) => c && !dataIso(c) && numeroBr(c) == null).join(' ').slice(0, 200);
    out.push({ data, valor, descricao });
  }
  return out;
}

export function lerExtrato(texto: string): Credito[] {
  return /<STMTTRN>/i.test(texto) ? lerOfx(texto) : lerCsv(texto);
}

export type Sugestao = {
  demonstrativo_id: string;
  credito: Credito;
  /** 'certa': valor igual. 'provavel': valor menor (retenção de imposto, glosa) e o nome de quem paga aparece no extrato. */
  confianca: 'certa' | 'provavel';
  diferenca: number;
};

/** Menor valor aceito em relação à nota: hospital costuma reter imposto na fonte. */
const RETENCAO_MAXIMA = 0.25;

function citaPagador(descricao: string, nome: string): boolean {
  const d = partesDoNome(descricao);
  return partesDoNome(nome).some((p) => p.length >= 4 && d.includes(p));
}

/**
 * Para cada nota em aberto (já enviada, ou ao menos emitida), o crédito do
 * extrato que a paga. Cada crédito é usado uma vez; valor exato ganha de
 * valor aproximado.
 */
export function sugerirPagamentos(creditos: Credito[], demonstrativos: Demonstrativo[], hospitais: Hospital[]): Sugestao[] {
  const abertos = demonstrativos.filter((d) => ['nota_enviada', 'nota_emitida'].includes(etapaDe(d)));
  const candidatos: (Sugestao & { peso: number })[] = [];
  for (const d of abertos) {
    const desde = d.nota_emitida_em ?? d.recebido_em;
    const pagador = d.tipo === 'direto' ? d.pagador_nome : (hospitais.find((h) => h.id === d.hospital_id)?.nome ?? '');
    for (const c of creditos) {
      if (diasEntre(desde, c.data) < 0) continue;
      const diferenca = Math.round((d.valor_total - c.valor) * 100) / 100;
      const cita = citaPagador(c.descricao, pagador);
      if (Math.abs(diferenca) <= 0.01) candidatos.push({ demonstrativo_id: d.id, credito: c, confianca: 'certa', diferenca: 0, peso: cita ? 4 : 3 });
      else if (cita && diferenca > 0 && diferenca <= d.valor_total * RETENCAO_MAXIMA) {
        candidatos.push({ demonstrativo_id: d.id, credito: c, confianca: 'provavel', diferenca, peso: 2 - diferenca / d.valor_total });
      }
    }
  }
  candidatos.sort((a, b) => b.peso - a.peso);
  const usados = new Set<Credito>();
  const feitos = new Set<string>();
  const out: Sugestao[] = [];
  for (const c of candidatos) {
    if (usados.has(c.credito) || feitos.has(c.demonstrativo_id)) continue;
    usados.add(c.credito);
    feitos.add(c.demonstrativo_id);
    out.push({ demonstrativo_id: c.demonstrativo_id, credito: c.credito, confianca: c.confianca, diferenca: c.diferenca });
  }
  return out;
}
