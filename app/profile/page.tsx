import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProfileLogoUpload } from '@/components/profile/ProfileLogoUpload';
import { ProfileCompanyForm } from '@/components/profile/ProfileCompanyForm';
import { ProfileCategoriesList } from '@/components/profile/ProfileCategoriesList';
import { BrandLogo } from '@/components/brand/BrandLogo';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/profile');

  return (
    <div className="relative min-h-screen bg-[#0d0d0d] text-white font-outfit antialiased overflow-x-hidden">
      {/* Decorative cyan glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/chat" className="inline-flex items-center">
            <BrandLogo size="md" priority />
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar para o chat
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Meu perfil <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1.5">
            Logado como{' '}
            <span className="font-medium text-white">
              {user.email ?? user.id}
            </span>
          </p>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-medium">Logo da empresa</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Este logo é incluído nos documentos gerados (RFP .docx e planilha
              de cotação .xlsx). PNG ou JPG, até 2 MB.
            </p>
          </div>
          <ProfileLogoUpload />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-medium">Dados da empresa</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Estes campos são incluídos automaticamente nos documentos gerados —
              apresentação do RFP, banner da planilha de cotação e cláusulas de
              termos.
            </p>
          </div>
          <ProfileCompanyForm />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-medium">Minhas categorias</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Perfis de categoria que você cadastrou. Use no chat (seletor
              acima do campo de mensagem) ou no botão &quot;Iniciar de um
              Perfil&quot; dentro dos assistentes RFP / Kraljic / Porter /
              ABC para pré-popular os campos.
            </p>
          </div>
          <ProfileCategoriesList />
        </section>
      </main>
    </div>
  );
}
