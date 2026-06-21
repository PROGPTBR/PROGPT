'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Header } from '../login/header';

import {  Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

const FAQS = [
  'O que é o PROGPT?',
  'Qual a diferença em relação ao ChatGPT genérico?',
  'A base de conhecimento é da minha empresa ou compartilhada?',
  'Quanto custa? Tem plano gratuito?',
  'Como funcionam os 7 assistentes (RFP, Kraljic, Negociação…)?',
  'Posso baixar os artefatos em Word ou Excel?',
  'Como cancelo a assinatura?',
];

export default function FaqPage() {
const router = useRouter();
  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
   

        <main className="max-w-7xl mx-auto px-6 py-12">

           <div className="max-w-7xl mx-auto px-6 py-16 flex items-center justify-between">
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
           className="px-6 md:px-12 max-w-7xl mx-auto border-border"
         >
           <div className="mb-16 reveal">
             <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-center">
               <span className="text-foreground">Suas dúvidas,</span>{' '}
               <span className="text-brand">respondidas com clareza.</span>
             </h2>
           </div>
 
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 reveal">
             <div className="space-y-4">
               {FAQS.slice(0, 3).map((q) => (
                 <div
                   key={q}
                   className="border-b border-border py-4 px-4 border hover:border-border rounded-2xl flex justify-between items-center cursor-pointer group"
                 >
                   <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                     {q}
                   </span>
                   <Plus className="w-4 h-4 text-muted-foreground group-hover:text-brand transition-colors" aria-hidden="true" />
                 </div>
               ))}
             </div>
             <div className="space-y-4">
               {FAQS.slice(3).map((q) => (
                 <div
                   key={q}
                   className="border-b border-border py-4 px-4 border hover:border-border rounded-2xl  flex justify-between items-center cursor-pointer group"
                 >
                   <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                     {q}
                   </span>
                   <Plus className="w-4 h-4 text-muted-foreground group-hover:text-brand transition-colors" aria-hidden="true" />
                 </div>
               ))}
             </div>
           </div>
         </section>


        </main>
      </div>
    </>
  );
}