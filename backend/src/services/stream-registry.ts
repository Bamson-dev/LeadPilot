import type { Response } from "express";

const streams = new Map<string, Response>();
const buffers = new Map<string, object[]>();
const listeners = new Map<string, Set<(data: object) => void>>();

function writeEvent(res: Response, data: object): void {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

function notifyListeners(searchId: string, data: object): void {
  listeners.get(searchId)?.forEach((fn) => {
    try {
      fn(data);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function onStreamEvent(
  searchId: string,
  handler: (data: object) => void
): () => void {
  if (!listeners.has(searchId)) listeners.set(searchId, new Set());
  listeners.get(searchId)!.add(handler);
  return () => listeners.get(searchId)?.delete(handler);
}

export function registerStream(searchId: string, res: Response): void {
  streams.set(searchId, res);
  const pending = buffers.get(searchId);
  if (pending?.length) {
    for (const data of pending) {
      writeEvent(res, data);
      notifyListeners(searchId, data);
    }
    buffers.delete(searchId);
  }
}

export function getStream(searchId: string): Response | undefined {
  return streams.get(searchId);
}

export function removeStream(searchId: string): void {
  streams.delete(searchId);
  listeners.delete(searchId);
}

export function clearStreamBuffer(searchId: string): void {
  buffers.delete(searchId);
}

export function emitToStream(searchId: string, data: object): void {
  notifyListeners(searchId, data);

  const stream = streams.get(searchId);
  if (stream) {
    writeEvent(stream, data);
    return;
  }

  const buf = buffers.get(searchId) ?? [];
  buf.push(data);
  buffers.set(searchId, buf);
}
