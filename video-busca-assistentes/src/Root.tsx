import React from 'react';
import { Composition } from 'remotion';
import { BuscaAssistentesVideo, type VideoProps } from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="BuscaAssistentes"
    component={BuscaAssistentesVideo}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ preview: false }}
  />
);
