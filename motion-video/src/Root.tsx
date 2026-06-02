import React from "react";
import { Composition } from "remotion";
import { LeadThurPromo } from "./LeadThurPromo";
import {
  LeadThurScreenDemo,
  totalScreenDemoFrames,
} from "./LeadThurScreenDemo";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LeadThurPromo"
        component={LeadThurPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="LeadThurPromoVertical"
        component={LeadThurPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="LeadThurScreenDemo"
        component={LeadThurScreenDemo}
        durationInFrames={totalScreenDemoFrames()}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
