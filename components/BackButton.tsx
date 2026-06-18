'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      Voltar
    </button>
  );
}