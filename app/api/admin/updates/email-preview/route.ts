import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotAdmin, requireAdmin } from '@/lib/auth';
import { buildEmailPreview } from '@/lib/email/preview';
import { EMAIL_PREVIEW_TEMPLATE_IDS } from '@/lib/email/preview-options';
import { UPDATE_CATEGORIES } from '@/lib/updates/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PreviewSchema = z.object({
  template: z.enum(EMAIL_PREVIEW_TEMPLATE_IDS),
  update: z.object({
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(600),
    slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    category: z.enum(UPDATE_CATEGORIES),
  }),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = PreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const preview = buildEmailPreview(parsed.data.template, parsed.data.update);
  return NextResponse.json(preview, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
