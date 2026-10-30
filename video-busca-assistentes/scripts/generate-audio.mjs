import { execFileSync } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = path.join(projectRoot, 'public', 'audio');
const tempDir = path.join(projectRoot, '.audio-temp');

const voice = 'pt-BR-AntonioNeural';
const rate = '+4%';

const lines = [
  {
    id: 'scene-1',
    text: 'Ficou mais fácil encontrar o assistente que você precisa no Pró GPT.',
    writtenText: 'Ficou mais fácil encontrar o assistente que você precisa no PROGPT.',
  },
  {
    id: 'scene-2',
    text: 'Na área de chat, abra Assistentes, no menu lateral.',
    writtenText: 'Na área de chat, abra Assistentes, no menu lateral.',
  },
  {
    id: 'scene-3',
    text: 'Digite o nome no campo de busca e encontre rapidamente o assistente desejado.',
    writtenText: 'Digite o nome no campo de busca e encontre rapidamente o assistente desejado.',
  },
  {
    id: 'scene-4',
    text: 'Selecione o resultado e pronto: você já pode começar sua análise.',
    writtenText: 'Selecione o resultado e pronto: você já pode começar sua análise.',
  },
  {
    id: 'scene-5',
    text: 'Pró GPT. Mais agilidade para o seu dia a dia.',
    writtenText: 'PROGPT. Mais agilidade para o seu dia a dia.',
  },
];

await mkdir(audioDir, { recursive: true });
await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

const manifest = {
  service: 'Microsoft Edge Read Aloud via msedge-tts',
  voice,
  rate,
  note: 'A voz do vídeo institucional usa edge-tts, mas seu identificador não estava disponível. AntonioNeural é a alternativa masculina brasileira escolhida no mesmo serviço.',
  generatedAt: new Date().toISOString(),
  lines: [],
};

for (const line of lines) {
  const outputDir = path.join(tempDir, line.id);
  await mkdir(outputDir, { recursive: true });

  const tts = new MsEdgeTTS({ connectionTimeoutMs: 20000, synthesisTimeoutMs: 60000 });
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: true,
    sentenceBoundaryEnabled: true,
  });

  const result = await tts.toFile(outputDir, line.text, { rate });
  tts.close();

  const destination = path.join(audioDir, `${line.id}.mp3`);
  await copyFile(result.audioFilePath, destination);

  let metadata = null;
  if (result.metadataFilePath) {
    metadata = JSON.parse(await readFile(result.metadataFilePath, 'utf8'));
    await writeFile(
      path.join(audioDir, `${line.id}-boundaries.json`),
      JSON.stringify(metadata, null, 2),
      'utf8',
    );
  }

  const duration = Number(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        destination,
      ],
      { encoding: 'utf8' },
    ).trim(),
  );

  manifest.lines.push({
    id: line.id,
    writtenText: line.writtenText,
    submittedText: line.text,
    file: `audio/${line.id}.mp3`,
    durationSeconds: duration,
    wordBoundaries: metadata ? `audio/${line.id}-boundaries.json` : null,
  });
}

const musicPath = path.join(audioDir, 'music-bed.wav');
const institutionalMusicPath = path.join(
  projectRoot,
  'source-audio',
  'progpt-apresentacao-instrumental.wav',
);
await access(institutionalMusicPath);
execFileSync('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-t',
  '30',
  '-i',
  institutionalMusicPath,
  '-af',
  'afade=t=out:st=28.5:d=1.5',
  '-ar',
  '48000',
  '-ac',
  '2',
  '-c:a',
  'pcm_s24le',
  musicPath,
]);

manifest.music = {
  source: 'source-audio/progpt-apresentacao-instrumental.wav',
  provenance: 'Instrumental separado do MP4 institucional com UVR-MDX-NET-Inst_HQ_4',
  remotionVolume: 0.55,
  fadeOutSeconds: 1.5,
};

const clickPath = path.join(audioDir, 'click.wav');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=1250:sample_rate=48000:duration=0.09',
  '-af',
  'volume=0.12,afade=t=out:st=0.015:d=0.075',
  '-c:a',
  'pcm_s16le',
  clickPath,
]);

await writeFile(path.join(audioDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
await rm(tempDir, { recursive: true, force: true });
console.log(JSON.stringify(manifest, null, 2));
