import React from "react";
import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "remotion";
import { COLORS, SCENE_BOUNDS } from "./constants/theme";
import { sceneOpacity } from "./utils/animations";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Search } from "./scenes/Scene2Search";
import { Scene3Results } from "./scenes/Scene3Results";
import { Scene4BusinessDetail } from "./scenes/Scene4BusinessDetail";
import { Scene5Export } from "./scenes/Scene5Export";
import { Scene6Closing } from "./scenes/Scene6Closing";

const SCENES = [
  { Component: Scene1Hook, ...SCENE_BOUNDS.scene1 },
  { Component: Scene2Search, ...SCENE_BOUNDS.scene2 },
  { Component: Scene3Results, ...SCENE_BOUNDS.scene3 },
  { Component: Scene4BusinessDetail, ...SCENE_BOUNDS.scene4 },
  { Component: Scene5Export, ...SCENE_BOUNDS.scene5 },
  { Component: Scene6Closing, ...SCENE_BOUNDS.scene6 },
] as const;

export const LeadThurDemo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: COLORS.background }}>
      {SCENES.map(({ Component, start, end }) => {
        const opacity = sceneOpacity(frame, start, end);
        if (opacity <= 0) return null;

        return (
          <AbsoluteFill key={start} style={{ opacity }}>
            <Component />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
