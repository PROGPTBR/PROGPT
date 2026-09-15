import { ConsoleRoot } from '@/components/plataforma/ConsoleRoot';

export const dynamic = 'force-dynamic';

// Home do console Super Admin — era um redirect pra /plataforma/operacoes
// até este sub-projeto; agora é o Console de fato (KPIs, alertas, atividade
// recente), no padrão do sistema de referência que o diretor pediu pra
// espelhar (2026-09-15).
export default function PlataformaConsolePage() {
  return <ConsoleRoot />;
}
