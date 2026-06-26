import { NextResponse } from "next/server";
import {
  getServerSupabase,
  getSignupSupabase,
} from "@/lib/db/supabase";
import { createAsaasCustomer, createAsaasSubscription, } from "@/lib/billing/asaas";
import {
  verifyTurnstileToken,
  getClientIp,
} from "@/lib/captcha";

function originFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

let userId: string | null = null;
let customerId: string | null = null;

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  const signup = getSignupSupabase();


  let userId: string | null = null;
let customerId: string | null = null;

  try {
    
    const body = await req.json();

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
const { data, error } = await signup.auth.signUp({
  email: body.email,
  password: body.password,
  options: {
    emailRedirectTo: `${originFrom(req)}/auth/callback?next=/chat`,
    captchaToken: body.turnstileToken,
  },
});


if (!data.user) {
  throw new Error("Usuário não foi criado.");
}

userId = data.user.id;


if (!data.user) {
  throw new Error("USER NULL");
}

console.log("========== SIGNUP ==========");
console.log(data);
console.log(error);

if (!data.user) {
  return NextResponse.json(
    {
      error: "Usuário não criado.",
    },
    { status: 400 }
  );
}

if (!data.user) {
  return NextResponse.json(
    {
      error: "Não foi possível criar o usuário.",
    },
    { status: 400 }
  );
}


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

const customer = await createAsaasCustomer({

  name: body.fullName,
  email: body.email,
  cpfCnpj: body.cpf.replace(/\D/g, ""),

  mobilePhone: body.phone.replace(/\D/g, ""),
  company: body.companyName,
});

customerId = customer.id;

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

console.log("cardExpiry:", body.cardExpiry);
console.log("month:", month);
console.log("year:", year);


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


await supabase
  .from("profiles")
  .update({
    asaas_customer_id: customer.id,
    asaas_subscription_id: subscription.id,
  })
  .eq("id", data.user.id);

    if (profileError) {
      console.error(profileError);
    }

return NextResponse.json({
  success: true,
  user: data.user,
  subscription,
});

} catch (err: any) {
  console.error("Erro no cadastro:", err);

  if (userId) {
    try {
      await getServerSupabase().auth.admin.deleteUser(userId);

      console.log("Rollback Supabase realizado.");
    } catch (rollbackError) {
      console.error(
        "Erro ao remover usuário:",
        rollbackError
      );
    }
  }

  return NextResponse.json(
    {
      error:
        err.message ??
        "Não foi possível concluir o cadastro.",
    },
    { status: 400 }
  );
}
}