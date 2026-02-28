import type { Response } from 'express';
import type { GameEvent } from '@monopoly/shared';

const clients: Set<Response> = new Set();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function addClient(res: Response): void {
  clients.add(res);
  res.on('close', () => clients.delete(res));
  res.on('error', () => clients.delete(res));

  // Start heartbeat if first client
  if (!heartbeatTimer && clients.size > 0) {
    heartbeatTimer = setInterval(() => {
      for (const client of clients) {
        try {
          client.write(':\n\n');
        } catch {
          clients.delete(client);
        }
      }
      if (clients.size === 0 && heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }, 30_000);
  }
}

export function broadcast(events: GameEvent[]): void {
  for (const event of events) {
    const data = JSON.stringify(event);
    for (const client of clients) {
      try {
        client.write(`data: ${data}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
