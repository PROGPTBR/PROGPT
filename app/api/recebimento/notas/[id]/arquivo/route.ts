import { NextResponse } from 'next/server';

import { getServerSupabase } from '@/lib/db/supabase';
import { urlDoArquivo } from '@/lib/recebimento/service';
import { usuarioOu401 } from '@/lib/recebimento/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;

  const { data } = await getServerSupabase()
    .from('recebimento_notas')
    .select('arquivo_path')
    .eq('id', params.id)
    .eq('user_id', u.id)
    .maybeSingle();
  const path = (data as { arquivo_path?: string | null } | null)?.arquivo_path;
  if (!path) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const url = await urlDoArquivo(path);
  if (!url) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.redirect(url);
}
