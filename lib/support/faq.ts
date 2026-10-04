// Perguntas frequentes do suporte dentro do produto (sub-projeto 71).
//
// Diferente do /faq público (marketing, para quem ainda não é cliente), este
// FAQ responde dúvidas de USO de quem já está logado — por isso fala de telas,
// botões e limites reais. Ao mudar uma funcionalidade, atualize a resposta
// aqui: uma resposta errada no suporte é pior do que nenhuma.
//
// Preço não entra em resposta nenhuma de propósito: muda pelo /admin/billing e
// a fonte da verdade para o cliente é a tela de Assinatura.

export type FaqItem = { id: string; pergunta: string; resposta: string; termos?: string };
export type FaqSecao = { id: string; titulo: string; itens: FaqItem[] };

export const FAQ_SUPORTE: FaqSecao[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros passos',
    itens: [
      {
        id: 'o-que-e',
        pergunta: 'O que é o PROGPT?',
        resposta:
          'Uma plataforma de inteligência artificial para Suprimentos: um chat especialista em compras, assistentes que entregam documentos e planilhas prontos, o Fluxo de Compras com aprovação em cada etapa e bases próprias de fornecedores e materiais.',
      },
      {
        id: 'por-onde-comecar',
        pergunta: 'Por onde eu começo?',
        resposta:
          'Faça uma pergunta real da sua rotina no chat. Se quiser conhecer todas as telas antes, use "Ver o tour da plataforma", no topo do menu da barra lateral.',
      },
      {
        id: 'rever-tour',
        pergunta: 'Como revejo o tour da plataforma?',
        resposta:
          'No chat, clique em "Ver o tour da plataforma", no topo do menu da barra lateral (com a barra recolhida, é o ícone de bússola). O tour passa por cada tela e pode ser fechado a qualquer momento.',
      },
      {
        id: 'celular',
        pergunta: 'Funciona no celular?',
        resposta:
          'Sim. Pelo navegador do celular, o menu fica no botão do canto superior. Dá também para instalar o PROGPT como aplicativo: no navegador, use a opção "Adicionar à tela inicial" ou "Instalar app".',
        termos: 'mobile app instalar android iphone',
      },
    ],
  },
  {
    id: 'chat',
    titulo: 'Chat',
    itens: [
      {
        id: 'de-onde-vem',
        pergunta: 'De onde vêm as respostas do chat?',
        resposta:
          'De uma base de conhecimento de Strategic Sourcing (teorias, frameworks e práticas de compras). Quando a base não tem fonte sobre o assunto, o PROGPT diz isso em vez de inventar.',
        termos: 'fonte base conhecimento confiável',
      },
      {
        id: 'nao-tenho-fonte',
        pergunta: 'O chat disse que não tem fonte sobre o assunto. E agora?',
        resposta:
          'Reformule com termos de compras (por exemplo, o nome do framework ou da etapa do processo). Se o assunto não for de compras, ligue o Modo Livre, que responde sobre qualquer tema e pode buscar na web.',
      },
      {
        id: 'anexar',
        pergunta: 'Posso enviar arquivos no chat?',
        resposta:
          'Sim. Use o clipe ao lado da caixa de mensagem para anexar PDF, DOCX, XLSX, PNG ou JPG — por exemplo um contrato ou uma proposta — e faça a pergunta sobre ele.',
        termos: 'anexo upload pdf planilha contrato proposta',
      },
      {
        id: 'voz',
        pergunta: 'Como converso por voz?',
        resposta:
          'Clique no ícone de ondas de áudio na caixa de mensagem e permita o microfone. A conversa por voz usa a mesma base de conhecimento, dura até 10 minutos por sessão e, ao encerrar, a transcrição vira histórico da conversa.',
        termos: 'microfone falar áudio',
      },
      {
        id: 'modo-livre',
        pergunta: 'O que é o Modo Livre?',
        resposta:
          'É o assistente pessoal: responde sobre qualquer assunto, não só compras, e pode buscar na web informação atual. Ligue e desligue pelo botão "Modo Livre" no chat.',
        termos: 'assistente pessoal internet web',
      },
      {
        id: 'ferramentas-automaticas',
        pergunta: 'O chat consegue executar tarefas sozinho?',
        resposta:
          'Algumas, sim. Ao pedir um preço de referência, os indicadores econômicos do mês, a situação de um CNPJ ou um diagnóstico rápido de aquisição, o próprio chat aciona a ferramenta e responde com o resultado — e sugere a tela completa quando houver mais a fazer.',
      },
      {
        id: 'historico',
        pergunta: 'Minhas conversas ficam salvas?',
        resposta:
          'Sim, na barra lateral, com busca. Passe o mouse sobre uma conversa para ver os botões de renomear e apagar. As conversas ficam na sua conta, então aparecem em qualquer computador em que você entrar.',
        termos: 'histórico apagar renomear buscar',
      },
    ],
  },
  {
    id: 'assistentes',
    titulo: 'Assistentes',
    itens: [
      {
        id: 'quais',
        pergunta: 'Quais assistentes existem?',
        resposta:
          'Estão todos na tela Assistentes: RFP, Matriz Kraljic, 5 Forças de Porter, Curva ABC, Scorecard de fornecedor, Análise Financeira, Análise de Gastos, Pesquisa de Preços, Homologação de Fornecedor, Negociação, Equalizador de Propostas, Diagnóstico de Aquisição, Busca de Fornecedores e outros.',
      },
      {
        id: 'documentos',
        pergunta: 'Em que formato recebo o resultado?',
        resposta:
          'Os assistentes entregam o documento em Word (.docx) e, quando há dados tabulares, a planilha em Excel (.xlsx), prontos para baixar e enviar.',
        termos: 'word excel docx xlsx baixar download',
      },
      {
        id: 'onde-ficam',
        pergunta: 'Onde encontro um documento que já gerei?',
        resposta:
          'Em Assistentes → Histórico. Ali você reabre qualquer execução, pede ajustes conversando com a IA e baixa os arquivos de novo.',
        termos: 'histórico execução refazer ajustar',
      },
      {
        id: 'dados-empresa',
        pergunta: 'Como coloco os dados e o logo da minha empresa nos documentos?',
        resposta:
          'Preencha "Meu perfil" (clique no seu nome, no rodapé da barra lateral). Os dados da empresa e o logo entram automaticamente nos documentos gerados.',
        termos: 'logo empresa perfil capa',
      },
      {
        id: 'pesquisa-precos',
        pergunta: 'De onde vêm os preços da Pesquisa de Preços?',
        resposta:
          'Das compras públicas registradas pelo governo federal, pelo código do catálogo de materiais. O valor de referência é a mediana dos preços praticados, com os extremos descartados.',
        termos: 'preço referência catmat governo',
      },
      {
        id: 'homologacao',
        pergunta: 'O que a Homologação de Fornecedor verifica?',
        resposta:
          'A partir do CNPJ: situação cadastral, dados de cadastro e sócios, um score de risco, histórico de fornecimento ao governo e links das certidões oficiais. Também pode trazer uma pesquisa de reputação na web, sempre indicada como não oficial.',
        termos: 'cnpj receita certidão risco',
      },
      {
        id: 'analise-gastos',
        pergunta: 'Quantas notas cabem na Análise de Gastos?',
        resposta:
          'Até 500 notas por análise, enviadas em PDF (até 15 MB cada) e/ou em planilha. O resultado traz as notas classificadas, os indicadores e um dashboard interativo.',
        termos: 'spend notas fiscais invoices limite',
      },
      {
        id: 'equalizador',
        pergunta: 'Como comparo propostas de fornecedores?',
        resposta:
          'No Equalizador de Propostas: cole ou importe as propostas (até 10 arquivos de uma vez). Ele compara pelo custo total, aponta desvios e, se você incluir o pedido de cotação, confere item a item o que cada fornecedor cotou.',
        termos: 'cotação tco comparar proposta',
      },
      {
        id: 'negociacao',
        pergunta: 'Como funciona o simulador de negociação?',
        resposta:
          'Você monta a estratégia e negocia com um fornecedor simulado, que pode falar em voz alta. Durante a conversa dá para pedir conselho ao coach, e ao final você recebe uma avaliação da negociação.',
        termos: 'simulação treino reunião',
      },
    ],
  },
  {
    id: 'modulos',
    titulo: 'Fluxo, Painel e bases',
    itens: [
      {
        id: 'fluxo',
        pergunta: 'Como funciona o Fluxo de Compras?',
        resposta:
          'Você descreve a necessidade e o processo percorre 8 etapas, da solicitação ao recebimento. Em cada etapa a IA executa e para para você decidir: SIGA avança, AJUSTAR manda refazer com a sua correção.',
        termos: 'processo etapas siga ajustar aprovação',
      },
      {
        id: 'painel-dashboard',
        pergunta: 'Qual a diferença entre Painel e Dashboard?',
        resposta:
          'O Painel mostra automaticamente tudo o que você já fez na plataforma. O Dashboard é para montar painéis a partir de uma planilha sua (.xlsx ou .csv) e salvá-los.',
      },
      {
        id: 'fornecedores',
        pergunta: 'Como monto minha base de fornecedores?',
        resposta:
          'Em Fornecedores: importe a sua vendor list de uma planilha, cadastre à mão ou salve direto da Busca de Fornecedores, que procura empresas por atividade (CNAE) e região. A aba Materiais funciona do mesmo jeito para a base de materiais.',
        termos: 'vendor list importar materiais cnae',
      },
      {
        id: 'prompts',
        pergunta: 'Para que serve a Biblioteca de Prompts?',
        resposta:
          'São perguntas prontas de compras, por tema. Abra um prompt, clique em "Usar no chat" e ajuste os campos entre colchetes com os dados da sua compra. A estrela guarda o prompt em Favoritos.',
      },
      {
        id: 'vitrines',
        pergunta: 'Gestão de Obras e Gestão de Demandas são de verdade?',
        resposta:
          'As telas mostram demonstrações com dados fictícios. Os dois sistemas são implantados sob demanda, com os dados e o processo da sua empresa — para contratar, use o botão "Quero na minha empresa" ou fale com o suporte pelo WhatsApp.',
        termos: 'obras demandas demonstração contratar',
      },
    ],
  },
  {
    id: 'conta',
    titulo: 'Conta e assinatura',
    itens: [
      {
        id: 'ver-assinatura',
        pergunta: 'Onde vejo meu plano e minhas cobranças?',
        resposta:
          'Clique no seu nome, no rodapé da barra lateral, e depois em "Assinatura": ali estão o plano, a situação, a forma de pagamento e a data da próxima cobrança.',
        termos: 'plano cobrança pagamento fatura preço valor',
      },
      {
        id: 'mais-usuarios',
        pergunta: 'Como coloco mais pessoas da minha equipe?',
        resposta:
          'A assinatura é cobrada por usuário. Com mais de um acesso contratado, os convites ficam na tela de Assinatura: informe o e-mail da pessoa e ela recebe o convite para criar a senha. Para contratar mais acessos, fale com o suporte.',
        termos: 'equipe usuários licença convite acesso',
      },
      {
        id: 'cancelar',
        pergunta: 'Como cancelo a assinatura?',
        resposta:
          'Na tela de Assinatura, em "Cancelar assinatura". O acesso continua até o fim do período já pago.',
        termos: 'cancelamento',
      },
      {
        id: 'senha',
        pergunta: 'Esqueci minha senha.',
        resposta:
          'Na tela de login, clique em "Esqueci minha senha" e informe o seu e-mail para receber o link de redefinição.',
        termos: 'login entrar acesso redefinir',
      },
      {
        id: 'excluir',
        pergunta: 'Como excluo minha conta?',
        resposta:
          'Em "Meu perfil" (clique no seu nome, no rodapé da barra lateral), use "Excluir minha conta". A exclusão apaga as suas conversas e documentos e cancela a assinatura. Não dá para desfazer.',
        termos: 'apagar lgpd remover dados',
      },
    ],
  },
  {
    id: 'privacidade',
    titulo: 'Privacidade e segurança',
    itens: [
      {
        id: 'quem-ve',
        pergunta: 'Quem vê minhas conversas e documentos?',
        resposta:
          'Só você, na sua conta. Em um atendimento de suporte, a equipe da 2B Supply pode acessar a sua conta para resolver o problema, e todo acesso fica registrado.',
        termos: 'privacidade sigilo confidencial',
      },
      {
        id: 'lgpd',
        pergunta: 'Como meus dados são tratados?',
        resposta:
          'De acordo com a LGPD. Os detalhes — quais dados, para quê e por quanto tempo — estão na Política de Privacidade, no rodapé do site.',
        termos: 'lgpd dados pessoais política',
      },
    ],
  },
];

/** Minúsculas e sem acento, para "cotacao" achar "cotação". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra o FAQ por termo. Todas as palavras digitadas precisam aparecer na
 * pergunta, na resposta ou nos termos extras do item; seções sem resultado
 * somem. Termo vazio devolve tudo.
 */
export function buscarFaq(termo: string, secoes: FaqSecao[] = FAQ_SUPORTE): FaqSecao[] {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return secoes;
  return secoes
    .map((secao) => ({
      ...secao,
      itens: secao.itens.filter((item) => {
        const alvo = normalizar(`${item.pergunta} ${item.resposta} ${item.termos ?? ''} ${secao.titulo}`);
        return palavras.every((p) => alvo.includes(p));
      }),
    }))
    .filter((secao) => secao.itens.length > 0);
}
