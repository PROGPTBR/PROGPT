import type { RetrievedChunk } from '@/lib/rag/types';
import type {
  ProfileParams,
  ProfileStakeholder,
  TemplateRow,
} from './types';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import type { CompanyData } from '@/lib/db/user-company';

// Sub-projeto 33 — Profile (Perfil da Categoria) prompt construction.
//
// Step 1 of Strategic Sourcing. Output is a narrative document — no
// deterministic scoring (unlike Kraljic/ABC/Financial/Porter). The LLM
// receives 15 structured form fields and an optional reference template,
// and produces a senior-tone caracterization that downstream assistants
// (RFP, Kraljic, Porter, ABC) consume as ground truth via the
// "Iniciar de um Perfil" picker.

export const PROFILE_SYSTEM_PROMPT = `Você é um especialista sênior em procurement (compras corporativas) com 20 anos de experiência em gestão de categorias. Sua tarefa é GERAR um documento estruturado de Perfil da Categoria em português brasileiro, pronto para servir de insumo aos próximos passos do Strategic Sourcing (Análise da Categoria, Visão de Mercado, Estratégia de Sourcing).

## Regras de geração

1. **A informação dos 15 campos é INPUT AUTORITATIVO, não palpite**. Os valores já foram preenchidos pelo comprador. Você organiza, contextualiza e narra — não inventa, não reformula valores literais, não reinterpreta os critérios. Os campos chegam entre \`<profile-input>...</profile-input>\` no user prompt.

2. **CRÍTICO — preservar literais**: os campos \`Requisitos técnicos\` e \`Restrições regulatórias\` devem aparecer no documento **palavra por palavra** como foram informados (esses são audit-críticos para procurement e regulatório — paráfrase quebra rastreabilidade). Pode estruturar (bullets, tabela) mas não reescrever.

3. **Profundidade de gestor sênior na narrativa**. Onde o template pede caracterização da categoria, explique a função estratégica dela (operacional / habilitadora / diferenciadora) com base nos campos. Onde pede análise de stakeholders, traduza a lista em diagrama de influência (quem decide, quem usa, quem mantém). Onde pede prioridade, justifique a escolha do comprador (custo / qualidade / inovação / sustentabilidade) ancorando nos sub-segmentos e critérios informados.

4. **Fundamentação na base de conhecimento**. Há trechos de artigos da base anexados no contexto entre \`<base>...</base>\`. Use-os para enriquecer onde o conteúdo teórico ajuda (Monczka category management, O'Brien category framework, Kraljic portfolio matrix como antecipação de próximo passo). NÃO cite autores, IDs ou números entre colchetes na saída — incorpore como conhecimento próprio.

5. **Formato Markdown bem estruturado**. Headings (#, ##), tabelas para stakeholders e critérios, listas para sub-segmentos. **Bold** para valores literais críticos (normas técnicas, regulatórios). O output será renderizado em chat e convertido para .docx — markdown limpo é essencial.

6. **Não inventar números, fornecedores, valores ou normas que não estão no input**. Se o campo veio vazio (ex.: \`Spend anual\` opcional), mencione "Não informado pelo comprador — a estimar na etapa de Análise da Categoria (Step 2)" em vez de fabricar um número.

7. **Não inclua preâmbulo nem epílogo conversacional**. Comece direto pelo título do Perfil. Termine na última seção customizável (Recomendações para próximos passos). Sem "Aqui está o seu Perfil:" ou similares.`;

function formatStakeholders(stakeholders: ProfileStakeholder[]): string {
  if (stakeholders.length === 0) return '_(sem stakeholders informados)_';
  const PAPEL_LABEL: Record<ProfileStakeholder['papel'], string> = {
    usuario: 'Usuário / Requisitante',
    aprovador: 'Aprovador / Sponsor',
    operacao: 'Operação / Manutenção',
  };
  return stakeholders
    .map((s) => `- **${s.nome}** — ${PAPEL_LABEL[s.papel]}`)
    .join('\n');
}

function formatSubSegmentos(subSegmentos: string[]): string {
  if (subSegmentos.length === 0) return '_(nenhum sub-segmento informado)_';
  return subSegmentos.map((s) => `- ${s}`).join('\n');
}

function formatCriterios(criterios: string[]): string {
  if (criterios.length === 0) return '_(nenhum critério informado)_';
  return criterios.map((c, i) => `${i + 1}. ${c}`).join('\n');
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de gestão de categorias e Strategic Sourcing)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

function formatProfileInput(params: ProfileParams): string {
  const lines: string[] = [];
  lines.push(`**Nome da categoria**: ${params.nomeCategoria}`);
  lines.push('');
  lines.push(`**Descrição**: ${params.descricao}`);
  lines.push('');
  lines.push(`**Sub-segmentos**:`);
  lines.push(formatSubSegmentos(params.subSegmentos));
  lines.push('');
  lines.push(`**Escopo — incluído**:`);
  lines.push(params.escopoIncluido);
  if (params.escopoNaoIncluido && params.escopoNaoIncluido.trim().length > 0) {
    lines.push('');
    lines.push(`**Escopo — não incluído**:`);
    lines.push(params.escopoNaoIncluido);
  }
  lines.push('');
  lines.push('---');
  lines.push('**Volume e mercado**');
  if (typeof params.spendAnualBRL === 'number') {
    lines.push(
      `- Spend anual estimado: R$ ${params.spendAnualBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
  } else {
    lines.push('- Spend anual estimado: não informado');
  }
  if (params.volumeFisico && params.volumeFisico.length > 0) {
    lines.push(`- Volume físico: ${params.volumeFisico}`);
  }
  if (typeof params.numeroFornecedoresAtivos === 'number') {
    lines.push(`- Nº de fornecedores ativos: ${params.numeroFornecedoresAtivos}`);
  }
  if (params.sazonalidade && params.sazonalidade.length > 0) {
    lines.push(`- Sazonalidade: ${params.sazonalidade}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('**Requisitos técnicos (LITERAL — preservar palavra por palavra)**');
  lines.push(params.requisitosTecnicos);
  if (
    params.restricoesRegulatorias &&
    params.restricoesRegulatorias.trim().length > 0
  ) {
    lines.push('');
    lines.push('**Restrições regulatórias (LITERAL — preservar palavra por palavra)**');
    lines.push(params.restricoesRegulatorias);
  }
  lines.push('');
  lines.push('**Critérios de avaliação priorizados**:');
  lines.push(formatCriterios(params.criteriosAvaliacao));
  lines.push('');
  lines.push('---');
  lines.push('**Stakeholders**:');
  lines.push(formatStakeholders(params.stakeholders));
  lines.push('');
  lines.push(
    `**Prioridade estratégica dominante**: ${params.prioridadeEstrategica}`,
  );
  if (params.observacoes && params.observacoes.trim().length > 0) {
    lines.push('');
    lines.push(`**Observações do comprador**: ${params.observacoes}`);
  }
  return lines.join('\n');
}

export function buildProfilePrompt(
  params: ProfileParams,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null = null,
): { system: string; user: string } {
  const companyBlock = company
    ? [
        company.company_name
          ? `- **Comprador**: ${company.company_name}`
          : '',
        company.company_description
          ? `- **Sobre o comprador**: ${company.company_description}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const paramsBlock = `## Input do comprador (NÃO inventar valores além desses)

<profile-input>
${formatProfileInput(params)}
</profile-input>${
    companyBlock ? `\n\n## Empresa do comprador\n\n${companyBlock}` : ''
  }`;

  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(head, params, company);
  const templateBlock = `## Template a seguir

Nome do template: **${template.name}**
${template.description ? `Descrição: ${template.description}\n` : ''}
\`\`\`markdown
${renderedHead}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

<base>
${formatChunks(chunks)}
</base>`;

  const instruction = `## Tarefa

Gere o Perfil da Categoria completo agora. Comece pelo título seguido das seções do template, expandidas com narrativa de gestor sênior, fundamentando-se nos campos do input. Lembre: requisitos técnicos e restrições regulatórias DEVEM aparecer LITERAIS no documento. Produza markdown limpo.`;

  return {
    system: PROFILE_SYSTEM_PROMPT,
    user: [paramsBlock, templateBlock, contextBlock, instruction].join(
      '\n\n---\n\n',
    ),
  };
}
