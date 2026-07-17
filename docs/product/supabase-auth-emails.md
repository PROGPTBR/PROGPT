# E-mails de autenticação (Supabase) — modelos oficiais PROGPT

Guia único pra configurar os e-mails de auth no painel do Supabase. Todos usam
o **fluxo `token_hash`** (token na _query_, não no `#`) — resistente a filtros
de e-mail corporativos que apagam o fragmento `#` do link. A rota
[`/auth/confirm`](../../app/auth/confirm/route.ts) faz `verifyOtp` no servidor,
estabelece a sessão em cookie e redireciona pro destino certo por tipo.

> **Código:** já está no ar (PRs #206, #207, #208). Falta só **colar os 4
> modelos abaixo** no painel + conferir a URL Configuration. Enquanto não colar,
> os e-mails seguem no formato antigo do Supabase (funcionam, mas sem a blindagem).

## Onde configurar
Supabase Dashboard → **Authentication**.

### 1) URL Configuration
- **Site URL:** `https://app.2bsupply.com.br`
- **Redirect URLs:** incluir `https://app.2bsupply.com.br/**`

### 2) Email Templates
Cole cada modelo em **Authentication → Email Templates** na aba correspondente
(Subject + Message body em HTML). Clique **Save** em cada um.

## Mapa dos tipos
| Template (aba no painel) | `type` | Destino após confirmar | Por quê |
|---|---|---|---|
| Reset Password | `recovery` | `/reset-password` | define nova senha |
| Invite user | `invite` | `/reset-password` | convidado **cria** a senha |
| Confirm signup | `signup` | `/chat` | já tem senha (definida no cadastro) |
| Change Email Address | `email_change` | `/chat` | só confirma o novo e-mail |

Variáveis do Supabase usadas: `{{ .SiteURL }}`, `{{ .TokenHash }}`, `{{ .NewEmail }}`.
**Não** trocar `{{ .TokenHash }}` por `{{ .ConfirmationURL }}` — é o `.ConfirmationURL`
que gera o link antigo (com `#`, frágil).

---

## 1. Reset Password (Redefinir senha)
**Subject:** `Redefinir sua senha · PROGPT`

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf1">
  <div style="background:linear-gradient(135deg,#0ed1e0,#0e8de1);padding:22px 28px">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">PROGPT</span>
  </div>
  <div style="padding:28px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Redefinir sua senha</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">
      Recebemos um pedido para redefinir a senha da sua conta PROGPT. Clique no botão abaixo para escolher uma nova senha. O link vale por 1 hora.
    </p>
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"
       style="display:inline-block;background:linear-gradient(135deg,#0ed1e0,#0e8de1);color:#000;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:9999px">
      Redefinir senha
    </a>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">
      Se o botão não funcionar, copie e cole no navegador:<br>
      <span style="color:#0e8de1;word-break:break-all">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password</span>
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.</p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e6ebf1;font-size:11px;color:#94a3b8;text-align:center">
    PROGPT · uma plataforma 2B Supply · CNPJ 36.335.299/0001-82
  </div>
</div>
```

---

## 2. Invite user (Convite de usuário)
**Subject:** `Você foi convidado para o PROGPT`

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf1">
  <div style="background:linear-gradient(135deg,#0ed1e0,#0e8de1);padding:22px 28px">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">PROGPT</span>
  </div>
  <div style="padding:28px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Você foi convidado 🎉</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">
      Você recebeu acesso ao PROGPT — a IA de compras da 2B Supply. Clique abaixo para criar sua senha e entrar.
    </p>
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/reset-password"
       style="display:inline-block;background:linear-gradient(135deg,#0ed1e0,#0e8de1);color:#000;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:9999px">
      Criar senha e acessar
    </a>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">
      Se o botão não funcionar, copie e cole no navegador:<br>
      <span style="color:#0e8de1;word-break:break-all">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/reset-password</span>
    </p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e6ebf1;font-size:11px;color:#94a3b8;text-align:center">
    PROGPT · uma plataforma 2B Supply · CNPJ 36.335.299/0001-82
  </div>
</div>
```

---

## 3. Confirm signup (Confirmação de cadastro)
**Subject:** `Confirme seu e-mail · PROGPT`

> Só dispara se a confirmação de e-mail estiver ligada em Authentication →
> Providers → Email → *Confirm email*. Se o onboarding é card-first com
> auto-confirm, este fica de reserva — não atrapalha.

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf1">
  <div style="background:linear-gradient(135deg,#0ed1e0,#0e8de1);padding:22px 28px">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">PROGPT</span>
  </div>
  <div style="padding:28px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Confirme seu e-mail</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">
      Falta um passo para ativar sua conta PROGPT. Confirme seu e-mail clicando no botão abaixo.
    </p>
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/chat"
       style="display:inline-block;background:linear-gradient(135deg,#0ed1e0,#0e8de1);color:#000;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:9999px">
      Confirmar e-mail
    </a>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">
      Se o botão não funcionar, copie e cole no navegador:<br>
      <span style="color:#0e8de1;word-break:break-all">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/chat</span>
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Se você não criou esta conta, ignore este e-mail.</p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e6ebf1;font-size:11px;color:#94a3b8;text-align:center">
    PROGPT · uma plataforma 2B Supply · CNPJ 36.335.299/0001-82
  </div>
</div>
```

---

## 4. Change Email Address (Alteração de e-mail)
**Subject:** `Confirme a alteração de e-mail · PROGPT`

> No **secure email change** (padrão), o Supabase envia este e-mail pro endereço
> **antigo e novo** — os dois precisam confirmar. A rota trata cada link.

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf1">
  <div style="background:linear-gradient(135deg,#0ed1e0,#0e8de1);padding:22px 28px">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">PROGPT</span>
  </div>
  <div style="padding:28px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Confirme seu novo e-mail</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">
      Recebemos um pedido para alterar o e-mail da sua conta PROGPT para
      <strong style="color:#0f172a">{{ .NewEmail }}</strong>. Confirme clicando no botão abaixo.
    </p>
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/chat"
       style="display:inline-block;background:linear-gradient(135deg,#0ed1e0,#0e8de1);color:#000;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:9999px">
      Confirmar novo e-mail
    </a>
    <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">
      Se o botão não funcionar, copie e cole no navegador:<br>
      <span style="color:#0e8de1;word-break:break-all">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/chat</span>
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Se você não pediu esta alteração, ignore este e-mail — nada muda.</p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e6ebf1;font-size:11px;color:#94a3b8;text-align:center">
    PROGPT · uma plataforma 2B Supply · CNPJ 36.335.299/0001-82
  </div>
</div>
```

---

## Como testar (2 min)
1. Peça um reset de senha pra um e-mail seu.
2. O link do e-mail deve começar com `…/auth/confirm?token_hash=…` (sem `#`).
3. Clicar → abre "Redefinir senha" → salvar funciona.

## Se algo falhar
- **Cai em `/login?error=invalid_token`:** link expirado/já usado — peça outro.
- **Não chega no destino certo:** confira a **Site URL** e as **Redirect URLs**.
- **E-mail não chega:** é config de SMTP do Supabase (Authentication → Emails),
  não do template.
