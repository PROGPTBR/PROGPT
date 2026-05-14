import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  CompanyDataSchema,
  getUserCompany,
  updateUserCompany,
} from '@/lib/db/user-company';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — return the user's saved company data (empty fields when nothing set)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const data = await getUserCompany(user.id);
  return NextResponse.json(data);
}

// PUT — overwrite the saved values. Empty strings → null at the DB write
// layer (see updateUserCompany).
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed;
  try {
    const json = await req.json();
    // Pre-clean: turn empty strings into null before zod sees them, so
    // a partial form with cleared fields validates instead of failing
    // on min(1).
    const cleaned = Object.fromEntries(
      Object.entries(json as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === 'string' && v.trim() === '' ? null : v,
      ]),
    );
    parsed = CompanyDataSchema.parse(cleaned);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const result = await updateUserCompany(user.id, parsed);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
