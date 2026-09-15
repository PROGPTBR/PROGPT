import { UserDetailRoot } from '@/components/plataforma/UserDetailRoot';

export const dynamic = 'force-dynamic';

export default function PlataformaUserDetailPage({ params }: { params: { id: string } }) {
  return <UserDetailRoot userId={params.id} />;
}
