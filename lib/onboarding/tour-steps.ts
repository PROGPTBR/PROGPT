// Tour de primeiro acesso — roteiro completo do produto, PÁGINA POR PÁGINA.
//
// Os passos vivem aqui (e não dentro do componente) por dois motivos: o texto
// é conteúdo de produto, que muda mais do que a mecânica do tour; e o cálculo
// de posicionamento do cartão é pura aritmética, testável sem browser.
//
// `route` é a tela onde o passo acontece: o <TourHost/> navega até ela antes
// de mostrar o passo (sub-projeto 70 — antes o tour rodava só no /chat).
// `target` é um seletor CSS do elemento real da tela. Passo sem alvo — ou com
// alvo ausente (sidebar recolhida, celular com a gaveta fechada, tela que não
// carregou a tempo) — vira um cartão centrado, então o tour nunca trava.
//
// Ao incluir uma tela nova no tour, mantenha os passos da MESMA rota juntos:
// cada troca de rota é uma navegação, e ir e voltar entre telas cansa.

export type TourStep = {
  id: string;
  route: string;
  /** Nome da seção mostrado no cartão ("Fluxo de Compras · Passo 9 de 29"). */
  secao?: string;
  target?: string;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  // ── Chat ──────────────────────────────────────────────────────────────
  {
    id: 'boas-vindas',
    route: '/chat',
    title: 'Bem-vindo ao PROGPT',
    body: 'Vamos passar por cada tela da plataforma, uma por uma, e mostrar o que cada uma faz. Pode sair quando quiser — e rever o tour depois pelo botão "Ver o tour da plataforma", no topo da barra lateral.',
  },
  {
    id: 'composer',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="composer"]',
    title: 'Comece perguntando',
    body: 'Escreva aqui qualquer dúvida de compras. As respostas são fundamentadas na base de conhecimento de Strategic Sourcing — e, quando não há fonte, o PROGPT diz isso em vez de inventar. Dá para anexar contrato ou proposta pelo clipe.',
  },
  {
    id: 'atalhos',
    route: '/chat',
    secao: 'Chat',
    target: '[aria-label="Atalhos para assistentes"]',
    title: 'As ferramentas vêm até você',
    body: 'Não precisa saber onde cada coisa fica. Pedindo um preço de referência, a situação de um CNPJ ou os indicadores do mês, o próprio chat aciona a ferramenta e depois sugere a tela completa.',
  },
  {
    id: 'voz',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="voz"]',
    title: 'Converse por voz',
    body: 'Fale com o PROGPT em tempo real, com a mesma base por trás. Útil para ensaiar uma negociação ou tirar dúvidas com as mãos ocupadas.',
  },
  {
    id: 'modo-livre',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="modo-livre"]',
    title: 'Modo Livre',
    body: 'Liga o assistente pessoal: assunto livre, fora de compras, com busca na web ao vivo para o que depende de informação atual.',
  },
  {
    id: 'conversas',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="conversas"]',
    title: 'Suas conversas ficam salvas',
    body: 'Cada conversa fica no histórico, com busca. Dá para renomear e continuar de onde parou — inclusive de outro computador.',
  },
  {
    id: 'navegacao',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="navegacao"]',
    title: 'Os módulos da plataforma',
    body: 'Cada item deste menu abre um módulo. A partir do próximo passo, o tour visita um por um — é só ir clicando em "Próximo".',
  },

  // ── Assistentes ───────────────────────────────────────────────────────
  {
    id: 'assistentes-grade',
    route: '/assistants',
    secao: 'Assistentes',
    target: '[data-tour="assistentes-grade"]',
    title: 'Assistentes que executam tarefas',
    body: 'Cada cartão é uma ferramenta de Strategic Sourcing: RFP, Matriz Kraljic, 5 Forças de Porter, Curva ABC, Scorecard de fornecedor, Análise Financeira, Análise de Gastos, Pesquisa de Preços, Homologação, Negociação e outras. Você preenche o pedido e recebe documento .docx e planilha .xlsx prontos.',
  },
  {
    id: 'assistentes-historico',
    route: '/assistants',
    secao: 'Assistentes',
    target: '[data-tour="assistentes-historico"]',
    title: 'Histórico de execuções',
    body: 'Tudo o que você já gerou com os assistentes fica aqui: dá para reabrir, pedir ajustes conversando com a IA e baixar os arquivos de novo.',
  },

  // ── Biblioteca de Prompts ─────────────────────────────────────────────
  {
    id: 'prompts-categorias',
    route: '/prompts',
    secao: 'Prompts',
    target: '[data-tour="prompts-categorias"]',
    title: 'Perguntas prontas por tema',
    body: 'Dezenas de prompts de procurement organizados por categoria. Em "Favoritos" ficam os que você marcou com a estrela.',
  },
  {
    id: 'prompts-busca',
    route: '/prompts',
    secao: 'Prompts',
    target: '[data-tour="prompts-busca"]',
    title: 'Busque pelo que precisa',
    body: 'Filtre por título, resumo ou tag — por exemplo "negociação", "contrato" ou "fornecedor".',
  },
  {
    id: 'prompts-lista',
    route: '/prompts',
    secao: 'Prompts',
    target: '[data-tour="prompts-lista"]',
    title: 'Do prompt ao chat em um clique',
    body: 'Abra um prompt para ler e clique em "Usar no chat": ele chega pronto no chat, e você só ajusta os campos entre colchetes com os dados da sua compra.',
  },

  // ── Fluxo de Compras ──────────────────────────────────────────────────
  {
    id: 'fluxo-trilha',
    route: '/fluxo',
    secao: 'Fluxo de Compras',
    target: '[data-tour="fluxo-trilha"]',
    title: 'Uma compra em oito etapas',
    body: 'Solicitação, aprovação, seleção de fornecedores, RFQ, análise e negociação, pedido de compra, acompanhamento e recebimento. A primeira linha é a fase de sourcing; a segunda, a de compra até a entrega.',
  },
  {
    id: 'fluxo-acoes',
    route: '/fluxo',
    secao: 'Fluxo de Compras',
    target: '[data-tour="fluxo-acoes"]',
    title: 'Você decide cada passo',
    body: 'Descreva a necessidade para abrir um processo. A IA executa cada etapa e para para você decidir: SIGA avança, AJUSTAR manda refazer com a sua correção. Em "Gestão dos processos" você acompanha todos de uma vez.',
  },

  // ── Painel ────────────────────────────────────────────────────────────
  {
    id: 'painel-cabecalho',
    route: '/painel',
    secao: 'Painel',
    target: '[data-tour="painel-cabecalho"]',
    title: 'Tudo o que você fez, num lugar',
    body: 'O Painel junta os dados de todas as ferramentas da sua conta. Os números são recalculados sempre que você abre a tela — e o botão "Atualizar" recarrega na hora.',
  },
  {
    id: 'painel-kpis',
    route: '/painel',
    secao: 'Painel',
    target: '[data-tour="painel-kpis"]',
    title: 'Indicadores da sua conta',
    body: 'Conversas, execuções de assistentes, gasto analisado, notas processadas, fornecedores e categorias. Logo abaixo vêm a atividade dos últimos 12 meses e, depois que você roda a Análise de Gastos, o gasto por categoria, fornecedor e mês.',
  },

  // ── Dashboard ─────────────────────────────────────────────────────────
  {
    id: 'dashboard-upload',
    route: '/dashboard',
    secao: 'Dashboard',
    target: '[data-tour="dashboard-upload"]',
    title: 'Sua planilha vira dashboard',
    body: 'Arraste aqui uma planilha .xlsx ou .csv e o PROGPT monta os painéis sozinho, com rankings e cruzamentos — sem precisar desenhar gráfico à mão.',
  },
  {
    id: 'dashboard-exemplos',
    route: '/dashboard',
    secao: 'Dashboard',
    target: '[data-tour="dashboard-exemplos"]',
    title: 'Comece por um exemplo',
    body: 'Sem planilha à mão? Abra os dados de exemplo ou um template para ver como fica. Os dashboards que você salvar aparecem nesta tela para abrir depois.',
  },

  // ── Fornecedores ──────────────────────────────────────────────────────
  {
    id: 'fornecedores-abas',
    route: '/fornecedores',
    secao: 'Fornecedores',
    target: '[data-tour="fornecedores-abas"]',
    title: 'Suas bases de fornecedores e materiais',
    body: 'Duas bases próprias da sua empresa: a de fornecedores, com cadastro, situação e histórico, e a de materiais. Alterne entre elas por estas abas.',
  },
  {
    id: 'fornecedores-acoes',
    route: '/fornecedores',
    secao: 'Fornecedores',
    target: '[data-tour="fornecedores-acoes"]',
    title: 'Alimente a base',
    body: 'Importe a sua vendor list de uma planilha ou cadastre um fornecedor à mão. Também dá para salvar direto da Busca de Fornecedores, que procura empresas por atividade (CNAE) e região.',
  },
  {
    id: 'fornecedores-busca',
    route: '/fornecedores',
    secao: 'Fornecedores',
    target: '[data-tour="fornecedores-busca"]',
    title: 'Encontre rápido',
    body: 'Busque por nome, categoria, CNAE ou cidade e filtre pelo status de cada fornecedor — de prospecto a homologado, ativo ou bloqueado.',
  },

  // ── Gestão de Obras (vitrine) ─────────────────────────────────────────
  {
    id: 'obras-abas',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    target: '[data-tour="vitrine-abas"]',
    title: 'Gestão de Obras',
    body: 'Gestão de obras públicas: visão geral da carteira, contratos e obras com a planilha orçamentária, boletins de medição e planejamento das frentes por quinzena. Navegue pelas abas — os dados desta tela são de exemplo.',
  },
  {
    id: 'obras-contato',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    target: '[data-tour="vitrine-contato"]',
    title: 'Implantado sob demanda',
    body: 'Este módulo é implantado com os contratos, obras e o processo da sua empresa. Quer na sua operação? Fale com a 2B Supply por aqui.',
  },

  // ── Gestão de Demandas (vitrine) ──────────────────────────────────────
  {
    id: 'demandas-abas',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    target: '[data-tour="vitrine-abas"]',
    title: 'Gestão de Demandas',
    body: 'Solicitações entre setores com responsável, prazo, percentual de conclusão, histórico e validação da entrega — mais o quadro de fluxo e os relatórios. Também com dados de exemplo.',
  },
  {
    id: 'demandas-contato',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    target: '[data-tour="vitrine-contato"]',
    title: 'Também sob demanda',
    body: 'Os setores, as pessoas e as regras de prazo são configurados para a sua empresa na implantação. O pedido é por aqui.',
  },

  // ── Meu perfil ────────────────────────────────────────────────────────
  {
    id: 'perfil-topo',
    route: '/profile',
    secao: 'Meu perfil',
    target: '[data-tour="perfil-topo"]',
    title: 'Seu perfil, em dois passos',
    body: 'Aqui você preenche uma vez os dados da sua empresa. Depois disso, eles entram sozinhos em todo documento e planilha que o PROGPT gerar — não precisa digitar de novo.',
  },
  {
    id: 'perfil-logo',
    route: '/profile',
    secao: 'Meu perfil',
    target: '[data-tour="perfil-logo"]',
    title: '1. O logo da empresa',
    body: 'Clique em "Enviar logo" e escolha a imagem (PNG ou JPG). Ela aparece na capa dos documentos. Dá para trocar ou remover quando quiser.',
  },
  {
    id: 'perfil-dados',
    route: '/profile',
    secao: 'Meu perfil',
    target: '[data-tour="perfil-dados"]',
    title: '2. Os dados da empresa',
    body: 'Basta o nome da empresa para começar; CNPJ, telefone e e-mail são opcionais. Em "Mais detalhes" ficam razão social, endereço e uma apresentação curta. No fim, clique em "Salvar dados".',
  },

  // ── Conta ─────────────────────────────────────────────────────────────
  {
    id: 'conta-assinatura',
    route: '/account/billing',
    secao: 'Sua conta',
    target: '[data-tour="conta-assinatura"]',
    title: 'Sua assinatura',
    body: 'Plano, situação, forma de pagamento e próxima cobrança. Se você contratou mais de um acesso, os convites da sua equipe também ficam nesta tela.',
  },

  // ── De volta ao chat ──────────────────────────────────────────────────
  {
    id: 'conta',
    route: '/chat',
    secao: 'Para fechar',
    target: '[data-tour="conta"]',
    title: 'Sua conta, sempre à mão',
    body: 'O ícone com a sua inicial, no canto superior direito de todas as telas, abre a sua conta: Meu perfil, Assinatura e Sair. Ao lado dele fica o botão de tema claro ou escuro.',
  },
  {
    id: 'suporte',
    route: '/chat',
    secao: 'Para fechar',
    target: '[data-tour="suporte"]',
    title: 'Suporte sempre à mão',
    body: 'Este botão fica no canto inferior direito de todas as telas: abre as perguntas frequentes sobre o sistema, com busca, e o WhatsApp da 2B Supply para falar com a gente.',
  },
  {
    id: 'fim',
    route: '/chat',
    title: 'Pronto para começar',
    body: 'A forma mais rápida de ver valor é fazer uma pergunta real da sua rotina de compras. Para rever este tour, use "Ver o tour da plataforma", no topo da barra lateral.',
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
