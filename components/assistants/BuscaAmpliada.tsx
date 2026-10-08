'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileSpreadsheet, Globe, Loader2, Mail, MapPin, Phone, Upload } from 'lucide-react';

import { useSupplierBase } from '@/hooks/useSupplierBase';
import { VendorListImportDialog } from '@/components/suppliers/VendorListImportDialog';
import type { FornecedorWeb, ResultadoVendorList } from '@/lib/suppliers/busca-ampliada';

// Busca ampliada (sub-projeto 73) — só aparece para as equipes liberadas em
// lib/suppliers/busca-ampliada.ts. A página decide no servidor se mostra.

export type RespostaBuscaAmpliada = {
  consulta: string;
  vendorList: {
    total: number;
    categorias: string[];
    resultados: ResultadoVendorList[];
    erro: string | null;
  };
  web: { fornecedores: FornecedorWeb[]; texto: string | null; erro: string | null };
};

/** Cada lado chega quando fica pronto: a vendor list na hora, a internet depois. */
export type EstadoBuscaAmpliada = {
  consulta: string;
  vendorList: RespostaBuscaAmpliada['vendorList'] | 'carregando';
  web: RespostaBuscaAmpliada['web'] | 'carregando';
};

export function estadoInicialBuscaAmpliada(consulta: string): EstadoBuscaAmpliada {
  return { consulta, vendorList: 'carregando', web: 'carregando' };
}

/** Dispara as duas buscas em paralelo e avisa cada uma quando termina. */
export function rodarBuscaAmpliada(
  consulta: string,
  aoChegar: <K extends 'vendorList' | 'web'>(parte: K, valor: RespostaBuscaAmpliada[K]) => void,
): void {
  const falhaVendor = (erro: string) => ({ total: 0, categorias: [], resultados: [], erro });
  const falhaWeb = (erro: string) => ({ fornecedores: [], texto: null, erro });
  for (const parte of ['vendorList', 'web'] as const) {
    void (async () => {
      let erro = parte === 'web' ? 'A busca na internet não respondeu agora. Tente de novo em instantes.' : 'Não consegui ler a vendor list agora.';
      try {
        const res = await fetch('/api/suppliers/busca-ampliada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consulta, parte }),
        });
        if (res.ok) {
          const json = (await res.json()) as Partial<RespostaBuscaAmpliada>;
          const valor = json[parte];
          if (valor) { aoChegar(parte, valor as RespostaBuscaAmpliada[typeof parte]); return; }
        } else if (res.status === 429) {
          erro = 'Muitas buscas seguidas. Tente de novo em instantes.';
        }
      } catch {
        /* cai no erro abaixo */
      }
      if (parte === 'web') aoChegar('web', falhaWeb(erro));
      else aoChegar('vendorList', falhaVendor(erro));
    })();
  }
}

// ─── Cartão da vendor list (tela inicial da busca) ────────────────────────

type Resumo = { equipe: string; total: number; categorias: number };

export function VendorListCartao() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [aberto, setAberto] = useState(false);
  const { previewVendorListImport, applyVendorListImport } = useSupplierBase();

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers/busca-ampliada', { cache: 'no-store' });
      if (res.ok) setResumo((await res.json()) as Resumo);
    } catch {
      /* cartão continua com o texto genérico */
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            Busca ampliada{resumo ? ` · ${resumo.equipe}` : ''}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Cada busca também procura na <strong>vendor list da sua equipe</strong> e na{' '}
            <strong>internet</strong>, além da base da Receita Federal.{' '}
            {resumo
              ? resumo.total > 0
                ? `Sua vendor list tem ${resumo.total.toLocaleString('pt-BR')} fornecedores em ${resumo.categorias} grupos.`
                : 'Sua equipe ainda não subiu a vendor list.'
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/fornecedores"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
          >
            Ver a base
          </Link>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-black hover:bg-brand/90"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {resumo && resumo.total > 0 ? 'Atualizar vendor list' : 'Subir vendor list'}
          </button>
        </div>
      </div>

      <VendorListImportDialog
        open={aberto}
        onClose={() => {
          setAberto(false);
          void carregar();
        }}
        preview={previewVendorListImport}
        onConfirm={applyVendorListImport}
      />
    </div>
  );
}

// ─── Resultados ───────────────────────────────────────────────────────────

const VISIVEIS_VENDOR_LIST = 12;

export function BuscaAmpliadaResultados({ estado }: { estado: EstadoBuscaAmpliada }) {
  const [todos, setTodos] = useState(false);

  const carregando = (texto: string) => (
    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
      {texto}
    </p>
  );
  const vendorList = estado.vendorList === 'carregando' ? null : estado.vendorList;
  const web = estado.web === 'carregando' ? null : estado.web;
  const lista = !vendorList ? [] : todos ? vendorList.resultados : vendorList.resultados.slice(0, VISIVEIS_VENDOR_LIST);

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      {/* Vendor list */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="h-4 w-4 text-brand" aria-hidden="true" />
          Na sua vendor list
          {vendorList && (
            <span className="text-xs font-normal text-muted-foreground">
              {vendorList.resultados.length} de {vendorList.total.toLocaleString('pt-BR')}
            </span>
          )}
        </h2>
        {vendorList && vendorList.categorias.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Grupos relacionados: {vendorList.categorias.join(', ')}
          </p>
        )}

        {!vendorList ? (
          carregando('Procurando na sua vendor list…')
        ) : vendorList.erro ? (
          <p className="mt-3 text-sm text-muted-foreground">{vendorList.erro}</p>
        ) : vendorList.total === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            A vendor list da equipe ainda está vazia. Use “Subir vendor list” na tela inicial da busca.
          </p>
        ) : lista.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum fornecedor da sua lista atende esse pedido.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {lista.map((f, i) => (
              <li key={`${f.razaoSocial}-${f.email ?? ''}-${i}`} className="py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium">{f.razaoSocial}</span>
                  {f.categoria && <span className="text-[11px] text-muted-foreground">{f.categoria}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {(f.municipio || f.uf) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {[f.municipio, f.uf].filter(Boolean).join(' - ')}
                    </span>
                  )}
                  {f.telefone && (
                    <a href={`tel:${f.telefone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {f.telefone}
                    </a>
                  )}
                  {f.email && (
                    <a href={`mailto:${f.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Mail className="h-3 w-3" aria-hidden="true" />
                      {f.email}
                    </a>
                  )}
                </div>
                {f.notas && <p className="mt-1 text-xs text-muted-foreground/80">{f.notas}</p>}
              </li>
            ))}
          </ul>
        )}
        {vendorList && vendorList.resultados.length > VISIVEIS_VENDOR_LIST && (
          <button
            type="button"
            onClick={() => setTodos((v) => !v)}
            className="mt-2 text-xs font-medium text-brand hover:underline"
          >
            {todos ? 'Mostrar menos' : `Ver todos os ${vendorList.resultados.length}`}
          </button>
        )}
      </section>

      {/* Internet */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-brand" aria-hidden="true" />
          Na internet
          {web && web.fornecedores.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{web.fornecedores.length} encontrados</span>
          )}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Resultado de busca na web, confirme preço, estoque e dados antes de comprar.
        </p>

        {!web ? (
          carregando('Procurando na internet… costuma levar uns 15 segundos.')
        ) : web.erro ? (
          <p className="mt-3 text-sm text-muted-foreground">{web.erro}</p>
        ) : web.fornecedores.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {web.fornecedores.map((f, i) => (
              <li key={`${f.nome}-${i}`} className="py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium">{f.nome}</span>
                  {(f.cidade || f.uf) && (
                    <span className="text-[11px] text-muted-foreground">
                      {[f.cidade, f.uf].filter(Boolean).join(' - ')}
                    </span>
                  )}
                </div>
                {f.oQueVende && <p className="mt-0.5 text-xs text-muted-foreground">{f.oQueVende}</p>}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {f.site && (
                    <a
                      href={f.site}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      {new URL(f.site).hostname.replace(/^www\./, '')}
                    </a>
                  )}
                  {f.telefone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {f.telefone}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : web.texto ? (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{web.texto}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma empresa encontrada na internet para esse pedido.</p>
        )}
      </section>
    </div>
  );
}
