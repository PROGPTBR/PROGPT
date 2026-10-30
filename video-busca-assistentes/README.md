# Vídeo — busca de assistentes do PROGPT

Projeto editável em Remotion para o vídeo demonstrativo horizontal, 1920×1080, 30 fps.

## Voz

- Serviço identificado no vídeo institucional original: `edge-tts`.
- O identificador exato da voz original não estava disponível no repositório nem no kit externo mencionado pela documentação.
- Voz masculina usada: `pt-BR-AntonioNeural`, do mesmo serviço da voz institucional.
- O identificador exato da voz do vídeo institucional não pôde ser comprovado pelo MP4.
- Velocidade: `+4%`.

## Música

- A música é a faixa instrumental separada do vídeo institucional `public/videos/progpt-apresentacao.mp4`.
- Fonte editável: `source-audio/progpt-apresentacao-instrumental.wav`.
- Separação local: `audio-separator 0.48.0` com `UVR-MDX-NET-Inst_HQ_4.onnx`.
- Volume no Remotion: `0.55` (−5,19 dB), mantendo aproximadamente a mesma diferença entre música e locução do institucional.
- A cama ambiente anterior foi preservada em `public/audio/archive-ambient`.

## Comandos

```bash
npm run audio
npm run preview
npm run render
npm run studio
```

Os arquivos-fonte ficam em `public/assets` e `source-audio`, a locução, a trilha e os efeitos em `public/audio`, e os renders em `out`.
