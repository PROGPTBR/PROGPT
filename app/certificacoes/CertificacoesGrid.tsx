"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Certificacao = {
  numero: string;
  titulo: string;
  descricao: string;
  imagem: string;
  pdf: string;
};

export default function CertificacoesGrid({
  certificacoes,
}: {
  certificacoes: readonly Certificacao[];
}) {
  const [selecionado, setSelecionado] = useState<Certificacao | null>(null);

  return (
    <>
<style>{`
  [data-slot=dialog-overlay] {
    background: rgba(0, 5, 14, 0.82);
    backdrop-filter: blur(6px);
  }
`}</style>

      <div className="progpt-certifications-grid">
        {certificacoes.map((certificado) => (
          <article className="progpt-certifications-card" key={certificado.numero}>
            <button
              type="button"
              className="progpt-certifications-image progpt-certifications-preview"
              onClick={() => setSelecionado(certificado)}
              aria-label={`Visualizar certificado ${certificado.numero}`}
            >
              <img
                src={certificado.imagem}
                alt={`Arte da certificação ${certificado.numero}`}
                width={1672}
                height={941}
                loading="lazy"
              />
            </button>

            <div className="progpt-certifications-body">
              <span>CERTIFICAÇÃO</span>
              <h3>{certificado.numero}</h3>
              <p className="progpt-certifications-name">{certificado.titulo}</p>
              <p className="progpt-certifications-description">{certificado.descricao}</p>
              <button
                type="button"
                className="progpt-certifications-link progpt-certifications-trigger"
                onClick={() => setSelecionado(certificado)}
              >
                Ver certificado <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={selecionado !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setSelecionado(null);
        }}
      >
        <DialogContent className="!w-[94vw] !max-w-[1100px] !gap-0 overflow-hidden !border !border-[#183146] !bg-[#020812] !p-0 text-white shadow-2xl">
          <DialogHeader className="!gap-1 px-6 py-5 pr-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#27d6ec]">
              Nossas certificações
            </span>
            <DialogTitle className="text-left text-xl font-bold leading-tight text-white md:text-2xl">
              {selecionado?.numero}, {selecionado?.titulo}
            </DialogTitle>
          </DialogHeader>

          {selecionado && (
            <iframe
              key={selecionado.pdf}
              src={selecionado.pdf}
              title={`Certificado ${selecionado.numero} em PDF`}
              className="block w-full border-0 bg-white"
              style={{ height: "min(70vh, 760px)" }}
            />
          )}

          <div className="flex justify-end border-t border-white/10 px-6 py-3">
            {selecionado && (
              <a
                href={selecionado.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#27d6ec] hover:underline"
              >
                Abrir PDF em nova aba ↗
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
