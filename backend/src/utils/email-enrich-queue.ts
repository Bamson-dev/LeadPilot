import { EMAIL_ENRICH_CONCURRENCY } from "../scraper/utils/constants";

type Task = () => Promise<void>;

let active = 0;
const waiting: Task[] = [];

function pump(): void {
  while (active < EMAIL_ENRICH_CONCURRENCY && waiting.length > 0) {
    const task = waiting.shift();
    if (!task) break;
    active++;
    void task().finally(() => {
      active--;
      pump();
    });
  }
}

/** Run background email crawls without blocking the Maps scraper. */
export function enqueueEmailEnrich(task: Task): void {
  waiting.push(task);
  pump();
}
