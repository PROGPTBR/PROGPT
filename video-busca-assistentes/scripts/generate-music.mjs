import { writeFile } from 'node:fs/promises';

const output = process.argv[2];
if (!output) throw new Error('Informe o caminho de saída WAV.');

const sampleRate = 48000;
const duration = 30;
const channels = 2;
const totalFrames = sampleRate * duration;
const data = Buffer.alloc(totalFrames * channels * 2);

const chords = [
  [130.81, 164.81, 196.0],
  [110.0, 130.81, 164.81],
  [87.31, 130.81, 174.61],
  [98.0, 146.83, 196.0],
  [130.81, 164.81, 196.0],
];

const notes = [261.63, 329.63, 392.0, 329.63, 220.0, 261.63, 329.63, 261.63];

const smoothstep = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

let seed = 481516;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff - 0.5;
};

for (let frame = 0; frame < totalFrames; frame += 1) {
  const time = frame / sampleRate;
  const chordIndex = Math.min(chords.length - 1, Math.floor(time / 6));
  const chord = chords[chordIndex];
  const chordLocal = time - chordIndex * 6;
  const chordFade = smoothstep(chordLocal / 0.9) * smoothstep((6 - chordLocal) / 1.1);

  let padLeft = 0;
  let padRight = 0;
  chord.forEach((frequency, index) => {
    const phase = index * 0.55;
    padLeft += Math.sin(2 * Math.PI * frequency * time + phase) * (0.025 - index * 0.003);
    padRight += Math.sin(2 * Math.PI * frequency * time + phase + 0.12) * (0.025 - index * 0.003);
  });

  const beat = Math.floor(time / 0.75);
  const beatLocal = time - beat * 0.75;
  const note = notes[beat % notes.length];
  const pluckEnvelope = Math.exp(-beatLocal * 7.5) * smoothstep(beatLocal / 0.018);
  const pluck =
    (Math.sin(2 * Math.PI * note * time) * 0.024 +
      Math.sin(2 * Math.PI * note * 2 * time) * 0.007) *
    pluckEnvelope;

  const air = noise() * 0.0025 * (0.55 + Math.sin(2 * Math.PI * 0.08 * time) * 0.45);
  const masterFade = smoothstep(time / 1.25) * smoothstep((duration - time) / 2.4);
  const left = (padLeft * chordFade + pluck * 0.9 + air) * masterFade;
  const right = (padRight * chordFade + pluck * 1.05 - air) * masterFade;

  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left)) * 32767), frame * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right)) * 32767), frame * 4 + 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(channels, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * channels * 2, 28);
header.writeUInt16LE(channels * 2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

await writeFile(output, Buffer.concat([header, data]));
