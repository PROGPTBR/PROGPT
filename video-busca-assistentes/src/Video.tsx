import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type VideoProps = {
  preview: boolean;
};

const COLORS = {
  bg: '#07111f',
  panel: '#0d1b2e',
  panel2: '#13243a',
  cyan: '#10bfe8',
  cyanDark: '#087ba5',
  white: '#f7fbff',
  muted: '#9bb0c9',
};

const fadeForScene = (
  frame: number,
  start: number,
  end: number,
  fadeIn = true,
  fadeOut = true,
) => {
  const entrance = fadeIn
    ? interpolate(frame, [start, start + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const exit = fadeOut
    ? interpolate(frame, [end - 12, end], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  return Math.min(entrance, exit);
};

const Screen: React.FC<{
  src: string;
  scale?: number;
  origin?: string;
  opacity?: number;
  translateX?: number;
  translateY?: number;
}> = ({
  src,
  scale = 1,
  origin = 'center center',
  opacity = 1,
  translateX = 0,
  translateY = 0,
}) => (
  <AbsoluteFill
    style={{
      background: COLORS.bg,
      overflow: 'hidden',
      opacity,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transformOrigin: origin,
      }}
    />
  </AbsoluteFill>
);

const Cursor: React.FC<{ x: number; y: number; scale?: number; opacity?: number }> = ({
  x,
  y,
  scale = 1,
  opacity = 1,
}) => (
  <svg
    width="52"
    height="64"
    viewBox="0 0 52 64"
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `scale(${scale})`,
      transformOrigin: '0 0',
      opacity,
      filter: 'drop-shadow(0 5px 9px rgba(0,0,0,.65))',
    }}
  >
    <path
      d="M5 3L43 38H27L34 57L23 62L16 42L5 53Z"
      fill="#f8fcff"
      stroke="#07111f"
      strokeWidth="4"
      strokeLinejoin="round"
    />
  </svg>
);

const ClickPulse: React.FC<{ x: number; y: number; progress: number }> = ({ x, y, progress }) => (
  <div
    style={{
      position: 'absolute',
      left: x - 30,
      top: y - 30,
      width: 60,
      height: 60,
      borderRadius: '50%',
      border: `4px solid ${COLORS.cyan}`,
      transform: `scale(${interpolate(progress, [0, 1], [0.25, 1.7])})`,
      opacity: interpolate(progress, [0, 1], [0.95, 0]),
      boxShadow: `0 0 24px ${COLORS.cyan}`,
    }}
  />
);

const Caption: React.FC<{ text: string; start: number; end: number }> = ({ text, start, end }) => {
  const frame = useCurrentFrame();
  if (frame < start || frame >= end) return null;

  const opacity = interpolate(frame, [start, start + 5, end - 5, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 40,
        left: '50%',
        bottom: 58,
        transform: 'translateX(-50%)',
        maxWidth: 1500,
        padding: '14px 30px 16px',
        borderRadius: 18,
        background: 'rgba(3, 10, 20, 0.86)',
        border: '1px solid rgba(41, 196, 230, 0.32)',
        color: COLORS.white,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 34,
        fontWeight: 700,
        lineHeight: 1.22,
        textAlign: 'center',
        letterSpacing: -0.5,
        boxShadow: '0 12px 36px rgba(0,0,0,.44)',
        opacity,
      }}
    >
      {text}
    </div>
  );
};

const SceneOne: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeForScene(frame, 0, 150, false, true);
  const titleIn = spring({ frame, fps: 30, config: { damping: 18, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Screen src="assets/tela-do-chat.png" />
      <div
        style={{
          position: 'absolute',
          top: 70,
          left: '50%',
          transform: `translate(-50%, ${interpolate(titleIn, [0, 1], [-26, 0])}px)`,
          opacity: titleIn,
          padding: '24px 40px 26px',
          borderRadius: 22,
          background: 'linear-gradient(180deg, rgba(11,28,48,.97), rgba(7,18,33,.92))',
          border: '1px solid rgba(16,191,232,.36)',
          boxShadow: '0 18px 50px rgba(0,0,0,.46), 0 0 40px rgba(16,191,232,.08)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: COLORS.cyan,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 4,
            marginBottom: 9,
          }}
        >
          NOVO NO PROGPT
        </div>
        <div
          style={{
            color: COLORS.white,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 49,
            fontWeight: 800,
            letterSpacing: -1.7,
            whiteSpace: 'nowrap',
          }}
        >
          Encontre seus assistentes com mais facilidade
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneTwo: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeForScene(frame, 138, 300, true, true);
  const local = frame - 150;
  const cursorProgress = interpolate(local, [4, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorX = interpolate(cursorProgress, [0, 1], [520, 180]);
  const cursorY = interpolate(cursorProgress, [0, 1], [510, 236]);
  const clickProgress = interpolate(local, [55, 73], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showOpen = interpolate(local, [62, 79], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = interpolate(local, [78, 145], [1, 1.24], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Screen src="assets/tela-do-chat.png" opacity={1 - showOpen} />
      <Screen
        src="assets/curso-tela.png"
        opacity={showOpen}
        scale={zoom}
        origin="0% 46%"
      />
      {local < 82 && <Cursor x={cursorX} y={cursorY} />}
      {local >= 55 && local <= 74 && (
        <ClickPulse x={203} y={259} progress={clickProgress} />
      )}
    </AbsoluteFill>
  );
};

const SceneThree: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeForScene(frame, 288, 510, true, true);
  const local = frame - 300;
  const filteredReveal = interpolate(local, [114, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = interpolate(local, [0, 32], [1.24, 1.38], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const typedLength = Math.floor(
    interpolate(local, [38, 112], [0, 'Análise de Gastos'.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const typed = 'Análise de Gastos'.slice(0, typedLength);
  const pulse = 0.65 + Math.sin(local / 7) * 0.18;

  return (
    <AbsoluteFill style={{ opacity }}>
      <Screen
        src="assets/curso-tela.png"
        opacity={1 - filteredReveal}
        scale={zoom}
        origin="0% 46%"
      />
      <Screen
        src="assets/busca-analise-de-gastos.png"
        opacity={filteredReveal}
        scale={1.36}
        origin="0% 46%"
      />

      {filteredReveal < 0.98 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 430,
              top: 210,
              width: 520,
              height: 62,
              borderRadius: 15,
              background: '#0b1729',
              border: `2px solid rgba(16,191,232,${pulse})`,
              boxShadow: '0 0 0 7px rgba(16,191,232,.07), 0 12px 30px rgba(0,0,0,.32)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 58,
              color: COLORS.white,
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: 23,
              fontWeight: 600,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 18,
                width: 19,
                height: 19,
                border: '3px solid #8fa4bc',
                borderRadius: '50%',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: 9,
                  height: 3,
                  background: '#8fa4bc',
                  right: -7,
                  bottom: -4,
                  transform: 'rotate(45deg)',
                  borderRadius: 2,
                }}
              />
            </div>
            {typed}
            <span
              style={{
                width: 2,
                height: 28,
                background: COLORS.cyan,
                marginLeft: 3,
                opacity: Math.floor(local / 10) % 2 ? 0.15 : 1,
              }}
            />
          </div>
        </>
      )}

      {filteredReveal > 0.55 && (
        <div
          style={{
            position: 'absolute',
            left: 432,
            top: 372,
            width: 490,
            height: 92,
            borderRadius: 18,
            border: '3px solid rgba(16,191,232,.9)',
            boxShadow: '0 0 0 8px rgba(16,191,232,.08), 0 0 34px rgba(16,191,232,.24)',
            opacity: interpolate(filteredReveal, [0.55, 1], [0, 1]),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

const SceneFour: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeForScene(frame, 498, 690, true, true);
  const local = frame - 510;
  const cursorProgress = interpolate(local, [3, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorX = interpolate(cursorProgress, [0, 1], [1050, 720]);
  const cursorY = interpolate(cursorProgress, [0, 1], [530, 410]);
  const clickProgress = interpolate(local, [46, 63], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const selectedReveal = interpolate(local, [58, 78], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = interpolate(local, [80, 170], [1, 1.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Screen
        src="assets/busca-analise-de-gastos.png"
        opacity={1 - selectedReveal}
        scale={1.36}
        origin="0% 46%"
      />
      <Screen
        src="assets/analise-de-gastos-selecionado.png"
        opacity={selectedReveal}
        scale={zoom}
        origin="8% 32%"
      />

      {local < 72 && <Cursor x={cursorX} y={cursorY} />}
      {local >= 46 && local <= 64 && (
        <ClickPulse x={745} y={428} progress={clickProgress} />
      )}

      {selectedReveal > 0.7 && (
        <div
          style={{
            position: 'absolute',
            left: 84,
            top: 320,
            width: 650,
            height: 100,
            borderRadius: 20,
            border: '3px solid rgba(16,191,232,.85)',
            boxShadow: '0 0 0 10px rgba(16,191,232,.07), 0 0 38px rgba(16,191,232,.2)',
            opacity: interpolate(selectedReveal, [0.7, 1], [0, 1]),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

const ClosingCard: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - 690;
  const opacity = fadeForScene(frame, 678, 900, true, false);
  const logoIn = spring({ frame: local, fps: 30, config: { damping: 17, stiffness: 110 } });
  const cardsIn = spring({ frame: local - 24, fps: 30, config: { damping: 18, stiffness: 105 } });

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          'radial-gradient(circle at 50% 18%, rgba(14,129,176,.26), transparent 35%), linear-gradient(145deg, #06111f 0%, #071a2e 55%, #050d18 100%)',
        color: COLORS.white,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(41,92,125,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(41,92,125,.08) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.7), transparent 85%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 150,
          left: '50%',
          transform: `translateX(-50%) scale(${interpolate(logoIn, [0, 1], [0.86, 1])})`,
          opacity: logoIn,
          textAlign: 'center',
        }}
      >
        <Img
          src={staticFile('assets/progpt-logo-white.webp')}
          style={{ width: 455, height: 'auto', objectFit: 'contain' }}
        />
        <div style={{ fontSize: 31, fontWeight: 700, marginTop: 24 }}>
          Inteligência para Suprimentos.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 500,
          left: '50%',
          transform: `translateX(-50%) translateY(${interpolate(cardsIn, [0, 1], [35, 0])}px)`,
          opacity: cardsIn,
          display: 'flex',
          gap: 22,
        }}
      >
        <div
          style={{
            width: 520,
            height: 205,
            borderRadius: 22,
            padding: '32px 40px',
            background: 'linear-gradient(145deg, #16c4ed, #0aa5d5)',
            border: '1px solid rgba(255,255,255,.25)',
            boxShadow: '0 12px 0 #05364a, 0 28px 70px rgba(0,172,220,.18)',
            color: '#051421',
          }}
        >
          <div style={{ fontSize: 16, letterSpacing: 4, fontWeight: 800, marginBottom: 35 }}>
            CONHEÇA A PLATAFORMA
          </div>
          <div style={{ fontSize: 43, fontWeight: 900, letterSpacing: -1.5 }}>
            progpt.com.br
          </div>
        </div>

        <div
          style={{
            width: 560,
            height: 205,
            borderRadius: 22,
            padding: '32px 40px',
            background: 'linear-gradient(145deg, rgba(24,45,70,.96), rgba(13,28,48,.96))',
            border: '1px solid rgba(121,166,196,.28)',
            boxShadow: '0 28px 70px rgba(0,0,0,.2)',
          }}
        >
          <div style={{ fontSize: 16, letterSpacing: 4, fontWeight: 800, marginBottom: 35 }}>
            WHATSAPP COMERCIAL
          </div>
          <div style={{ fontSize: 43, fontWeight: 900, letterSpacing: -1.5 }}>
            (21) 99979-2912
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 760,
          width: '100%',
          textAlign: 'center',
          color: COLORS.muted,
          fontSize: 17,
          letterSpacing: 7,
          fontWeight: 700,
          opacity: cardsIn,
        }}
      >
        UMA PLATAFORMA 2B SUPPLY
      </div>
    </AbsoluteFill>
  );
};

const captions = [
  {
    start: 5,
    end: 144,
    text: 'Ficou mais fácil encontrar o assistente que você precisa no PROGPT.',
  },
  {
    start: 158,
    end: 285,
    text: 'Na área de chat, abra Assistentes, no menu lateral.',
  },
  {
    start: 312,
    end: 463,
    text: 'Digite o nome no campo de busca e encontre rapidamente o assistente desejado.',
  },
  {
    start: 521,
    end: 668,
    text: 'Selecione o resultado e pronto: você já pode começar sua análise.',
  },
  {
    start: 711,
    end: 848,
    text: 'PROGPT. Mais agilidade para o seu dia a dia.',
  },
];

export const BuscaAssistentesVideo: React.FC<VideoProps> = ({ preview }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <SceneOne />
      <SceneTwo />
      <SceneThree />
      <SceneFour />
      <ClosingCard />

      <Audio src={staticFile('audio/music-bed.wav')} volume={0.55} />

      <Sequence from={5} durationInFrames={140}>
        <Audio src={staticFile('audio/scene-1.mp3')} volume={1} />
      </Sequence>
      <Sequence from={158} durationInFrames={128}>
        <Audio src={staticFile('audio/scene-2.mp3')} volume={1} />
      </Sequence>
      <Sequence from={312} durationInFrames={153}>
        <Audio src={staticFile('audio/scene-3.mp3')} volume={1} />
      </Sequence>
      <Sequence from={521} durationInFrames={148}>
        <Audio src={staticFile('audio/scene-4.mp3')} volume={1} />
      </Sequence>
      <Sequence from={711} durationInFrames={138}>
        <Audio src={staticFile('audio/scene-5.mp3')} volume={1} />
      </Sequence>

      <Sequence from={205} durationInFrames={4}>
        <Audio src={staticFile('audio/click.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={557} durationInFrames={4}>
        <Audio src={staticFile('audio/click.wav')} volume={0.8} />
      </Sequence>

      {captions.map((caption) => (
        <Caption key={caption.start} {...caption} />
      ))}

      {preview && (
        <div
          style={{
            position: 'absolute',
            right: 28,
            top: 24,
            color: 'rgba(255,255,255,.45)',
            font: '600 18px Arial',
          }}
        >
          PRÉVIA · {(frame / fps).toFixed(1)}s
        </div>
      )}
    </AbsoluteFill>
  );
};
