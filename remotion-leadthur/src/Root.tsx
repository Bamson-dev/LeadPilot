import React from "react";
import { Composition } from "remotion";
import { LeadThurDemo } from "./LeadThurDemo";
import { VIDEO } from "./constants/theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LeadThurDemo"
      component={LeadThurDemo}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
