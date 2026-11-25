'use client';

import { ArrowLeft, Banknote, BellRing, CalendarDays, Download, FileSpreadsheet, FileText, MessageCircle, Printer, Send, Settings2, Stethoscope } from 'lucide-react';

// Guia de uso da Área Médica (sub-projeto 115). Escrito para o médico que
// "é zero de automação": um passo por vez, o que fazer e o que o sistema faz
// sozinho. Pouco texto; os títulos contam a história. Imprime como PDF.

const PASSOS = [
  {
    icone: Settings2,
    titulo: 'Cadastre os hospitais e o contador',
    onde: 'Cadastros',
    voce: 'Nome e e-mail de cada hospital, e o e-mail do contador que emite as suas notas.',
    sistema: 'É para esses e-mails que o pedido de nota e a cobrança vão sair, com um clique.',
  },
  {
    icone: BellRing,
    titulo: 'Informe o seu e-mail e o seu WhatsApp',
    onde: 'Integrações',
    voce: 'O e-mail que você usa e o número do seu WhatsApp.',
    sistema: 'As respostas do contador e do hospital voltam para o seu e-mail. Os avisos chegam no seu WhatsApp.',
  },
  {
    icone: CalendarDays,
    titulo: 'Marque as cirurgias na agenda',
    onde: 'Agenda',
    voce: 'Você ou a secretária: data, hora, hospital, paciente e procedimento. Ou cole as mensagens do grupo de WhatsApp, ou importe a planilha do mês.',
    sistema: 'Na véspera, manda a agenda do dia seguinte no seu WhatsApp. Depois da data, pergunta: aconteceu?',
  },
  {
    icone: FileText,
    titulo: 'Chegou o demonstrativo? Lance',
    onde: 'Demonstrativos e notas',
    voce: 'Cole o e-mail do hospital ou importe o PDF.',
    sistema: 'Confere linha por linha com as suas cirurgias e mostra, na hora, o que o hospital deixou de fora.',
  },
  {
    icone: Send,
    titulo: 'Peça a nota e envie ao hospital',
    onde: 'Demonstrativos e notas',
    voce: 'Clique em "Pedir a nota ao contador". Quando ela vier, anexe o PDF e clique em "Enviar ao hospital".',
    sistema: 'Escreve e envia os e-mails em seu nome, e avança a etapa sozinho: pedida, emitida, enviada, paga.',
  },
  {
    icone: FileSpreadsheet,
    titulo: 'Cobre o que ficou de fora',
    onde: 'Pendências a cobrar',
    voce: 'Clique em "Enviar ao hospital".',
    sistema: 'Monta a planilha de pendências no modelo que o hospital exige, envia, e guarda cada cobrança. O que continuar sem resposta volta para cobrar de novo.',
  },
  {
    icone: Banknote,
    titulo: 'Veja o dinheiro cair',
    onde: 'Banco',
    voce: 'Ligue a conta do BTG uma vez, ou suba o extrato do banco.',
    sistema: 'Marca a nota como paga quando o valor entra, e mostra na tela: "Pago".',
  },
] as const;

const DIARIO = [
  ['Toda manhã', 'Um aviso no WhatsApp com o que está parado: nota para pedir, nota para enviar, pagamento atrasado.'],
  ['Na véspera', 'A agenda do dia seguinte, com hora, hospital e procedimento.'],
  ['Ao entrar', 'O cockpit: a receber, o que ficou sem pagamento, e o que fazer agora. Cada peça abre a tela certa.'],
] as const;

export function Guia() {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-16 sm:px-8 lg:px-10 lg:py-10">
      <style>{`@media print { nav, header, .nao-imprime { display: none !important } body { background: white } }`}</style>
      <div className="nao-imprime mb-6 flex flex-wrap items-center justify-between gap-3">
        <a href="/area-medica" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
        </a>
        <div className="flex gap-2">
          <a href="/docs/area-medica-como-usar.pdf" download className="inline-flex h-10 items-center gap-2 rounded-full bg-medico px-4 text-sm font-semibold text-white hover:bg-medico/90">
            <Download className="h-4 w-4" aria-hidden /> Baixar o guia em PDF
          </a>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold hover:bg-neutral-200">
            <Printer className="h-4 w-4" aria-hidden /> Imprimir
          </button>
        </div>
      </div>

      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-medico text-white">
          <Stethoscope className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Como usar a Área Médica</h1>
          <p className="text-sm text-neutral-500">Você opera. O app cobra, confere e avisa quando o dinheiro cai.</p>
        </div>
      </header>

      <section className="nao-imprime mt-8 overflow-hidden rounded-[2rem] bg-[#061230] shadow-[0_18px_50px_rgba(10,31,77,0.25)]">
        <video controls playsInline preload="metadata" poster="/videos/area-medica-capa.jpg" className="aspect-video w-full">
          <source src="/videos/area-medica.mp4" type="video/mp4" />
        </video>
        <p className="px-5 py-3 text-sm text-white/70">Vídeo de 1 minuto e 20: o caminho inteiro, da cirurgia ao dinheiro na conta.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Sete passos</h2>
        <ol className="mt-4 space-y-4">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.06] break-inside-avoid">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-medico/10 text-medico">
                  <p.icone className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-medico">
                    Passo {i + 1} · {p.onde}
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold">{p.titulo}</h3>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-neutral-50 p-3">
                      <dt className="text-xs font-semibold text-neutral-500">Você faz</dt>
                      <dd className="mt-1">{p.voce}</dd>
                    </div>
                    <div className="rounded-2xl bg-medico/5 p-3">
                      <dt className="text-xs font-semibold text-medico">O app faz</dt>
                      <dd className="mt-1">{p.sistema}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-3xl bg-white p-5 ring-1 ring-black/[0.06] break-inside-avoid">
        <h2 className="text-lg font-semibold">No dia a dia, sem você fazer nada</h2>
        <ul className="mt-3 divide-y divide-neutral-200">
          {DIARIO.map(([quando, oQue]) => (
            <li key={quando} className="flex gap-4 py-3 text-sm">
              <span className="w-28 shrink-0 font-semibold">{quando}</span>
              <span className="text-neutral-700">{oQue}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-3xl bg-medico p-5 text-white break-inside-avoid">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="h-5 w-5" aria-hidden /> Precisa de ajuda?
        </h2>
        <p className="mt-1 text-sm text-white/85">Fale com a 2B Supply pelo WhatsApp (21) 99979-2912 ou por comercial@2bsupply.com.br. Entrada do sistema: 2bsupply.ia.br/medicos</p>
      </section>
    </div>
  );
}
