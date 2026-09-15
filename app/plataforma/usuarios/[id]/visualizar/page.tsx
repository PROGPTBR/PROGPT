import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/db/supabase';
import { SupportViewer } from '@/components/plataforma/SupportViewer';

export const dynamic = 'force-dynamic';

// requireSuperAdmin já é aplicado no /plataforma/layout.tsx (pai desta
// rota) — aqui só resolvemos o e-mail pro banner do SupportViewer.
export default async function PlataformaSupportViewPage({ params }: { params: { id: string } }) {
  const svc = getServerSupabase();
  const { data } = await svc
    .from('profiles_with_email')
    .select('email')
    .eq('id', params.id)
    .maybeSingle();

  if (!data?.email) notFound();

  return <SupportViewer userId={params.id} userEmail={data.email} />;
}
