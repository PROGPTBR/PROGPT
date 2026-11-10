import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { NotAdmin, requireAdmin } from '@/lib/auth';
import {
  createProductUpdate,
  listAdminUpdates,
  PRODUCT_UPDATES_CACHE_TAG,
} from '@/lib/updates/queries';
import { ProductUpdateCreateSchema } from '@/lib/updates/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorizeAdmin() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof NotAdmin) return null;
    throw error;
  }
}

export async function GET() {
  const admin = await authorizeAdmin();
  if (!admin) return new NextResponse('Not Found', { status: 404 });

  try {
    return NextResponse.json({ updates: await listAdminUpdates() });
  } catch (error) {
    console.error('[admin/updates] Falha ao listar:', error);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await authorizeAdmin();
  if (!admin) return new NextResponse('Not Found', { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ProductUpdateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const update = await createProductUpdate(parsed.data, admin.user.id);
    revalidateTag(PRODUCT_UPDATES_CACHE_TAG);
    revalidatePath('/atualizacoes');
    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'slug_conflict' }, { status: 409 });
    }
    console.error('[admin/updates] Falha ao criar:', error);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
