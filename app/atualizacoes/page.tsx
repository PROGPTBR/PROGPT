import type { Metadata } from 'next';
import UpdatesPage from './UpdatesPage';

export const metadata: Metadata = {
  title: 'Atualizações do sistema | PROGPT',
};

export default function AtualizacoesPage() {
  return <UpdatesPage />;
}
