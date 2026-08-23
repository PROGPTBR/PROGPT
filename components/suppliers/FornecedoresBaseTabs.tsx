'use client';

import { useState } from 'react';
import { SupplierBase } from './SupplierBase';
import { MaterialsBase } from '@/components/materials/MaterialsBase';

// Batch L do backlog do diretor — a página /fornecedores ganha uma 2ª aba
// pra "Minha base de materiais" (ABC: "precisa carregar o banco de dados de
// materiais do cliente"), ao lado da base de fornecedores já existente.

type Tab = 'fornecedores' | 'materiais';

export function FornecedoresBaseTabs() {
  const [tab, setTab] = useState<Tab>('fornecedores');

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        <TabButton active={tab === 'fornecedores'} onClick={() => setTab('fornecedores')}>
          Fornecedores
        </TabButton>
        <TabButton active={tab === 'materiais'} onClick={() => setTab('materiais')}>
          Materiais
        </TabButton>
      </div>

      {tab === 'fornecedores' ? <SupplierBase /> : <MaterialsBase />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 h-8 text-sm font-medium transition-all duration-150 ${
        active ? 'bg-brand/10 text-brand' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
