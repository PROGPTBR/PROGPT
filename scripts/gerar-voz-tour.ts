// Gera o áudio do assistente do tour: public/tour/voz/<id>.mp3 para cada passo
// de lib/onboarding/tour-steps.ts, + manifest.json com a assinatura do texto.
// Só regrava o que mudou.
//
//   EDGE_TTS_BIN=~/Documentos/gravacao-reels/fonte/.venv/bin/edge-tts \
//     npx tsx --tsconfig tsconfig.json scripts/gerar-voz-tour.ts
//
// Voz: pt-BR-FranciscaNeural (Microsoft, via edge-tts). Mudou o texto de um
// passo? Rode de novo — o teste tests/lib/onboarding/tour-voz.test.ts falha
// enquanto houver passo sem áudio ou com áudio de texto antigo.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { TOUR_STEPS } from '@/lib/onboarding/tour-steps';
import { assinaturaFala, textoFalado } from '@/lib/onboarding/tour-voz';

const DIR = path.join(process.cwd(), 'public/tour/voz');
const MANIFEST = path.join(DIR, 'manifest.json');
const BIN = process.env.EDGE_TTS_BIN || 'edge-tts';
const VOZ = process.env.TOUR_VOZ || 'pt-BR-FranciscaNeural';

mkdirSync(DIR, { recursive: true });
const antigo: Record<string, string> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const novo: Record<string, string> = {};

for (const step of TOUR_STEPS) {
  const texto = textoFalado(step);
  const assinatura = assinaturaFala(texto);
  const arquivo = path.join(DIR, `${step.id}.mp3`);
  novo[step.id] = assinatura;
  if (antigo[step.id] === assinatura && existsSync(arquivo)) continue;
  execFileSync(BIN, ['--voice', VOZ, '--rate=+4%', '--text', texto, '--write-media', arquivo], { stdio: 'ignore' });
  console.log('gravado', step.id);
}
// passo que saiu do roteiro: o áudio sai junto
for (const f of readdirSync(DIR)) {
  if (f.endsWith('.mp3') && !novo[f.replace(/\.mp3$/, '')]) { unlinkSync(path.join(DIR, f)); console.log('removido', f); }
}
writeFileSync(MANIFEST, JSON.stringify(novo, null, 1) + '\n');
console.log(`${Object.keys(novo).length} passos com voz`);
