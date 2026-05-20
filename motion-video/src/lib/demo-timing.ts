export const DEMO_TIMING = {
  fps: 30,
  charFrames: 3,
  /** Rows begin shortly after business field finishes */
  scanLeadStartFrames: 22,
  pauseBetweenSearchesFrames: 135,
  counterRampFrames: 420,
  rowIntervalFrames: 17,
  lifetimeOfferFrames: 210,
} as const;

export const DEMO_SCENARIOS = [
  {
    business: "restaurants",
    location: "Lagos",
    targetCount: 156,
    seed: 4102,
  },
  {
    business: "hair salon",
    location: "Ikeja, Lagos",
    targetCount: 112,
    seed: 8831,
  },
  {
    business: "real estate agency",
    location: "Abuja",
    targetCount: 87,
    seed: 2294,
  },
] as const;

export function scenarioBusinessFrames(business: string): number {
  return business.length * DEMO_TIMING.charFrames;
}

export function scenarioDiscoverFrames(
  location: string,
  targetCount: number
): number {
  const locFrames = location.length * DEMO_TIMING.charFrames;
  const streamFrames = targetCount * DEMO_TIMING.rowIntervalFrames + 30;
  return (
    DEMO_TIMING.scanLeadStartFrames +
    Math.max(locFrames, streamFrames)
  );
}

export function totalScreenDemoFrames(): number {
  let total = 0;
  for (const s of DEMO_SCENARIOS) {
    total += scenarioBusinessFrames(s.business);
    total += scenarioDiscoverFrames(s.location, s.targetCount);
    total += DEMO_TIMING.pauseBetweenSearchesFrames;
  }
  return total + DEMO_TIMING.lifetimeOfferFrames + 30;
}

/** Smoothstep accelerating counter 0 → target */
export function acceleratingCount(
  frame: number,
  startFrame: number,
  target: number,
  rampFrames: number
): number {
  const t = Math.min(1, Math.max(0, (frame - startFrame) / rampFrames));
  const eased = t * t * (3 - 2 * t);
  return Math.min(target, Math.floor(eased * target));
}
