// Cria (ou libera) a conta de um médico na Área Médica, com senha temporária.
//
//   npm run medico:criar -- medico@clinica.com.br          (só a Área Médica)
//   npm run medico:criar -- pessoa@2bsupply.com.br equipe  (sistema todo + Área Médica)
//
// A senha temporária aparece SÓ no terminal de quem rodou. No primeiro acesso
// o sistema obriga o médico a criar a senha dele (/area-medica/primeira-senha).
// Lê as credenciais do .env.local (service-role): rode na máquina da 2B Supply.
import { randomInt } from 'crypto';
import { readFileSync } from 'fs';

for (const linha of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
}

function senhaTemporaria(): string {
  // Fácil de ditar por telefone: sem letras e números que se confundem.
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const pedaco = (n: number, alfabeto: string) => Array.from({ length: n }, () => alfabeto[randomInt(alfabeto.length)]).join('');
  return `${pedaco(4, letras)}-${pedaco(4, '23456789')}-${pedaco(4, letras.toUpperCase())}`;
}

(async () => {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  const tipo = process.argv[3] === 'equipe' ? 'equipe' : 'medico';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('uso: npm run medico:criar -- <e-mail> [equipe]');

  const { getServerSupabase } = await import('@/lib/db/supabase');
  const db = getServerSupabase();
  const senha = senhaTemporaria();

  const { data: existente } = await db.from('profiles_with_email').select('id').eq('email', email).maybeSingle();
  let id = existente?.id as string | undefined;
  if (id) {
    const { error } = await db.auth.admin.updateUserById(id, { password: senha, user_metadata: { trocar_senha: true } });
    if (error) throw new Error(`não consegui trocar a senha: ${error.message}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { trocar_senha: true } });
    if (error || !data.user) throw new Error(`não consegui criar a conta: ${error?.message}`);
    id = data.user.id;
  }

  const { error } = await db.from('profiles').update({ area_medica: tipo }).eq('id', id);
  if (error) throw new Error(`conta criada, mas o acesso não foi liberado: ${error.message}`);

  console.log(`\n${existente ? 'Conta que já existia' : 'Conta criada'}: ${email}`);
  console.log(`Tipo: ${tipo === 'medico' ? 'médico (só a Área Médica)' : 'equipe (sistema todo + Área Médica)'}`);
  console.log(`Senha temporária: ${senha}`);
  console.log('Entrada: https://2bsupply.ia.br/medicos');
  console.log('No primeiro acesso o sistema pede para ele criar a própria senha.\n');
  process.exit(0);
})().catch((e) => {
  console.error(`\nFalhou: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
