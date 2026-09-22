import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          error: "invalid_email",
          message: "Informe um endereço de e-mail válido.",
        },
        { status: 400 },
      );
    }

    const supabase = getServerSupabase();

    // Essa RPC já existe no seu projeto e também é usada
    // no fluxo de usuários associados (seat-members).
    const { data, error } = await supabase.rpc(
      "user_id_by_email",
      {
        p_email: email,
      },
    );

    if (error) {
      console.error(
        "[check-email] erro ao consultar e-mail:",
        error.message,
      );

      return NextResponse.json(
        {
          error: "check_failed",
          message:
            "Não foi possível verificar o e-mail agora. Tente novamente.",
        },
        { status: 500 },
      );
    }

    const exists = Boolean(data);

    return NextResponse.json({
      exists,
      message: exists
        ? "Este e-mail já possui uma conta cadastrada."
        : null,
    });
  } catch (err) {
    console.error(
      "[check-email] erro inesperado:",
      err,
    );

    return NextResponse.json(
      {
        error: "check_failed",
        message:
          "Não foi possível verificar o e-mail agora. Tente novamente.",
      },
      { status: 500 },
    );
  }
}