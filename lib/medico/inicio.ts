import type { Documento, EstadoMedico, TipoDeDocumento } from './types';

// Formulário de início (sub-projeto 117). PURO.
//
// O médico já tem a conta (a 2B Supply criou). O que falta para a automação
// funcionar de cara é o que SÓ ELE sabe: empresa que emite a nota, contador,
// hospitais e o ciclo de cada um, banco e quem opera no dia a dia. O resto a
// equipe preenche pelo painel. Com as respostas e os documentos de partida a
// equipe lança o primeiro mês e inicia a ligação com o banco.

export const BANCOS = ['BTG Pactual', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Nubank', 'Inter', 'Sicredi', 'Sicoob', 'Outro'] as const;

/** Quem preenche cada campo do cadastro. A equipe cadastra o que pode antes do médico entrar. */
export const QUEM_PREENCHE: Record<'medico' | 'equipe', readonly string[]> = {
  equipe: ['medico_nome', 'crm', 'especialidade', 'whatsapp_numero', 'medico_email'],
  medico: ['empresa_nome', 'empresa_cnpj', 'contador_nome', 'contador_email', 'hospitais', 'banco_nome', 'documentos', 'secretaria'],
};

/** Documentos de partida que o formulário pede, com o motivo em uma frase. */
export const DOCUMENTOS_DE_PARTIDA: { tipo: TipoDeDocumento; titulo: string; porque: string; obrigatorio: boolean }[] = [
  { tipo: 'demonstrativo', titulo: 'Um demonstrativo real de cada hospital', porque: 'É com ele que o sistema aprende o formato e lança o primeiro mês.', obrigatorio: true },
  { tipo: 'pendencias', titulo: 'Sua planilha de pendências atual', porque: 'As cirurgias que o hospital ainda não pagou entram já como pendência.', obrigatorio: false },
  { tipo: 'modelo_pendencias', titulo: 'O modelo de planilha que o hospital exige', porque: 'A cobrança sai exatamente no formato que o hospital aceita.', obrigatorio: false },
  { tipo: 'cirurgias', titulo: 'As cirurgias do mês', porque: 'Planilha da secretária ou texto colado do grupo. Vira a lista do mês.', obrigatorio: false },
  { tipo: 'extrato', titulo: 'Extrato do mês (OFX ou CSV)', porque: 'Primeira conciliação: o sistema casa cada crédito com a nota.', obrigatorio: false },
];

export type Pendente = { id: string; titulo: string };

/** Respostas obrigatórias que ainda faltam. Vazio = pode concluir. */
export function faltaNoInicio(estado: Pick<EstadoMedico, 'config' | 'hospitais' | 'documentos'>): Pendente[] {
  const { config } = estado;
  const reais = estado.hospitais.filter((h) => !h.exemplo);
  const falta: Pendente[] = [];
  if (!config.empresa_nome.trim() || !config.empresa_cnpj.trim()) falta.push({ id: 'empresa', titulo: 'Empresa que emite as notas (razão social e CNPJ)' });
  if (!config.contador_email.trim()) falta.push({ id: 'contador', titulo: 'E-mail do contador' });
  if (reais.length === 0) falta.push({ id: 'hospitais', titulo: 'Pelo menos um hospital' });
  else if (reais.some((h) => !h.email.trim())) falta.push({ id: 'hospital_email', titulo: 'E-mail do setor de honorários de cada hospital' });
  if (!config.banco_nome.trim()) falta.push({ id: 'banco', titulo: 'Banco onde o pagamento cai' });
  if (!estado.documentos.some((d) => d.tipo === 'demonstrativo')) falta.push({ id: 'demonstrativo', titulo: 'Um demonstrativo real do hospital' });
  return falta;
}

/** O médico precisa passar pelo formulário antes de usar o app? */
export function precisaDoInicio(estado: Pick<EstadoMedico, 'config' | 'hospitais'>): boolean {
  if (estado.config.inicio_status !== '') return false;
  // Conta que já tem hospital real cadastrado (veio de antes do formulário existir) não é parada.
  return !estado.hospitais.some((h) => !h.exemplo);
}

/** Quantos documentos de cada tipo de partida já foram anexados. */
export function documentosDePartida(documentos: Documento[]): Record<TipoDeDocumento, number> {
  const contagem = {} as Record<TipoDeDocumento, number>;
  for (const d of documentos) contagem[d.tipo] = (contagem[d.tipo] ?? 0) + 1;
  return contagem;
}

/** Situação do início para o painel da equipe: o que o médico já respondeu e o que falta. */
export function situacaoDoInicio(estado: Pick<EstadoMedico, 'config' | 'hospitais' | 'documentos'>): { status: 'pendente' | 'respondido' | 'pulado'; faltam: number; documentos: number } {
  const status = estado.config.inicio_status === '' ? 'pendente' : estado.config.inicio_status;
  return { status, faltam: faltaNoInicio(estado).length, documentos: estado.documentos.length };
}
