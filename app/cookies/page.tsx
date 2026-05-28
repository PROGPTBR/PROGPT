import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { PRODUCT_NAME, LEGAL_CONTACT_EMAIL } from '@/lib/legal/constants';

export const metadata: Metadata = {
  title: `Política de Cookies · ${PRODUCT_NAME}`,
  description: `Como o ${PRODUCT_NAME} usa cookies e tecnologias similares.`,
};

const COOKIES_MD = `
Esta Política de Cookies complementa a [Política de Privacidade](/privacidade)
e detalha quais cookies e tecnologias similares o ${PRODUCT_NAME} usa,
qual o propósito de cada um, e como você pode gerenciar suas preferências.

## 1. O Que São Cookies

Cookies são pequenos arquivos de texto armazenados no seu navegador
quando você visita um site. Eles permitem que o site lembre informações
sobre sua visita (como sessão de login, preferências de tema, etc.).

Tecnologias similares incluem **localStorage** e **sessionStorage**, que
funcionam de modo parecido mas ficam armazenados localmente sem serem
enviados ao servidor.

## 2. Cookies Que Usamos

Classificamos cookies em duas categorias:

### 2.1 Cookies Essenciais (sempre ativos)

Estes cookies são **estritamente necessários** pro funcionamento básico
da Plataforma. Sem eles, você não consegue logar nem usar o serviço.
Não exigem consentimento (Art. 7º, V LGPD — execução de contrato).

| Cookie | Origem | Propósito | Duração |
|---|---|---|---|
| \`sb-*-auth-token\` | Supabase | Sessão de login (httpOnly, secure) | 1 hora (refresh automático) |
| \`sb-*-auth-token-code-verifier\` | Supabase | PKCE flow de OAuth | Apenas durante login |
| \`cf-turnstile\` | Cloudflare | Verificação anti-bot no signup/reset | Apenas no momento do challenge |
| \`procurementgpt_cookie_consent\` | ${PRODUCT_NAME} | Lembrar sua escolha de consentimento | 1 ano |

**localStorage usado**:

| Chave | Propósito |
|---|---|
| \`theme\` (next-themes) | Lembrar preferência de tema (claro/escuro/sistema) |
| \`procurementgpt_cookie_consent_v1\` | Espelha o cookie de consentimento |

### 2.2 Cookies Não-Essenciais

**No momento, não usamos cookies não-essenciais** (analytics,
publicidade, redes sociais). Se passarmos a usar (ex: PostHog, Plausible
ou Google Analytics em um futuro próximo), atualizaremos esta Política e
você poderá optar por aceitar ou não via banner de consentimento.

## 3. Cookies de Terceiros

Quando você é redirecionado pro **Asaas** durante o checkout, o Asaas
pode setar cookies próprios (sessão de pagamento, anti-fraude). Esses
cookies são governados pela [Política de Privacidade da Asaas](https://www.asaas.com/politica-de-privacidade)
e não temos controle direto sobre eles.

## 4. Como Gerenciar Cookies

### 4.1 No banner de consentimento

Na primeira visita, você verá um banner com 2 opções:

- **Aceitar todos** — concorda com cookies essenciais e futuros não-essenciais
- **Apenas essenciais** — só cookies estritamente necessários

Sua escolha é salva e respeitada em visitas futuras. Você pode rever ou
trocar a qualquer momento clicando em "Gerenciar cookies" no rodapé.

### 4.2 No seu navegador

Você pode bloquear ou apagar cookies diretamente no navegador:

- **Chrome**: Configurações → Privacidade e segurança → Cookies
- **Firefox**: Configurações → Privacidade e Segurança → Cookies e dados
- **Safari**: Preferências → Privacidade → Cookies
- **Edge**: Configurações → Cookies e permissões de site

⚠️ Bloquear cookies essenciais **quebra o login** e impede uso da
Plataforma. Bloquear não-essenciais não afeta funcionalidade.

### 4.3 Para usuários autenticados

Você pode revisar tudo que armazenamos sobre você acessando o seu
perfil em \`/profile\` ou solicitando exportação completa via
${LEGAL_CONTACT_EMAIL} (direito de portabilidade — Art. 18 LGPD).

## 5. Mudanças nesta Política

Se passarmos a usar novos cookies (ex: ao implementar analytics),
atualizaremos esta Política e re-exibiremos o banner de consentimento
pra você revisar suas escolhas.

## 6. Contato

Dúvidas sobre cookies? Escreva pra **${LEGAL_CONTACT_EMAIL}**.
`;

export default function CookiesPage() {
  return <LegalDocument title="Política de Cookies" markdown={COOKIES_MD} />;
}
