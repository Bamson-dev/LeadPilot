import { Easing, interpolate, spring } from "remotion";
import { CROSSFADE_FRAMES } from "../constants/theme";

export function fadeOpacity(
  frame: number,
  start: number,
  duration: number
): number {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });
}

export function fadeOutOpacity(
  frame: number,
  start: number,
  duration: number
): number {
  return interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });
}

export function sceneOpacity(
  frame: number,
  sceneStart: number,
  sceneEnd: number
): number {
  const fadeIn = fadeOpacity(frame, sceneStart, CROSSFADE_FRAMES);
  const fadeOut = fadeOutOpacity(frame, sceneEnd - CROSSFADE_FRAMES, CROSSFADE_FRAMES);
  return Math.min(fadeIn, fadeOut);
}

export function entranceSpring(
  frame: number,
  start: number,
  fps: number,
  config?: { mass?: number; damping?: number; stiffness?: number }
): number {
  return spring({
    frame: frame - start,
    fps,
    config: {
      mass: config?.mass ?? 0.6,
      damping: config?.damping ?? 14,
      stiffness: config?.stiffness ?? 120,
    },
  });
}
