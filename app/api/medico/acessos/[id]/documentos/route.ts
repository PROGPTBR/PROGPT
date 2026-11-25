import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, getProfile } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { BUCKET } from '@/lib/medico/documentos';
import { TIPO_DE_DOCUMENTO_LABEL, type TipoDeDocumento } from '@/lib/medico/types';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Documentos de partida de um médico, para a equipe da 2B Supply (sub-projeto
// 117): com eles a equipe lança o primeiro mês e inicia a ligação com o banco.
// Só super admin; cada leitura fica no log de auditoria; links de 2 minutos.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id).catch(() => null) : null;
  if (!user || profile?.super_admin !== true) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const db = getServerSupabase();
  const { data: alvo } = await db.from('profiles').select('area_medica').eq('id', params.id).maybeSingle();
  if (!alvo || !['medico', 'equipe'].includes(alvo.area_medica as string)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error } = await db.from('medico_documentos').select('id, tipo, nome, caminho, created_at').eq('user_id', params.id).order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: 'read_failed', message: 'Não foi possível ler os documentos.' }, { status: 500 });

  const documentos = await Promise.all(
    (data ?? []).map(async (d) => {
      const { data: assinado } = await db.storage.from(BUCKET).createSignedUrl(d.caminho as string, 120, { download: d.nome as string });
      return { id: d.id, tipo: d.tipo, rotulo: TIPO_DE_DOCUMENTO_LABEL[d.tipo as TipoDeDocumento] ?? 'Documento', nome: d.nome, created_at: d.created_at, url: assinado?.signedUrl ?? '' };
    }),
  );
  void recordAuditLog({ actorId: user.id, actorEmail: user.email ?? null, action: 'area_medica.documentos_view', resourceType: 'user', resourceId: params.id, metadata: { quantos: documentos.length } });
  return NextResponse.json({ documentos }, { headers: { 'Cache-Control': 'private, no-store' } });
}
