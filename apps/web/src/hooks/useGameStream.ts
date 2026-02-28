import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, GameEvent } from '../types';
import { fetchState, fetchEvents, createEventSource } from '../api';

export function useGameStream() {
  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const reload = useCallback(async () => {
    const [s, e] = await Promise.all([fetchState(), fetchEvents()]);
    setState(s);
    setEvents(e);
  }, []);

  useEffect(() => {
    reload();

    const es = createEventSource();
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as GameEvent;
        setEvents((prev) => [...prev, event]);

        // Re-fetch state on any game event to stay in sync
        fetchState().then((s) => {
          if (s) setState(s);
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [reload]);

  return { state, events, connected, reload };
}
