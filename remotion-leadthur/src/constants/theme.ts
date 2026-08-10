export const COLORS = {
  background: "#050508",
  card: "#1A1530",
  border: "#2D2650",
  purple: "#7C3AED",
  purpleLight: "#A78BFA",
  green: "#10B981",
  white: "#FFFFFF",
  muted: "#8888A8",
} as const;

export const SPRING_CONFIG = {
  mass: 0.6,
  damping: 14,
  stiffness: 120,
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 2700,
} as const;

export const SCENE_BOUNDS = {
  scene1: { start: 0, end: 240 },
  scene2: { start: 240, end: 840 },
  scene3: { start: 840, end: 1800 },
  scene4: { start: 1800, end: 2160 },
  scene5: { start: 2160, end: 2460 },
  scene6: { start: 2460, end: 2700 },
} as const;

export const CROSSFADE_FRAMES = 12;
