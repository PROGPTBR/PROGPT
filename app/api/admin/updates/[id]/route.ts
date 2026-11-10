import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { NotAdmin, requireAdmin } from '@/lib/auth';
import {
  deleteProductUpdate,
  PRODUCT_UPDATES_CACHE_TAG,
  updateProductUpdate,
} from '@/lib/updates/queries';
import { ProductUpdatePatchSchema } from '@/lib/updates/types';

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

function invalidatePublicUpdates() {
  revalidateTag(PRODUCT_UPDATES_CACHE_TAG);
  revalidatePath('/atualizacoes');
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const admin = await authorizeAdmin();
  if (!admin) return new NextResponse('Not Found', { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ProductUpdatePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const update = await updateProductUpdate(params.id, parsed.data, admin.user.id);
    if (!update) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    invalidatePublicUpdates();
    return NextResponse.json({ update });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'slug_conflict' }, { status: 409 });
    }
    console.error('[admin/updates] Falha ao atualizar:', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const admin = await authorizeAdmin();
  if (!admin) return new NextResponse('Not Found', { status: 404 });

  try {
    const deleted = await deleteProductUpdate(params.id);
    if (!deleted) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    invalidatePublicUpdates();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/updates] Falha ao excluir:', error);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
