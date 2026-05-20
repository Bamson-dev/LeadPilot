import React from "react";
import { Composition } from "remotion";
import { LeadPilotPromo } from "./LeadPilotPromo";
import {
  LeadPilotScreenDemo,
  totalScreenDemoFrames,
} from "./LeadPilotScreenDemo";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LeadPilotPromo"
        component={LeadPilotPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="LeadPilotPromoVertical"
        component={LeadPilotPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="LeadPilotScreenDemo"
        component={LeadPilotScreenDemo}
        durationInFrames={totalScreenDemoFrames()}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
