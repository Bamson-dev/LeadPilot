import React from "react";
import { Composition } from "remotion";
import { LeadThurDemo } from "./LeadThurDemo";
import { MetaAd15 } from "./MetaAd15";
import { MetaAd30 } from "./MetaAd30";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LeadThurDemo"
        component={LeadThurDemo}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="MetaAd15"
        component={MetaAd15}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="MetaAd30"
        component={MetaAd30}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};
