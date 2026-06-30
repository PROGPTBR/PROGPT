import { NextResponse } from "next/server";
import {
  getServerSupabase,
  getSignupSupabase,
} from "@/lib/db/supabase";
import { createAsaasCustomer, createAsaasSubscription, deleteAsaasCustomer, } from "@/lib/billing/asaas";
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

console.log(`[${requestId}] Email: ${body.email}`);
console.log(`[${requestId}] Nome: ${body.fullName}`);

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

console.log(`[${requestId}] ✅ Cliente criado no Asaas`);
console.log(customer);


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


const nextDueDate = new Date();
nextDueDate.setDate(nextDueDate.getDate() + 3);

const nextDueDateString = nextDueDate
  .toISOString()
  .substring(0, 10);

const forwardedFor = req.headers.get("x-forwarded-for");

const remoteIp =
  forwardedFor?.split(",")[0]?.trim() ||
  req.headers.get("x-real-ip") ||
  "127.0.0.1";

const [month, year] = body.cardExpiry.split("/");


console.log(`[${requestId}] Criando assinatura...`);
console.log(`[${requestId}] Vencimento: ${nextDueDateString}`);
console.log(`[${requestId}] Valor: 197.99`);


console.log("===== DADOS DO TITULAR =====");
console.log({
  postalCode: body.postalCode,
  addressNumber: body.addressNumber,
  addressComplement: body.addressComplement,
  phone: body.phone,
});

const subscription = await createAsaasSubscription({
  customerId: customer.id,

  value: 197.99,

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

console.log(`[${requestId}] ✅ Assinatura criada`);
console.log(subscription);


/**
 *const ip =
 * req.headers.get("x-forwarded-for")?.split(",")[0] ||
 * req.headers.get("x-real-ip") ||
 * "127.0.0.1";


 * const token = await tokenizeCreditCard({
 * customer: customer.id,

 * holderName: body.cardHolder,
 * number: body.cardNumber.replace(/\s/g, ""),

  * expiryMonth: body.cardExpiry.split("/")[0],
 * expiryYear: `20${body.cardExpiry.split("/")[1]}`,

  * ccv: body.cardCvv,

  * name: body.fullName,
  * email: body.email,
  * cpfCnpj: body.cpf.replace(/\D/g, ""),

  * postalCode: body.postalCode.replace(/\D/g, ""),
  * addressNumber: body.addressNumber,
  * addressComplement: body.addressComplement,

  * phone: body.phone.replace(/\D/g, ""),

  * remoteIp: ip,
  * }); 


* console.log(token);
*/


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

console.log(`[${requestId}] 🎉 Signup finalizado com sucesso`);
    
return NextResponse.json({
  success: true,
  user: data.user,
  subscription,
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