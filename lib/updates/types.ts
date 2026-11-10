import { z } from 'zod';

export const UPDATE_CATEGORIES = ['new_feature', 'improvement', 'fix'] as const;
export const UPDATE_STATUSES = ['draft', 'published'] as const;

export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number];
export type UpdateStatus = (typeof UPDATE_STATUSES)[number];

export type ProductUpdate = {
  id: string;
  title: string;
  slug: string;
  category: UpdateCategory;
  summary: string;
  content_md: string;
  image_url: string | null;
  video_url: string | null;
  media_caption: string | null;
  published_at: string;
  status: UpdateStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const optionalMediaUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value === '' ||
      /^\/[A-Za-z0-9][A-Za-z0-9/_.,?=&%+@#~-]*$/.test(value) ||
      /^https?:\/\/[^\s]+$/i.test(value),
    'Use uma URL http(s) ou um caminho público iniciado por /',
  )
  .transform((value) => value || null)
  .nullable()
  .optional();

const baseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(UPDATE_CATEGORIES),
  summary: z.string().trim().min(1).max(600),
  content_md: z.string().max(50_000).default(''),
  image_url: optionalMediaUrl,
  video_url: optionalMediaUrl,
  media_caption: z.string().trim().max(240).transform((value) => value || null).nullable().optional(),
  published_at: z.string().datetime({ offset: true }),
  status: z.enum(UPDATE_STATUSES),
});

export const ProductUpdateCreateSchema = baseSchema;
export const ProductUpdatePatchSchema = baseSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Informe ao menos um campo',
);

export type ProductUpdateInput = z.infer<typeof ProductUpdateCreateSchema>;

export function slugifyUpdateTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/g, '');
}

export const UPDATE_CATEGORY_LABELS: Record<UpdateCategory, string> = {
  new_feature: 'Novo recurso',
  improvement: 'Melhoria',
  fix: 'Correção',
};
