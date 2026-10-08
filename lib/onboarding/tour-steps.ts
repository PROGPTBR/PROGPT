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
  /**
   * Aba interna da tela onde o passo acontece (telas com abas próprias, como
   * as vitrines). O tour pede a troca via TOUR_ABA_EVENT antes de procurar o alvo.
   */
  aba?: string;
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
    body: 'Vamos passar por cada tela da plataforma, uma por uma, e mostrar o que cada uma faz. Pode sair quando quiser, e rever o tour depois pelo botão "Ver o tour da plataforma", no topo da barra lateral.',
  },
  {
    id: 'composer',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="composer"]',
    title: 'Comece perguntando',
    body: 'Escreva aqui qualquer dúvida de compras. As respostas são fundamentadas na base de conhecimento de Strategic Sourcing, e, quando não há fonte, o PROGPT diz isso em vez de inventar. Dá para anexar contrato ou proposta pelo clipe.',
  },
  {
    id: 'anexo',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="anexo"]',
    title: 'Anexe o documento da compra',
    body: 'Pelo botão de mais, você anexa contrato, proposta, planilha ou foto (PDF, Word, Excel, PNG, JPG). O PROGPT lê o arquivo e responde em cima dele: resume cláusulas, compara propostas, aponta riscos.',
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
    body: 'Cada conversa fica no histórico, com busca. Dá para renomear e continuar de onde parou, inclusive de outro computador.',
  },
  {
    id: 'navegacao',
    route: '/chat',
    secao: 'Chat',
    target: '[data-tour="navegacao"]',
    title: 'Os módulos da plataforma',
    body: 'Cada item deste menu abre um módulo. A partir do próximo passo, o tour visita um por um, é só ir clicando em "Próximo".',
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

  // ── Equalizador de Propostas ──────────────────────────────────────────
  {
    id: 'equalizador-topo',
    route: '/assistants/comprador',
    secao: 'Equalizador',
    target: '[data-tour="equalizador-topo"]',
    title: 'Equalizador de Propostas',
    body: 'A sua caixa de cotações. Cole ou importe as propostas dos fornecedores e o PROGPT compara pelo custo total (TCO), confere item a item contra o pedido de cotação e aponta desvios da sua política.',
  },
  {
    id: 'equalizador-nova',
    route: '/assistants/comprador',
    secao: 'Equalizador',
    target: '[data-tour="equalizador-nova"]',
    title: 'Comece por uma nova cotação',
    body: 'Clique em "Nova cotação". Para ver funcionando sem dados seus, use "Carregar exemplo" e depois "Analisar". O resultado traz a recomendação, o comparativo, os alertas e um rascunho de resposta ao fornecedor, que só sai com a sua aprovação.',
  },

  // ── Busca de Fornecedores ─────────────────────────────────────────────
  {
    id: 'busca-pedido',
    route: '/assistants/suppliers',
    secao: 'Busca de Fornecedores',
    target: '[data-tour="busca-pedido"]',
    title: 'Ache fornecedores reais',
    body: 'Descreva o que você compra e onde, em português mesmo. A IA identifica a atividade econômica e busca empresas ativas na base da Receita Federal, com porte, contato e cidade, para exportar ou salvar na sua base.',
  },
  {
    id: 'busca-exemplos',
    route: '/assistants/suppliers',
    secao: 'Busca de Fornecedores',
    target: '[data-tour="busca-exemplos"]',
    title: 'Use os exemplos como ponto de partida',
    body: 'Clique num exemplo para ver o formato do pedido. As buscas que você salvar aparecem logo acima, para rodar de novo com um clique.',
  },

  // ── Matriz de Kraljic ─────────────────────────────────────────────────
  {
    id: 'kraljic-form',
    route: '/assistants/kraljic',
    secao: 'Matriz de Kraljic',
    target: '[data-tour="kraljic-form"]',
    title: 'Classifique o seu portfólio',
    body: 'Liste os itens ou categorias com o gasto e as notas de risco e impacto. O PROGPT posiciona cada um nos quatro quadrantes (estratégico, alavancagem, gargalo e não crítico) e devolve o plano de ação de cada quadrante, com gráfico.',
  },
  {
    id: 'kraljic-exemplo',
    route: '/assistants/kraljic',
    secao: 'Matriz de Kraljic',
    target: '[data-tour="kraljic-exemplo"]',
    title: 'Teste com um exemplo pronto',
    body: '"Carregar exemplo" preenche um portfólio de demonstração. Também dá para importar a sua planilha. No fim, baixe o relatório em Word e a planilha em Excel.',
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
    body: 'Filtre por título, resumo ou tag, por exemplo "negociação", "contrato" ou "fornecedor".',
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
    body: 'O Painel junta os dados de todas as ferramentas da sua conta. Os números são recalculados sempre que você abre a tela, e o botão "Atualizar" recarrega na hora.',
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
    body: 'Arraste aqui uma planilha .xlsx ou .csv e o PROGPT monta os painéis sozinho, com rankings e cruzamentos, sem precisar desenhar gráfico à mão.',
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
    title: 'Encontre rápido, ou pergunte à IA',
    body: 'Busque por nome, grupo, cidade ou contato, sem se preocupar com acento ou plural. Ou escreva o que precisa, como no ChatGPT ("material para alvenaria em SP"), e clique em "Perguntar à IA": ela acha na sua base os fornecedores que atendem e diz por quê. Filtre também pelo status de cada fornecedor.',
  },

  // ── Gestão de Obras (vitrine) ─────────────────────────────────────────
  // Roteiro detalhado (pedido do diretor 2026-10-04, para treinar o time):
  // passa por cada aba da tela, trocando a aba sozinho via `aba`.
  {
    id: 'obras-abas',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'cockpit',
    target: '[data-tour="vitrine-abas"]',
    title: 'Gestão de Obras',
    body: 'Sistema para construtoras que executam obras públicas: contrato com o órgão, obras, planilha orçamentária, boletins de medição e planejamento das frentes. A tela tem quatro abas e o tour vai passar por todas. Os dados são de exemplo.',
  },
  {
    id: 'obras-kpis',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'cockpit',
    target: '[data-tour="obras-kpis"]',
    title: 'A carteira em números',
    body: 'Valor contratado é a soma das planilhas de todas as obras, já com BDI e desconto da licitação. Medido acumulado soma os boletins enviados ao órgão e os aprovados. Saldo a medir é o que falta medir. "Aguardando o órgão" é o valor já enviado que o órgão ainda não aprovou.',
  },
  {
    id: 'obras-graficos',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'cockpit',
    target: '[data-tour="obras-graficos"]',
    title: 'Faturamento e avanço',
    body: 'À esquerda, quanto foi medido em cada um dos últimos 6 meses, boletim em rascunho não entra, só o enviado ou aprovado. À direita, o avanço de cada obra: quanto já foi medido em relação ao valor contratado.',
  },
  {
    id: 'obras-carteira',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'cockpit',
    target: '[data-tour="obras-carteira"]',
    title: 'Carteira de obras',
    body: 'Uma linha por obra: órgão, engenheiro responsável, avanço, valor e prazo. O término previsto vem da ordem de serviço mais o prazo do contrato; o selo fica verde com folga, amarelo a 60 dias ou menos do fim e vermelho quando venceu. Clicar no nome da obra abre as medições dela.',
  },
  {
    id: 'obras-contratos',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'contratos',
    target: '[data-tour="obras-contratos"]',
    title: 'Contratos e obras',
    body: 'Cada contrato com um órgão (Estado ou Prefeitura) pode ter várias obras. Clique no contrato para ver as obras e, numa obra, a planilha orçamentária por grupo de serviço (fontes SINAPI, SICRO ou própria). O preço unitário final é o de referência mais o BDI, menos o desconto dado na licitação.',
  },
  {
    id: 'obras-bms',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'medicoes',
    target: '[data-tour="obras-bms"]',
    title: 'Boletins de medição',
    body: 'Cada mês a obra gera um boletim de medição (BM), que passa por três situações: rascunho, enviado ao órgão e aprovado. Escolha a obra no seletor acima e clique num boletim para abri-lo.',
  },
  {
    id: 'obras-boletim',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'medicoes',
    target: '[data-tour="obras-boletim"]',
    title: 'O boletim, item a item',
    body: 'Para cada serviço: quantidade contratada, o que já foi medido antes, o que entra nesta medição, o acumulado, o percentual executado e o valor deste boletim. No sistema contratado o boletim sai em PDF e Excel, no modelo pedido pelo órgão.',
  },
  {
    id: 'obras-kanban',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'planejamento',
    target: '[data-tour="obras-kanban"]',
    title: 'Planejamento por quinzena',
    body: 'As frentes de serviço de cada quinzena (dias 1 a 15 e 16 ao fim do mês) passam por quatro colunas: Planejado, Em execução, Conferência e Concluído. Cada cartão aponta o item da planilha e a equipe responsável, ligando o que foi planejado ao que vai ser medido.',
  },
  {
    id: 'obras-contato',
    route: '/gestao-obras',
    secao: 'Gestão de Obras',
    aba: 'cockpit',
    target: '[data-tour="vitrine-contato"]',
    title: 'Implantado sob demanda',
    body: 'O sistema é implantado com os contratos, as obras e o processo de medição de cada empresa. Interessou? O pedido é por aqui, direto no WhatsApp da 2B Supply.',
  },

  // ── Gestão de Demandas (vitrine) ──────────────────────────────────────
  {
    id: 'demandas-abas',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'visao',
    target: '[data-tour="vitrine-abas"]',
    title: 'Gestão de Demandas',
    body: 'Controla as Solicitações de Providência (SPs): um setor pede a outro uma ação, com responsável, prazo e uma entrega que quem pediu precisa validar. São quatro abas, e o tour vai passar por todas. Os dados são de exemplo.',
  },
  {
    id: 'demandas-kpis',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'visao',
    target: '[data-tour="demandas-kpis"]',
    title: 'Os indicadores',
    body: 'Quantas SPs existem e em que situação estão. "Conclusão no prazo" é a parte das concluídas que foi entregue até a data prevista; "tempo médio" é quantos dias, em média, uma SP leva da emissão à conclusão.',
  },
  {
    id: 'demandas-graficos',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'visao',
    target: '[data-tour="demandas-graficos"]',
    title: 'Por status e por setor',
    body: 'À esquerda, quantas SPs há em cada situação, de aberta a concluída. À direita, quantas cada setor recebeu, e, ao lado do número, quantas estão em atraso.',
  },
  {
    id: 'demandas-atraso',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'visao',
    target: '[data-tour="demandas-atraso"]',
    title: 'O que está atrasado',
    body: 'As SPs com o prazo vencido, da mais antiga para a mais nova. Clique em qualquer linha para abrir a SP completa.',
  },
  {
    id: 'demandas-setores',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'setores',
    target: '[data-tour="demandas-setores"]',
    title: 'O painel de cada setor',
    body: 'Escolha um setor para ver só as SPs dele. Acima dos cartões ficam a busca (por código, tema ou responsável), o filtro de situação e o botão "Nova SP".',
  },
  {
    id: 'demandas-cartoes',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'setores',
    target: '[data-tour="demandas-cartoes"]',
    title: 'Como ler um cartão',
    body: 'O código mostra setor, número e ano (ex.: SP-MKT-08/2026). A barra mostra o percentual concluído e os quatro tracinhos, a etapa: aberta, em andamento, validação e concluída. O selo de prazo fica verde com folga, amarelo quando vence em até 5 dias e vermelho quando atrasa. Clique no cartão para ver o histórico, os anexos e os pedidos de prorrogação.',
  },
  {
    id: 'demandas-fluxo',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'fluxo',
    target: '[data-tour="demandas-fluxo"]',
    title: 'Quadro de fluxo',
    body: 'Cinco colunas: Enviada, Recebida, Em andamento, Aguardando validação e Concluída. Ninguém arrasta cartão: a SP muda de coluna sozinha quando o setor confirma o recebimento, quando o responsável começa a trabalhar e quando a entrega vai para validação.',
  },
  {
    id: 'demandas-relatorios',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'relatorios',
    target: '[data-tour="demandas-relatorios"]',
    title: 'Relatórios',
    body: 'Filtre por setor, situação e prazo (no prazo, vencendo, atrasadas ou encerradas) para montar a lista que precisar. No sistema contratado, a lista é exportada em Excel ou PDF.',
  },
  {
    id: 'demandas-contato',
    route: '/gestao-demandas',
    secao: 'Gestão de Demandas',
    aba: 'visao',
    target: '[data-tour="vitrine-contato"]',
    title: 'Também sob demanda',
    body: 'Os setores, as pessoas e as regras de prazo são configurados para cada empresa na implantação. O pedido é por aqui.',
  },

  // ── Meu perfil ────────────────────────────────────────────────────────
  {
    id: 'perfil-topo',
    route: '/profile',
    secao: 'Meu perfil',
    target: '[data-tour="perfil-topo"]',
    title: 'Seu perfil, em dois passos',
    body: 'Aqui você preenche uma vez os dados da sua empresa. Depois disso, eles entram sozinhos em todo documento e planilha que o PROGPT gerar, não precisa digitar de novo.',
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

  // A tela de Assinatura ficou de fora do tour de propósito (pedido do
  // diretor 2026-10-04): o tour não deve passar pelo botão de cancelamento.
  // O passo "conta" abaixo já diz que a Assinatura fica no menu da conta.

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
