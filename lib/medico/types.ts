import { z } from 'zod';

// Tipos da Área Médica (sub-projeto 100).

export type MedicoConfig = {
  medico_nome: string;
  contador_nome: string;
  contador_email: string;
  /** Para onde vão as respostas dos e-mails enviados em nome do médico, e os avisos. */
  medico_email: string;
  /** WhatsApp que recebe os avisos diários. */
  whatsapp_numero: string;
  chave_pix: string;
  avisos_email: boolean;
  avisos_whatsapp: boolean;
  /** Grupo de WhatsApp de onde o sistema lê as cirurgias. */
  grupo_jid: string;
  grupo_nome: string;
  /** Cabeçalho da planilha de pendências que o hospital exige. */
  empresa_nome: string;
  empresa_cnpj: string;
  crm: string;
  especialidade: string;
  contato: string;
};

export const CONFIG_VAZIA: MedicoConfig = {
  medico_nome: '',
  contador_nome: '',
  contador_email: '',
  medico_email: '',
  whatsapp_numero: '',
  chave_pix: '',
  avisos_email: true,
  avisos_whatsapp: true,
  grupo_jid: '',
  grupo_nome: '',
  empresa_nome: '',
  empresa_cnpj: '',
  crm: '',
  especialidade: '',
  contato: '',
};

/** Papel do médico na cirurgia, como o hospital pede na planilha de pendências. */
export const FUNCOES = ['Cirurgião', '1º Auxiliar', '2º Auxiliar', '3º Auxiliar', 'Anestesista', 'Instrumentador'] as const;

/** O que chegou sozinho (grupo de WhatsApp, e-mail encaminhado) e espera conferência. */
export type Entrada = {
  id: string;
  canal: 'whatsapp' | 'email';
  remetente: string;
  assunto: string;
  texto: string;
  recebido_em: string;
};

/** O que o servidor tem ligado, para a tela mostrar só o que funciona. */
export type Integracoes = {
  whatsapp: boolean;
  email_envio: boolean;
  /** Endereço para onde o médico encaminha os e-mails do hospital; null se o recebimento está desligado. */
  email_entrada: string | null;
  super_admin: boolean;
  /** A ligação com o BTG está liberada no servidor (aplicativo cadastrado no banco). */
  btg: boolean;
};

/** Um crédito ou débito que o banco avisou. */
export type MovimentoBanco = {
  id: string;
  data: string;
  sentido: 'entrada' | 'saida';
  valor: number;
  forma: string;
  descricao: string;
  contraparte: string;
  demonstrativo_id: string | null;
};

/** Documento guardado pelo médico. O caminho do arquivo fica só no servidor. */
export const TIPOS_DE_DOCUMENTO = ['nota', 'demonstrativo', 'comprovante', 'pendencias', 'outro'] as const;
export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number];
export const TIPO_DE_DOCUMENTO_LABEL: Record<TipoDeDocumento, string> = {
  nota: 'Nota fiscal',
  demonstrativo: 'Demonstrativo do hospital',
  comprovante: 'Comprovante de pagamento',
  pendencias: 'Planilha de pendências',
  outro: 'Outro documento',
};
export type Documento = {
  id: string;
  demonstrativo_id: string | null;
  tipo: TipoDeDocumento;
  nome: string;
  mime: string;
  tamanho: number;
  created_at: string;
};

export type ContaBanco = { cnpj: string; conectado_em: string; erro: string };

export type Hospital = {
  id: string;
  nome: string;
  email: string;
  prazo_pagamento_dias: number;
  exemplo: boolean;
};

export type Cirurgia = {
  id: string;
  hospital_id: string;
  data: string; // AAAA-MM-DD
  paciente: string;
  procedimento: string;
  convenio: string;
  valor: number | null;
  origem: 'manual' | 'whatsapp' | 'demonstrativo';
  demonstrativo_id: string | null;
  cobrada_em: string | null;
  /** Papel na cirurgia (cirurgião, 1º auxiliar...) e o número de registro da descrição cirúrgica. */
  funcao: string;
  registro: string;
  /** Datas em que a cirurgia foi cobrada do hospital (uma por planilha enviada). */
  cobrancas: string[];
  observacao: string;
  exemplo: boolean;
};

/** Uma linha do demonstrativo do hospital. */
export type ItemDemonstrativo = {
  data: string | null;
  paciente: string;
  procedimento: string;
  convenio: string;
  valor: number | null;
  /** Cirurgia da lista do médico que esta linha paga (null = não encontrada). */
  cirurgia_id: string | null;
};

export type Demonstrativo = {
  id: string;
  hospital_id: string;
  referencia: string;
  recebido_em: string;
  valor_total: number;
  itens: ItemDemonstrativo[];
  nota_pedida_em: string | null;
  nota_numero: string;
  nota_emitida_em: string | null;
  nota_enviada_em: string | null;
  pago_em: string | null;
  valor_pago: number | null;
  exemplo: boolean;
  /** 'direto': o paciente paga na hora (anestesista, particular). */
  tipo: 'hospital' | 'direto';
  pagador_nome: string;
  pagador_documento: string;
  pagador_contato: string;
};

export type EstadoMedico = {
  config: MedicoConfig;
  hospitais: Hospital[];
  cirurgias: Cirurgia[];
  demonstrativos: Demonstrativo[];
  entradas: Entrada[];
  /** Conta ligada ao banco (null se não ligou) e os últimos movimentos. */
  conta: ContaBanco | null;
  movimentos: MovimentoBanco[];
  documentos: Documento[];
  integracoes: Integracoes;
};

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = (max: number) => z.string().trim().max(max);

export const ConfigSchema = z.object({
  medico_nome: texto(120).default(''),
  contador_nome: texto(120).default(''),
  contador_email: texto(200).default(''),
  medico_email: texto(200).default(''),
  whatsapp_numero: texto(30).default(''),
  chave_pix: texto(140).default(''),
  avisos_email: z.boolean().default(true),
  avisos_whatsapp: z.boolean().default(true),
  empresa_nome: texto(160).default(''),
  empresa_cnpj: texto(20).default(''),
  crm: texto(30).default(''),
  especialidade: texto(80).default(''),
  contato: texto(60).default(''),
});

/** Cobrança direta: o paciente paga na hora e a nota sai na hora. */
export const DiretoSchema = z.object({
  hospital_id: z.string().uuid(),
  data: dia,
  paciente: texto(120).min(1),
  procedimento: texto(200).default(''),
  valor: z.number().positive().max(10_000_000),
  pagador_nome: texto(160).default(''),
  pagador_documento: texto(20).default(''),
  pagador_contato: texto(60).default(''),
  /** Já manda o e-mail ao contador pedindo a nota. */
  pedir_nota: z.boolean().default(true),
});

export const HospitalSchema = z.object({
  nome: texto(120).min(2),
  email: texto(200).default(''),
  prazo_pagamento_dias: z.number().int().min(0).max(365).default(30),
});

export const CirurgiaSchema = z.object({
  hospital_id: z.string().uuid(),
  data: dia,
  paciente: texto(120).min(1),
  procedimento: texto(200).default(''),
  convenio: texto(120).default(''),
  valor: z.number().min(0).max(10_000_000).nullable().default(null),
  origem: z.enum(['manual', 'whatsapp', 'demonstrativo']).default('manual'),
  funcao: texto(40).default(''),
  registro: texto(60).default(''),
  observacao: texto(500).default(''),
});

export const CirurgiasSchema = z.object({ cirurgias: z.array(CirurgiaSchema).min(1).max(200) });

export const CirurgiaPatchSchema = CirurgiaSchema.omit({ origem: true })
  .partial()
  .extend({ cobrada_em: dia.nullable().optional() });

export const ItemDemonstrativoSchema = z.object({
  data: dia.nullable().default(null),
  paciente: texto(120).min(1),
  procedimento: texto(200).default(''),
  convenio: texto(120).default(''),
  valor: z.number().min(0).max(10_000_000).nullable().default(null),
});

export const DemonstrativoSchema = z.object({
  hospital_id: z.string().uuid(),
  referencia: texto(120).default(''),
  recebido_em: dia,
  valor_total: z.number().min(0).max(100_000_000).nullable().default(null),
  itens: z.array(ItemDemonstrativoSchema).min(1).max(300),
  /** Cria na lista do médico as cirurgias que o hospital pagou e ele não tinha anotado. */
  criar_faltantes: z.boolean().default(true),
});

export const DemonstrativoPatchSchema = z.object({
  referencia: texto(120).optional(),
  nota_pedida_em: dia.nullable().optional(),
  nota_numero: texto(60).optional(),
  nota_emitida_em: dia.nullable().optional(),
  nota_enviada_em: dia.nullable().optional(),
  pago_em: dia.nullable().optional(),
  valor_pago: z.number().min(0).max(100_000_000).nullable().optional(),
});
