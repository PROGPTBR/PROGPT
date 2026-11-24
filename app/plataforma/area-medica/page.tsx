import { AreaMedicaAdmin } from '@/components/plataforma/AreaMedicaAdmin';

export const dynamic = 'force-dynamic';

// Super Admin → Área Médica (sub-projeto 107): o painel do produto dos
// médicos, separado do sistema de compras. O layout já exige super admin.
export default function PlataformaAreaMedicaPage() {
  return <AreaMedicaAdmin />;
}
