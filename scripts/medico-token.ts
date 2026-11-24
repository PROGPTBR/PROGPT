// Mostra o token que o agendador externo usa para chamar POST /api/medico/avisos
// (cabeçalho x-area-medica-token). Deriva do APP_SECRET do ambiente:
//
//   APP_SECRET='<o de produção>' npm run medico:token
import { createHash } from 'crypto';

const base = process.env.APP_SECRET;
if (!base) {
  console.error('Defina APP_SECRET com o valor de produção antes de rodar.');
  process.exit(1);
}
console.log(createHash('sha256').update(`${base}:area-medica:avisos`).digest('hex').slice(0, 40));
