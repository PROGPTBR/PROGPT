// Tour de primeiro acesso — roteiro completo do produto.
//
// Os passos vivem aqui (e não dentro do componente) por dois motivos: o texto
// é conteúdo de produto, que muda mais do que a mecânica do tour; e o cálculo
// de posicionamento do cartão é pura aritmética, testável sem browser.
//
// `target` é um seletor CSS do elemento real da tela. Passo sem alvo — ou com
// alvo ausente (sidebar recolhida, celular com a gaveta fechada) — vira um
// cartão centrado, então o tour nunca trava num passo que não dá para mostrar.

export type TourStep = {
  id: string;
  target?: string;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'boas-vindas',
    title: 'Bem-vindo ao PROGPT',
    body: 'Em um minuto você conhece tudo que a plataforma faz. Pode sair quando quiser — e rever o tour depois, pelo rodapé da barra lateral.',
  },
  {
    id: 'composer',
    target: '[data-tour="composer"]',
    title: 'Comece perguntando',
    body: 'Escreva aqui qualquer dúvida de compras. As respostas são fundamentadas na base de conhecimento de Strategic Sourcing — e, quando não há fonte, o PROGPT diz isso em vez de inventar.',
  },
  {
    id: 'atalhos',
    target: '[aria-label="Atalhos para assistentes"]',
    title: 'As ferramentas vêm até você',
    body: 'Não precisa saber onde cada coisa fica. Pedindo um preço de referência, a situação de um CNPJ ou os indicadores do mês, o próprio chat aciona a ferramenta e depois sugere a tela completa.',
  },
  {
    id: 'voz',
    target: '[data-tour="voz"]',
    title: 'Converse por voz',
    body: 'Fale com o PROGPT em tempo real, com a mesma base por trás. Útil para ensaiar uma negociação ou tirar dúvidas com as mãos ocupadas.',
  },
  {
    id: 'modo-livre',
    target: '[data-tour="modo-livre"]',
    title: 'Modo Livre',
    body: 'Liga o assistente pessoal: assunto livre, fora de compras, com busca na web ao vivo para o que depende de informação atual.',
  },
  {
    id: 'nav-assistants',
    target: '[data-tour="nav-assistants"]',
    title: 'Assistentes',
    body: 'As ferramentas que executam tarefas: RFP, Matriz Kraljic, Curva ABC, Scorecard de fornecedor, Análise de Gastos, Pesquisa de Preços e mais. Entregam documento .docx e planilha .xlsx prontos para enviar.',
  },
  {
    id: 'nav-fluxo',
    target: '[data-tour="nav-fluxo"]',
    title: 'Fluxo de Compras',
    body: 'Conduz uma compra inteira em oito etapas, da solicitação ao recebimento. A IA executa cada etapa e para para você decidir: SIGA avança, AJUSTAR manda refazer. Nada anda sem a sua decisão.',
  },
  {
    id: 'nav-painel',
    target: '[data-tour="nav-painel"]',
    title: 'Painel',
    body: 'A visão geral do seu ambiente: o que já foi analisado, quanto de gasto passou pela plataforma e a atividade ao longo dos meses.',
  },
  {
    id: 'nav-dashboard',
    target: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    body: 'Suba uma planilha sua e ela vira um painel de indicadores, com rankings e cruzamentos — sem precisar montar gráfico à mão.',
  },
  {
    id: 'nav-fornecedores',
    target: '[data-tour="nav-fornecedores"]',
    title: 'Fornecedores',
    body: 'Sua base própria de fornecedores: cadastro, situação fiscal, homologação e histórico. Dá para alimentá-la a partir da busca por atividade e região.',
  },
  {
    id: 'nav-prompts',
    target: '[data-tour="nav-prompts"]',
    title: 'Biblioteca de Prompts',
    body: 'Dezenas de perguntas prontas de procurement, organizadas por tema. Clique em "Usar no chat" e ajuste os campos entre colchetes com os dados da sua compra.',
  },
  {
    id: 'conversas',
    target: '[data-tour="conversas"]',
    title: 'Suas conversas ficam salvas',
    body: 'Cada conversa fica no histórico, com busca. Dá para renomear e continuar de onde parou — inclusive de outro computador.',
  },
  {
    id: 'conta',
    target: '[data-tour="conta"]',
    title: 'Sua conta',
    body: 'Aqui ficam o seu perfil, os dados da empresa que entram nos documentos gerados, a assinatura e — se você contratou mais de um acesso — os convites da sua equipe.',
  },
  {
    id: 'suporte',
    target: '[data-tour="suporte"]',
    title: 'Suporte de gente',
    body: 'Travou em alguma coisa? O WhatsApp da 2B Supply fica sempre aqui no rodapé.',
  },
  {
    id: 'fim',
    title: 'Pronto para começar',
    body: 'A forma mais rápida de ver valor é fazer uma pergunta real da sua rotina de compras. Se quiser rever este tour, ele fica no rodapé da barra lateral.',
  },
];

export type Rect = { top: number; left: number; width: number; height: number };
export type Point = { top: number; left: number };

/**
 * Onde encaixar o cartão do tour em relação ao elemento destacado.
 *
 * Tenta, nesta ordem: à direita, abaixo, acima, à esquerda. Nenhuma cabendo,
 * centraliza. O resultado é sempre preso à janela com a margem mínima, então o
 * cartão nunca sai da tela — nem quando o alvo está colado numa borda.
 */
export function placeCard(
  rect: Rect | null,
  viewport: { width: number; height: number },
  card: { width: number; height: number },
  gap = 14,
  margin = 16,
): Point {
  const center = (): Point => ({
    top: Math.max(margin, (viewport.height - card.height) / 2),
    left: Math.max(margin, (viewport.width - card.width) / 2),
  });

  if (!rect) return center();

  const clamp = (value: number, max: number) =>
    Math.max(margin, Math.min(value, max));

  const maxLeft = viewport.width - card.width - margin;
  const maxTop = viewport.height - card.height - margin;

  // Sem espaço para o cartão em lugar nenhum (janela muito pequena): centraliza.
  if (maxLeft < margin || maxTop < margin) return center();

  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  if (right + gap + card.width <= viewport.width - margin) {
    return { top: clamp(rect.top, maxTop), left: right + gap };
  }

  if (bottom + gap + card.height <= viewport.height - margin) {
    return { top: bottom + gap, left: clamp(rect.left, maxLeft) };
  }

  if (rect.top - gap - card.height >= margin) {
    return { top: rect.top - gap - card.height, left: clamp(rect.left, maxLeft) };
  }

  if (rect.left - gap - card.width >= margin) {
    return { top: clamp(rect.top, maxTop), left: rect.left - gap - card.width };
  }

  return center();
}
