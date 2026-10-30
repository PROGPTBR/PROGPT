# Relatório de revisão

## Entregáveis

- Prévia: 960×540, 30 fps, H.264/AAC, 30,016 s.
- Final: 1920×1080, 30 fps, H.264 High/AAC LC, 30,016 s.
- Legendas queimadas no vídeo e arquivo SRT reutilizável.
- Projeto Remotion, capturas originais, locuções separadas, limites de palavras, trilha e efeitos preservados.
- Locução masculina `pt-BR-AntonioNeural`, gerada com o mesmo serviço `edge-tts` documentado para o vídeo institucional.
- Música do vídeo institucional separada em stem instrumental e adicionada em volume baixo sob a voz.

## Verificações realizadas

- TypeScript sem erros.
- Cinco quadros-chave renderizados e inspecionados.
- Imagens escaladas uniformemente, sem distorção.
- Menu, busca, resultado e título da ferramenta legíveis nas aproximações.
- Encerramento sem botão “Ouvir com som”, moldura do player ou legenda da referência.
- Prévia e master decodificados integralmente com FFmpeg, sem erros.
- Referência institucional, primeiros 30 s: mix completo em −15,5 LUFS e instrumental separado em −24,0 LUFS.
- Ganho da música no Remotion: `0.55` (−5,19 dB), para preservar a diferença relativa entre música e locução.
- Master atualizado: −20,8 LUFS integrado; pico verdadeiro −6,1 dBFS.
- Voz, música e efeitos permanecem em stems editáveis.
- Locução feminina e renders anteriores preservados em `public/audio/archive-female` e `out/archive-female`.

## Identidade da voz

O MP4 institucional e a documentação disponível confirmam o uso de `edge-tts`, mas não registram o identificador da voz. Por isso, não é possível afirmar que a voz usada aqui seja exatamente a mesma. `pt-BR-AntonioNeural` foi escolhida como alternativa masculina brasileira no mesmo serviço.

## Limitação de revisão

A faixa usada é a mesma música do MP4 institucional, recuperada por separação de stems porque o master original não estava disponível. A separação pode conter artefatos residuais e não equivale ao stem de estúdio. A locução foi validada pelo texto enviado, pelos metadados de limites de palavras, pelas durações e pela integridade do stream. Não foi realizada uma revisão auditiva humana dentro deste ambiente.
