import { NextResponse } from "next/server";
import {
  getServerSupabase,
  getSignupSupabase,
} from "@/lib/db/supabase";
import { createAsaasCustomer, createAsaasSubscription, deleteAsaasCustomer, } from "@/lib/billing/asaas";
import { getBillingSettings } from "@/lib/billing/settings";
import {
  verifyTurnstileToken,
  getClientIp,
} from "@/lib/captcha";



function originFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}


export async function POST(req: Request) {

const requestId = crypto.randomUUID();

console.log("==================================");
console.log(`[${requestId}] POST /api/signup`);
console.log(new Date().toISOString());
console.log("==================================");


  const supabase = getServerSupabase();
  const signup = getSignupSupabase();


let userId: string | null = null;
let customerId: string | null = null;

  try {
    
    const body = await req.json();

// LGPD (princípio nº 5): NÃO logar PII (email/nome/cartão/endereço). Apenas
// marcadores de progresso não-identificáveis pra depurar o fluxo.
console.log(`[${requestId}] payload recebido`);

    const token = body.turnstileToken;

if (!token) {
  return NextResponse.json(
    {
      error: "Captcha não informado.",
    },
    { status: 400 }
  );
  
}


const ip = getClientIp(req);

const valid = await verifyTurnstileToken(token, ip);

if (!valid) {
  return NextResponse.json(
    {
      error: "Falha na verificação de segurança.",
    },
    { status: 400 }
  );
}
console.log(`[${requestId}] ✅ Captcha validado`);


const { data, error } = await signup.auth.signUp({
  email: body.email,
  password: body.password,
  options: {
    emailRedirectTo: `${originFrom(req)}/auth/callback?next=/chat`,
    captchaToken: body.turnstileToken,
  },
});


if (error) {
  const message = error.message.toLowerCase();

  if (
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists") ||
    message.includes("duplicate")
  ) {
    return NextResponse.json(
      {
        alreadyExists: true,
        message: "Já existe uma conta com este e-mail.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { error: error.message },
    { status: 400 }
  );
}

console.log(`[${requestId}] ✅ Signup Supabase executado`);

if (!data.user) {
  throw new Error("Usuário não foi criado.");
}

userId = data.user.id;

console.log(`[${requestId}] ✅ Usuário criado`);
console.log(`[${requestId}] User ID: ${userId}`);

const customer = await createAsaasCustomer({
name: body.fullName,
email: body.email,
cpfCnpj: body.cpf.replace(/\D/g, ""),
 mobilePhone: body.phone.replace(/\D/g, ""),
company: body.companyName,
});

 customerId = customer.id;

console.log(`[${requestId}] ✅ Cliente criado no Asaas (id ${customer.id})`);


    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: body.fullName,
        cpf_cnpj: body.cpf.replace(/\D/g, ""),
        phone: body.phone.replace(/\D/g, ""),
        company_name: body.companyName || null,
        professional_requirement: body.position || null,
        role: "user",
        plan: "trial",
        subscription_status: "trial",
      })
      
      .eq("id", data.user.id);

if (profileError) {
  throw profileError;
}

console.log(`[${requestId}] ✅ Profile atualizado`);


// Preço e trial vêm do painel /admin/billing (billing_settings), não mais
// hardcoded — assim mudar o valor lá muda o que é cobrado de fato.
const billing = await getBillingSettings();

const nextDueDate = new Date();
nextDueDate.setDate(nextDueDate.getDate() + billing.trialDays);

const nextDueDateString = nextDueDate
.toISOString()
.substring(0, 10);

const forwardedFor = req.headers.get("x-forwarded-for");

const remoteIp =
forwardedFor?.split(",")[0]?.trim() ||
req.headers.get("x-real-ip") ||
"127.0.0.1";

const [month, year] = body.cardExpiry.split("/");


console.log(`[${requestId}] Criando assinatura (venc. ${nextDueDateString})...`);

const subscription = await createAsaasSubscription({
customerId: customer.id,
value: billing.planPrice,
cycle: "MONTHLY",
billingType: "CREDIT_CARD",
description: "Plano PRO - APP 2BSUPPLY",
nextDueDate: nextDueDateString,

creditCard: {
holderName: body.cardHolder,
number: body.cardNumber.replace(/\s/g, ""),
 expiryMonth: month.padStart(2, "0"),
expiryYear: `20${year}`,
 ccv: body.cardCvv,
},

creditCardHolderInfo: {
  name: body.fullName,
  email: body.email,
  cpfCnpj: body.cpf.replace(/\D/g, ""),
  postalCode: body.postalCode.replace(/\D/g, ""),
  addressNumber: body.addressNumber,
  addressComplement: body.addressComplement,
  phone: body.phone.replace(/\D/g, ""),
  mobilePhone: body.phone.replace(/\D/g, ""),
  remoteIp,
},
});

console.log(`[${requestId}] ✅ Assinatura criada (id ${subscription.id})`);



const { error: asaasProfileError } = await supabase
  .from("profiles")
  .update({
  asaas_customer_id: customer.id,
    asaas_subscription_id: subscription.id,
  })
  .eq("id", data.user.id);

if (asaasProfileError) {
  throw asaasProfileError;
}

console.log(`[${requestId}] ✅ IDs do Asaas gravados no Supabase`);

// Cria a linha local em `subscriptions` — FONTE DE VERDADE do billing pra
// paywall (isPro/canUseAssistant em lib/billing/subscription.ts) e pro webhook
// do Asaas (que busca por asaas_subscription_id e vira status='active' quando
// o pagamento é confirmado). Sem isto o cliente pagante é tratado como free
// (1 execução lifetime por assistente) e o webhook cai no branch "orphan".
// status='trialing' até o 1º pagamento (3 dias grátis).
const trialEndIso = new Date(`${nextDueDateString}T00:00:00.000Z`).toISOString();
const { error: subscriptionRowError } = await supabase
  .from("subscriptions")
  .upsert(
    {
      user_id: data.user.id,
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      status: "trialing",
      plan: "pro",
      payment_method: "credit_card",
      current_period_start: null,
      current_period_end: null,
      trial_end: trialEndIso,
      cancel_at_period_end: false,
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

if (subscriptionRowError) {
  throw subscriptionRowError;
}

console.log(`[${requestId}] ✅ Assinatura local (trialing) criada`);

console.log(`[${requestId}] 🎉 Signup finalizado com sucesso`);
    
return NextResponse.json({
  success: true,
  user: data.user,
  //subscription,
});

}catch (err: unknown) {

 if (customerId) {
 try {
    await deleteAsaasCustomer(customerId);

   console.log(`[${requestId}] 🗑️ Rollback Asaas realizado.`);
  } catch (rollbackError) {
    console.error(
      "Erro ao remover cliente Asaas:",
      rollbackError
    );
  }
}

if (userId) {
  try {
    await supabase.auth.admin.deleteUser(userId);

    console.log(`[${requestId}] 🗑️ Rollback Supabase realizado.`);
  } catch (rollbackError) {
    console.error(
      "Erro ao remover usuário:",
      rollbackError
    );
  }
}

  console.error("############################");
  console.error("ERRO NO SIGNUP");
  console.error(err);

  if (err instanceof Error) {
    console.error(err.message);
    console.error(err.stack);
  }

  console.error("############################");

  return NextResponse.json(
    {
      error: err instanceof Error
        ? err.message
        : "Erro interno",
    },
    {
      status:500,
    }
  );
}
}