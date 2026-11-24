import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Prévia LOCAL: o app num celular (390 x 844) ao lado da entrada. Só em desenvolvimento.
export default function Previa({ searchParams }: { searchParams: { aba?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const aba = searchParams.aba ? `?aba=${encodeURIComponent(searchParams.aba)}` : '';
  return (
    <div className="flex min-h-screen items-start justify-center gap-8 bg-neutral-200 p-6">
      <iframe title="App no celular" src={`/medicos/previa/app${aba}`} className="h-[844px] w-[390px] rounded-[2rem] border-8 border-neutral-900 bg-white" />
      <iframe title="Entrada no celular" src="/medicos" className="h-[844px] w-[390px] rounded-[2rem] border-8 border-neutral-900 bg-white" />
    </div>
  );
}
