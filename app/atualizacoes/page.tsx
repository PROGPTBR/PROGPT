import type { Metadata } from 'next';
import UpdatesPage from './UpdatesPage';
import { listPublicUpdates } from '@/lib/updates/queries';

export const metadata: Metadata = {
  title: 'Atualizações do sistema | PROGPT',
};

export const revalidate = 60;

export default async function AtualizacoesPage() {
  try {
    const updates = await listPublicUpdates();
    return <UpdatesPage updates={updates} />;
  } catch (error) {
    console.error('[atualizacoes] Falha ao carregar:', error);
    return <UpdatesPage updates={[]} loadError />;
  }
}
