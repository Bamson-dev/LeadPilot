import { logger } from "../../utils/logger";

const MAX_PLAYWRIGHT_INSTANCES = parseInt(
  process.env.PLAYWRIGHT_MAX_INSTANCES || "10",
  10
);

let active = 0;
const waiters: Array<() => void> = [];

function releaseSlot(): void {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
}

/** Global cap on concurrent Playwright browser checkouts across all search jobs. */
export async function acquirePlaywrightSlot(): Promise<() => void> {
  if (active < MAX_PLAYWRIGHT_INSTANCES) {
    active++;
    return releaseSlot;
  }

  await new Promise<void>((resolve) => {
    waiters.push(() => {
      active++;
      resolve();
    });
  });

  return releaseSlot;
}

export function getPlaywrightSemaphoreStatus(): {
  active: number;
  max: number;
  waiting: number;
} {
  return {
    active,
    max: MAX_PLAYWRIGHT_INSTANCES,
    waiting: waiters.length,
  };
}

export function logPlaywrightSemaphoreIfBusy(): void {
  if (waiters.length > 0) {
    logger.info("Playwright semaphore queue", getPlaywrightSemaphoreStatus());
  }
}
