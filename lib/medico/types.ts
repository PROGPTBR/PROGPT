import { z } from 'zod';

// Tipos da Área Médica (sub-projeto 100).

export type MedicoConfig = { medico_nome: string; contador_nome: string; contador_email: string };

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
};

export type EstadoMedico = {
  config: MedicoConfig;
  hospitais: Hospital[];
  cirurgias: Cirurgia[];
  demonstrativos: Demonstrativo[];
};

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = (max: number) => z.string().trim().max(max);

export const ConfigSchema = z.object({
  medico_nome: texto(120).default(''),
  contador_nome: texto(120).default(''),
  contador_email: texto(200).default(''),
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
