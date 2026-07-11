'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { Header } from '../login/header';

export const dynamic = 'force-dynamic';

// Perguntas + respostas curadas pelo gestor (2026-07-08). Copy provisória —
// "pode colocar estes textos, depois melhoramos".
const FAQS: { q: string; a: string }[] = [
  {
    q: 'O que é o PROGPT?',
    a: 'O PROGPT é uma IA especializada em Suprimentos, criada para apoiar compradores, gestores e empresas em análises, cotações, contratos, negociação, estratégia de categorias e tomada de decisão.',
  },
  {
    q: 'Quanto custa? Tem plano gratuito?',
    a: 'Sim. O PROGPT possui plano gratuito para uso inicial e planos pagos com mais recursos, mais mensagens, upload de arquivos, histórico, acesso aos assistentes e funcionalidades avançadas.',
  },
  {
    q: 'Qual a diferença em relação ao ChatGPT genérico?',
    a: 'O ChatGPT genérico responde sobre vários assuntos. O PROGPT foi criado para Suprimentos. Ele entende compras, fornecedores, contratos, RFI, RFQ, Kraljic, TCO, Curva ABC, negociação e rotinas reais da área.',
  },
  {
    q: 'Como funcionam os assistentes?',
    a: 'Cada assistente foi criado para uma necessidade específica de Suprimentos. Você escolhe o tema, como RFI/RFQ, Kraljic, Negociação, TCO, Curva ABC ou pedidos, informa os dados e recebe uma análise prática, estruturada e pronta para uso.',
  },
  {
    q: 'A base de conhecimento é da minha empresa ou compartilhada?',
    a: 'Depende do plano contratado. No plano individual, o usuário acessa a base padrão do PROGPT. No plano empresa, a IA pode trabalhar com documentos, políticas, processos e informações internas da própria contratante, conforme os requisitos de TI e compliance.',
  },
  {
    q: 'Posso baixar os artefatos em Word ou Excel?',
    a: 'Sim. O PROGPT pode gerar materiais prontos para uso, como análises, relatórios, comparativos, planos de ação, modelos de RFI/RFQ e planilhas, que podem ser baixados em Word ou Excel, conforme a funcionalidade disponível.',
  },
  {
    q: 'Como cancelo a assinatura?',
    a: 'O cancelamento pode ser solicitado de forma simples pelo canal de atendimento ou pela área de gestão da assinatura. Para pessoa física, o direito de arrependimento segue as regras previstas na legislação aplicável. Após esse prazo, o cliente também poderá cancelar a renovação da assinatura a qualquer momento.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-2xl overflow-hidden transition-colors hover:border-brand/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex justify-between items-center gap-4 py-4 px-4 text-left cursor-pointer group"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        {open ? (
          <Minus className="w-4 h-4 flex-shrink-0 text-brand" aria-hidden="true" />
        ) : (
          <Plus className="w-4 h-4 flex-shrink-0 text-muted-foreground group-hover:text-brand transition-colors" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 -mt-1">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const router = useRouter();
  const mid = Math.ceil(FAQS.length / 2);
  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="max-w-7xl mx-auto px-0 sm:px-6 py-6 sm:py-16 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-3xl text-foreground md:text-4xl font-semibold tracking-tight mx-auto text-center">
              FAQ <span className="text-brand">.</span>
            </h1>
          </div>

          {/* ───── FAQ ───── */}
          <section
            id="faq"
            className="px-0 sm:px-6 md:px-12 max-w-7xl mx-auto border-border"
          >
            <div className="mb-10 sm:mb-16 reveal">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-center">
                <span className="text-foreground">Suas dúvidas,</span>{' '}
                <span className="text-brand">respondidas com clareza.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 items-start reveal">
              <div className="space-y-4">
                {FAQS.slice(0, mid).map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
              <div className="space-y-4">
                {FAQS.slice(mid).map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
