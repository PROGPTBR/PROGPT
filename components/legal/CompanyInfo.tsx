import { Phone, Mail } from 'lucide-react';
import {
  COMPANY_CNPJ,
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_PHONE,
  LEGAL_CONTACT_PHONE_TEL,
} from '@/lib/legal/constants';

// Bloco reutilizável com os dados de contato da 2BSUPPLY (telefone, e-mail e
// CNPJ). Montado nos rodapés das páginas públicas (login/signup/forgot/reset
// via AuthShell, e /planos). Fonte única dos dados: lib/legal/constants.ts.

export function CompanyInfo({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 text-xs text-muted-foreground ${className}`}
    >
      <a
        href={`tel:${LEGAL_CONTACT_PHONE_TEL}`}
        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
        {LEGAL_CONTACT_PHONE}
      </a>
      <a
        href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        {LEGAL_CONTACT_EMAIL}
      </a>
      <span>CNPJ {COMPANY_CNPJ}</span>
    </div>
  );
}
