import { FinancialAssistant } from '@/components/assistants/FinancialAssistant';

export const dynamic = 'force-dynamic';

// ?cnpj=&nome= — prefill vindo do CTA "Analisar saúde financeira" na Busca
// de Fornecedores (backlog do diretor 2026-08-19, Batch E).
export default function FinancialAssistantPage({
  searchParams,
}: {
  searchParams?: { cnpj?: string; nome?: string };
}) {
  return (
    <FinancialAssistant
      initialCnpj={searchParams?.cnpj}
      initialSupplierName={searchParams?.nome}
    />
  );
}
