import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/db/supabase-server';

export async function POST(req: Request) {
  try {
    const supabase = supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const body = await req.json();

   const {
  full_name,
  cpf_cnpj,
  phone,
  professional_requirement,
} = body;

    const { error } = await supabase
  .from('profiles')
  .update({
    full_name,
    cpf_cnpj,
    phone,
    professional_requirement,
  })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    );
  }
}