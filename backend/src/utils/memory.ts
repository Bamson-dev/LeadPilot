import os from "os";

export function getMemoryUsagePercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return ((total - free) / total) * 100;
}

export function isMemoryPressureHigh(thresholdPercent = 80): boolean {
  return getMemoryUsagePercent() >= thresholdPercent;
}
