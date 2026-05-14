import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProfileLogoUpload } from '@/components/profile/ProfileLogoUpload';
import { ProfileCompanyForm } from '@/components/profile/ProfileCompanyForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/profile');

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Logado como <span className="font-medium">{user.email ?? user.id}</span>
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-medium">Logo da empresa</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Este logo é incluído nos documentos gerados (RFP .docx e planilha de cotação
            .xlsx). PNG ou JPG, até 2 MB.
          </p>
        </div>
        <ProfileLogoUpload />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-medium">Dados da empresa</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Estes campos são incluídos automaticamente nos documentos gerados —
            apresentação do RFP, banner da planilha de cotação e cláusulas de termos.
          </p>
        </div>
        <ProfileCompanyForm />
      </section>
    </div>
  );
}
