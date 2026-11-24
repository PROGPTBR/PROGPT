# Área Médica: o que precisa para subir em produção

Para quem cuida do servidor de produção da 2BSUPPLY.IA.

**Atualização de 24/11/2026: publicado.** O `main` foi levado para a branch `deploy-hostinger`, a imagem foi reconstruída no VPS e as seções 1, 2 (Evolution e SMTP) e 3.1 a 3.3 estão feitas. Continuam pendentes as variáveis listadas como ausentes no container (ver `CLAUDE.md`, seção Stack) e o BTG.

O código está todo na branch `main` (último commit: "primeiro acesso do médico com senha temporária" e os seguintes). O servidor de produção ainda roda uma versão de 16/11/2026, sem a Área Médica: `https://2bsupply.ia.br/medicos` responde 404.

O que falta é publicar o `main`, criar duas variáveis de ambiente e conferir quatro pontos da plataforma. O banco de dados já está pronto.

## 1. Publicar

Nada mudou no jeito de construir: o `Dockerfile` da raiz continua valendo (Node 22, `npm ci`, `npm run build`, saída `standalone`).

- Porta: `PORT` (padrão 3000), com `HOSTNAME=0.0.0.0`.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` precisam existir **na hora do build** (são `ARG` no Dockerfile), não só na execução.
- Uma dependência nova entrou no `package.json`: `jszip`. O `npm ci` resolve.

Depois de publicar, confira:

| Endereço | Resposta esperada |
|---|---|
| `GET /medicos` | 200 (entrada dos médicos) |
| `GET /area-medica` sem login | redireciona para `/medicos?next=/area-medica` |
| `GET /api/medico` sem login | 401 |
| `POST /api/medico/whatsapp/webhook` sem token | 401 |

## 2. Variáveis de ambiente

### Novas

Os valores estão no arquivo `area-medica-variaveis.env`, entregue à parte. Ele contém segredo e não está no repositório.

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `EVOLUTION_API_URL` | sim | Servidor da Evolution API (WhatsApp). Sem ela o WhatsApp fica desligado e a tela avisa. |
| `EVOLUTION_API_KEY` | sim | Chave **global** da Evolution. O mesmo servidor atende outros sistemas; o código só cria e altera instâncias com prefixo `medico-` e a instância de avisos. |
| `EVOLUTION_INSTANCE_AVISOS` | não | Nome da instância que envia os avisos diários. Padrão: `2bsupply-avisos`. |
| `AREA_MEDICA_AVISOS` | não | `false` desliga os avisos diários. |
| `BTG_CLIENT_ID` | depois | Aplicativo no portal do BTG Empresas. Sem as três `BTG_*`, a ligação com o banco fica desligada e a tela diz que aguarda liberação. |
| `BTG_CLIENT_SECRET` | depois | Idem. |
| `BTG_WEBHOOK_SECRET` | depois | Segredo do webhook cadastrado no portal do BTG. |
| `BTG_REDIRECT_URI` | não | Padrão: `https://2bsupply.ia.br/api/medico/btg/callback`. Tem de ser igual ao cadastrado no BTG. |

### Já existentes: conferir

| Variável | O que conferir |
|---|---|
| `APP_ENV` | Tem de ser `production`. O agendador interno só liga com esse valor. |
| `APP_URL` | Tem de ser `https://2bsupply.ia.br`. É o endereço que vai nos e-mails, no convite do médico e no aviso diário. O domínio antigo `progpt.com.br` redireciona, e um webhook (POST) não segue redirecionamento. |
| `APP_SECRET` | Tem de existir e **não pode mudar** depois. Dele saem os tokens internos (webhook do WhatsApp, agendador) e a chave que cifra a autorização do BTG. Se mudar, os médicos precisam reconectar o WhatsApp e o banco. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Envio de e-mail em nome do médico e aviso diário. |
| `RESEND_API_KEY`, `RESEND_INBOUND_DOMAIN`, `RESEND_WEBHOOK_SECRET` | Recebimento de e-mail (o médico encaminha o demonstrativo do hospital). Sem elas, só essa função fica desligada. |
| `OPENAI_API_KEY`, `OPENAI_MODEL_GENERATION` | Leitura por IA das mensagens e dos demonstrativos. |
| `SUPABASE_SERVICE_ROLE_KEY` | Todas as rotas da Área Médica leem o banco por ela. |

## 3. Pontos da plataforma

### 3.1 Cabeçalhos do proxy (nginx)

O sistema monta o endereço público do webhook do WhatsApp a partir dos cabeçalhos do pedido. O nginx precisa repassar:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

Sem isso o sistema cai no `APP_URL`, que funciona se estiver correto.

### 3.2 Tamanho do upload

Há envios de até 25 MB (PDF de demonstrativo) e 10 MB (anexo da nota). O padrão do nginx é 1 MB:

```nginx
client_max_body_size 30m;
```

### 3.3 Tempo de resposta

A leitura por IA e a busca de grupos do WhatsApp podem levar até 60 segundos:

```nginx
proxy_read_timeout 120s;
```

### 3.4 Agendador (avisos diários e renovação do BTG)

O sistema tem um agendador interno (`instrumentation.ts`), que roda a cada 15 minutos enquanto o processo estiver de pé. Ele faz duas coisas: renova a autorização do BTG de cada médico (vence em 10 dias se não renovar) e, entre 8h e 12h de Brasília, envia os avisos do dia.

**Se o processo é de longa duração** (container ou `next start` sempre ligado), não há nada a fazer.

**Se a plataforma desliga o processo quando não há tráfego**, o agendador interno não é confiável. Nesse caso, agende uma chamada externa de hora em hora:

```bash
curl -X POST https://2bsupply.ia.br/api/medico/avisos \
  -H "x-area-medica-token: <token>"
```

O token sai do `APP_SECRET` de produção:

```bash
APP_SECRET='<valor de produção>' npm run medico:token
```

A chamada pode repetir sem risco: cada médico recebe no máximo um aviso por dia. Com mais de uma réplica também não duplica.

## 4. Banco de dados

Nada a fazer. As migrations `0066` a `0070` já foram aplicadas no Supabase de produção em 24/11/2026. São só tabelas e colunas novas (`medico_*`, `profiles.area_medica`); nada existente foi alterado.

Para um ambiente novo, aplique em ordem os arquivos `supabase/migrations/00000000000066_*.sql` até `00000000000070_*.sql` com `node scripts/apply-migration.cjs <arquivo>`.

## 5. Endereços que serviços de fora chamam

Precisam estar acessíveis pela internet, sem login. Nenhum passa pelo `middleware.ts`.

| Endereço | Quem chama | Como é protegido |
|---|---|---|
| `POST /api/medico/whatsapp/webhook?token=...` | Evolution API | Token na URL, derivado do `APP_SECRET`. O sistema cadastra sozinho quando o médico conecta o WhatsApp. |
| `POST /api/medico/btg/webhook` | BTG Empresas | `Authorization: Bearer <BTG_WEBHOOK_SECRET>`. Cadastrar no portal do BTG. |
| `GET /api/medico/btg/callback` | BTG (volta do login) | Sessão do usuário mais `state` assinado. Cadastrar no portal do BTG como endereço de retorno. |
| `POST /api/proc2pay/inbound` ou `/api/assistants/comprador/inbound` | Resend | Assinatura Svix. Já existem; passaram a tratar também os e-mails da Área Médica (`medico-<id>@<domínio>`). Nada a cadastrar de novo. |
| `POST /api/medico/avisos` | Agendador externo, se houver | Cabeçalho `x-area-medica-token`. |

## 6. Supabase Auth

No painel do Supabase, em Authentication → URL Configuration:

- **Site URL:** `https://2bsupply.ia.br`
- **Redirect URLs:** incluir `https://2bsupply.ia.br/**`

O convite do médico por e-mail usa o link `/auth/callback?next=/reset-password`. Com o domínio antigo configurado, o link do convite abre no endereço errado.

## 7. Depois de publicar

Estes passos são da 2B Supply, não do servidor:

1. Entrar como super admin em `/area-medica`, aba Integrações, e conectar por QR code o **número que envia os avisos**.
2. Cadastrar o médico: `npm run medico:criar -- email@do.medico` (gera senha temporária; no primeiro acesso ele cria a dele), ou convidar pelo quadro "Quem tem acesso" na mesma aba.
3. BTG: criar o aplicativo em `developers.empresas.btgpactual.com`, com os escopos `openid` e `empresas.btgpactual.com/accounts.readonly`, os dois endereços da seção 5 e os eventos `transactions.credit` e `transactions.debit`. Pedir produção a `implantacaoempresas@btgpactual.com` e preencher as três variáveis `BTG_*`.

## 8. O que ainda não foi testado em produção

- Leitura do grupo de WhatsApp pelo webhook (exige endereço público).
- Envio real de e-mail em nome do médico e o e-mail de convite.
- Recebimento de e-mail pelo endereço `medico-<id>@`.
- Ligação com o BTG (sem credencial; escrita em cima da documentação oficial e dos exemplos de aviso que ela traz).

O restante foi validado contra o banco de produção e, na parte do WhatsApp, contra o servidor da Evolution: criação de instância e QR code.
